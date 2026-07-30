import { describe, it, expect } from 'vitest';
import { encodeMonochromeBmp, type RgbaImage } from './bmp';

/** Build a solid-colour RGBA image. */
function solid(width: number, height: number, r: number, g: number, b: number, a = 255): RgbaImage {
	const data = new Uint8Array(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		data[i * 4] = r;
		data[i * 4 + 1] = g;
		data[i * 4 + 2] = b;
		data[i * 4 + 3] = a;
	}
	return { width, height, data };
}

function u32(buf: Uint8Array, offset: number): number {
	return new DataView(buf.buffer).getUint32(offset, true);
}
function i32(buf: Uint8Array, offset: number): number {
	return new DataView(buf.buffer).getInt32(offset, true);
}
function u16(buf: Uint8Array, offset: number): number {
	return new DataView(buf.buffer).getUint16(offset, true);
}

describe('encodeMonochromeBmp', () => {
	it('writes a valid 1-bit BMP header', () => {
		const bmp = encodeMonochromeBmp(solid(8, 2, 255, 255, 255));
		expect(bmp[0]).toBe(0x42); // 'B'
		expect(bmp[1]).toBe(0x4d); // 'M'
		expect(u32(bmp, 2)).toBe(bmp.length); // file size
		expect(u32(bmp, 10)).toBe(14 + 40 + 8); // data offset (headers + palette)
		expect(u32(bmp, 14)).toBe(40); // info header size
		expect(i32(bmp, 18)).toBe(8); // width
		expect(i32(bmp, 22)).toBe(2); // height (positive → bottom-up)
		expect(u16(bmp, 26)).toBe(1); // planes
		expect(u16(bmp, 28)).toBe(1); // bits per pixel
		expect(u32(bmp, 30)).toBe(0); // BI_RGB
		expect(u32(bmp, 46)).toBe(2); // colours used
	});

	it('stores the requested DPI as pixels-per-metre', () => {
		const bmp = encodeMonochromeBmp(solid(8, 1, 0, 0, 0), { dpi: 300 });
		expect(i32(bmp, 38)).toBe(11811); // 300 dpi → 11811 px/m (matches P-touch templates)
		expect(i32(bmp, 42)).toBe(11811);
	});

	it('pads each row to a 4-byte boundary', () => {
		// width 8 → 1 byte/row → padded to 4 bytes; height 3 → imageSize 12
		const bmp = encodeMonochromeBmp(solid(8, 3, 255, 255, 255));
		expect(u32(bmp, 34)).toBe(12); // biSizeImage
		expect(bmp.length).toBe(14 + 40 + 8 + 12);
	});

	it('maps white pixels to set bits (index 1) and black to clear bits (index 0)', () => {
		const white = encodeMonochromeBmp(solid(8, 1, 255, 255, 255));
		const black = encodeMonochromeBmp(solid(8, 1, 0, 0, 0));
		const dataStart = 14 + 40 + 8;
		expect(white[dataStart]).toBe(0xff); // all white → all bits set
		expect(black[dataStart]).toBe(0x00); // all black → all bits clear
	});

	it('thresholds mid-grey by the given cutoff', () => {
		const grey = solid(8, 1, 100, 100, 100); // luma 100
		const belowStart = 14 + 40 + 8;
		expect(encodeMonochromeBmp(grey, { threshold: 128 })[belowStart]).toBe(0x00); // 100 < 128 → black
		expect(encodeMonochromeBmp(grey, { threshold: 64 })[belowStart]).toBe(0xff); // 100 ≥ 64 → white
	});

	it('treats fully transparent pixels as white', () => {
		const transparent = solid(8, 1, 0, 0, 0, 0); // black but alpha 0
		const dataStart = 14 + 40 + 8;
		expect(encodeMonochromeBmp(transparent)[dataStart]).toBe(0xff);
	});

	it('packs pixels MSB-first within a byte', () => {
		// 8x1: first pixel black, rest white → 0b01111111 = 0x7F
		const data = new Uint8Array(8 * 4);
		for (let x = 0; x < 8; x++) {
			const v = x === 0 ? 0 : 255;
			data[x * 4] = v;
			data[x * 4 + 1] = v;
			data[x * 4 + 2] = v;
			data[x * 4 + 3] = 255;
		}
		const bmp = encodeMonochromeBmp({ width: 8, height: 1, data });
		expect(bmp[14 + 40 + 8]).toBe(0x7f);
	});

	it('rejects non-positive dimensions', () => {
		expect(() => encodeMonochromeBmp({ width: 0, height: 1, data: [] })).toThrow();
	});
});
