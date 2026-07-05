import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { mmToPt, charLength, xmlEscape, TAPE_SPECS } from './units';
import { buildLabelXml } from './label-xml';
import { buildPropXml } from './prop-xml';
import { buildSingleLabelLbx, lbxFileName } from '../label-lbx-exporter';

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
});

describe('buildLabelXml', () => {
	const xml = buildLabelXml({ text: TEXT, tapeHeightMm: 12, labelLengthMm: 35 });

	it('is compact: no whitespace between elements (P-touch crashes otherwise)', () => {
		const body = xml.split('\n').slice(1).join('\n'); // drop the <?xml?> line
		expect(body).not.toMatch(/>[ \t\r\n]+</);
	});

	it('starts with the XML declaration then the document on its own line', () => {
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<pt:document ')).toBe(true);
	});

	it('encodes the 12 mm tape paper block', () => {
		expect(xml).toContain('width="34pt"'); // 12 mm tape
		expect(xml).toContain(`format="${TAPE_SPECS[12].format}"`); // 259
		expect(xml).toContain('height="99.2pt"'); // 35 mm length
		expect(xml).toContain('orientation="landscape"');
	});

	it('places the text with an auto-shrinking, centered text object', () => {
		expect(xml).toContain(`<pt:data>${TEXT}</pt:data>`);
		expect(xml).toContain('charLen="15"');
		expect(xml).toContain('shrink="true"');
		expect(xml).toContain('name="Helsinki Narrow"');
	});

	it('escapes special characters in the text', () => {
		const x = buildLabelXml({ text: 'A & B <C>', tapeHeightMm: 12, labelLengthMm: 35 });
		expect(x).toContain('<pt:data>A &amp; B &lt;C&gt;</pt:data>');
	});

	it('supports the 9 mm tape (best-effort geometry)', () => {
		const x = buildLabelXml({ text: 'M4', tapeHeightMm: 9, labelLengthMm: 30 });
		expect(x).toContain('width="25.6pt"');
		expect(x).toContain(`format="${TAPE_SPECS[9].format}"`);
	});

	it('rejects an unsupported tape height', () => {
		// @ts-expect-error deliberately invalid
		expect(() => buildLabelXml({ text: 'x', tapeHeightMm: 24, labelLengthMm: 30 })).toThrow();
	});
});

describe('buildPropXml', () => {
	it('is compact and contains the title', () => {
		const p = buildPropXml({ title: TEXT });
		expect(p.split('\n').slice(1).join('\n')).not.toMatch(/>[ \t\r\n]+</);
		expect(p).toContain(`<dc:title>${TEXT}</dc:title>`);
	});
});

describe('buildSingleLabelLbx', () => {
	it('produces a ZIP containing label.xml and prop.xml', async () => {
		const blob = buildSingleLabelLbx({ text: TEXT, tapeHeightMm: 12, labelLengthMm: 35 });
		const bytes = new Uint8Array(await blob.arrayBuffer());
		const files = unzipSync(bytes);
		expect(Object.keys(files).sort()).toEqual(['label.xml', 'prop.xml']);
		expect(strFromU8(files['label.xml'])).toContain(`<pt:data>${TEXT}</pt:data>`);
		expect(strFromU8(files['prop.xml'])).toContain('<meta:properties');
	});
});

describe('lbxFileName', () => {
	it('slugifies the label text and replaces the multiplication sign', () => {
		expect(lbxFileName(TEXT)).toBe('M8_x_20_DIN_912');
		expect(lbxFileName('')).toBe('label');
	});
});
