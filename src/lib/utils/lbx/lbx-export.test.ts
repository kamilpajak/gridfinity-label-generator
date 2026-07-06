import { describe, it, expect, vi, afterEach } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { mmToPt, charLength, xmlEscape, TAPE_SPECS } from './units';
import { buildImageLabelXml } from './label-xml';
import { buildPropXml } from './prop-xml';
import { buildLbxBlob } from './lbx-zip';
import { lbxFileName, downloadBlob } from '../label-lbx-exporter';

const TEXT = 'M8 × 20 DIN 912';

describe('lbx units', () => {
	it('mmToPt converts mm to points (1 decimal)', () => {
		expect(mmToPt(12)).toBe(34); // 12 mm tape → 34 pt paper width
		expect(mmToPt(35)).toBe(99.2); // 35 mm label length
		expect(mmToPt(9)).toBe(25.5);
	});

	it('charLength counts code points, not UTF-8 bytes', () => {
		// The multiplication sign × is one character (two UTF-8 bytes).
		expect(charLength(TEXT)).toBe(15);
		expect(charLength('×')).toBe(1);
	});

	it('xmlEscape escapes the five XML entities', () => {
		expect(xmlEscape(`a & b < c > "d" 'e'`)).toBe(
			'a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;'
		);
	});

	it('xmlEscape strips C0 control characters but keeps tab/CR/LF', () => {
		// P-touch rejects a .lbx whose text contains raw control bytes.
		expect(xmlEscape('a\x00b\x07c\x1Fd\x7Fe')).toBe('abcde');
		expect(xmlEscape('a\tb\nc\rd')).toBe('a\tb\nc\rd');
	});
});

describe('buildImageLabelXml', () => {
	const xml = buildImageLabelXml({
		tapeHeightMm: 12,
		labelLengthMm: 35,
		image: { fileName: 'Object0.bmp', xMm: 2, yMm: 1, widthMm: 31, heightMm: 10 }
	});

	it('is compact: no whitespace between elements (P-touch crashes otherwise)', () => {
		const body = xml.split('\n').slice(1).join('\n'); // drop the <?xml?> line
		expect(body).not.toMatch(/>[ \t\r\n]+</);
	});

	it('starts with the XML declaration then the document on its own line', () => {
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<pt:document ')).toBe(true);
	});

	it('embeds exactly one image object and no text object', () => {
		expect((xml.match(/<image:image>/g) || []).length).toBe(1);
		expect(xml).not.toContain('<text:text>');
		expect(xml).toContain('fileName="Object0.bmp"');
	});

	it('encodes the 12 mm tape paper block', () => {
		expect(xml).toContain('width="34pt"'); // 12 mm tape
		expect(xml).toContain(`format="${TAPE_SPECS[12].format}"`); // 259
		expect(xml).toContain('height="99.2pt"'); // 35 mm length
		expect(xml).toContain('orientation="landscape"');
	});

	it('positions the image from the given millimetre rect', () => {
		expect(xml).toContain(`x="${mmToPt(2)}pt"`);
		expect(xml).toContain(`width="${mmToPt(31)}pt"`);
		expect(xml).toContain(`height="${mmToPt(10)}pt"`);
	});

	it('supports the 9 mm tape', () => {
		const x = buildImageLabelXml({
			tapeHeightMm: 9,
			labelLengthMm: 30,
			image: { fileName: 'Object0.bmp', xMm: 2, yMm: 1, widthMm: 26, heightMm: 7 }
		});
		expect(x).toContain('width="25.6pt"');
		expect(x).toContain(`format="${TAPE_SPECS[9].format}"`);
	});

	it('rejects an unsupported tape height', () => {
		expect(() =>
			buildImageLabelXml({
				// @ts-expect-error deliberately invalid
				tapeHeightMm: 24,
				labelLengthMm: 30,
				image: { fileName: 'Object0.bmp', xMm: 2, yMm: 1, widthMm: 26, heightMm: 20 }
			})
		).toThrow();
	});
});

describe('buildPropXml', () => {
	it('is compact and contains the title', () => {
		const p = buildPropXml({ title: TEXT });
		expect(p.split('\n').slice(1).join('\n')).not.toMatch(/>[ \t\r\n]+</);
		expect(p).toContain(`<dc:title>${TEXT}</dc:title>`);
	});
});

describe('buildLbxBlob', () => {
	it('packages XML strings and a binary bitmap into one ZIP', async () => {
		const bmp = new Uint8Array([0x42, 0x4d, 0x01, 0x02, 0x03]);
		const blob = buildLbxBlob({
			'label.xml': '<pt:document/>',
			'prop.xml': '<meta:properties/>',
			'Object0.bmp': bmp
		});
		const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
		expect(Object.keys(files).sort()).toEqual(['Object0.bmp', 'label.xml', 'prop.xml']);
		expect(strFromU8(files['label.xml'])).toBe('<pt:document/>');
		expect(Array.from(files['Object0.bmp'])).toEqual([0x42, 0x4d, 0x01, 0x02, 0x03]);
	});
});

describe('lbxFileName', () => {
	it('slugifies the label text and replaces the multiplication sign', () => {
		expect(lbxFileName(TEXT)).toBe('M8_x_20_DIN_912');
		expect(lbxFileName('')).toBe('label');
	});
});

describe('downloadBlob', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('creates an object URL, clicks a download anchor, then cleans up', () => {
		const click = vi.fn();
		const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement;
		const createElement = vi.fn(() => anchor);
		const appendChild = vi.fn();
		const removeChild = vi.fn();
		const createObjectURL = vi.fn(() => 'blob:mock');
		const revokeObjectURL = vi.fn();

		vi.stubGlobal('document', { createElement, body: { appendChild, removeChild } });
		vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

		const blob = new Blob(['x']);
		downloadBlob(blob, 'file.lbx');

		expect(createObjectURL).toHaveBeenCalledWith(blob);
		expect(createElement).toHaveBeenCalledWith('a');
		expect(anchor.download).toBe('file.lbx');
		expect(anchor.href).toBe('blob:mock');
		expect(appendChild).toHaveBeenCalledWith(anchor);
		expect(click).toHaveBeenCalledOnce();
		expect(removeChild).toHaveBeenCalledWith(anchor);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
	});
});
