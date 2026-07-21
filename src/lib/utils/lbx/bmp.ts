/**
 * Encode canvas pixels as a 1-bit (monochrome) Windows BMP.
 *
 * Brother P-touch `.lbx` files embed images as a separate 1-bit BMP entry
 * (`Object0.bmp`) — this is the printer's native thermal format, so black text,
 * line art, and QR codes stay crisp. We render the label to a canvas (the same
 * pipeline as the PNG export) and convert it here.
 *
 * The encoder is pure (no DOM): it takes an `ImageData`-shaped source so it can
 * be unit-tested in Node and reused with `ctx.getImageData(...)` in the browser.
 */

/** Minimal `ImageData`-shaped input (matches the browser `ImageData`). */
export interface RgbaImage {
	width: number;
	height: number;
	/** RGBA bytes, row-major, length = width * height * 4. */
	data: Uint8ClampedArray | Uint8Array | number[];
}

export interface BmpOptions {
	/** Luminance cutoff (0–255): pixels below become black. Default 128. */
	threshold?: number;
	/** Dots per inch stored in the BMP header. Default 300 (P-touch native). */
	dpi?: number;
}

/** 300 DPI in pixels-per-metre, as P-touch's own templates store it. */
const DEFAULT_DPI = 300;
const DEFAULT_THRESHOLD = 128;
const BI_RGB = 0;
const FILE_HEADER = 14;
const INFO_HEADER = 40;
const PALETTE = 8; // two BGRA entries: black, white

/** Rec. 601 luma weights (integer-friendly), matching common canvas→mono conversions. */
function luminance(r: number, g: number, b: number): number {
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Convert an RGBA image to a 1-bit BMP byte array.
 *
 * Bit = 1 → white (palette index 1), bit = 0 → black (index 0). Fully
 * transparent pixels are treated as white. Rows are stored bottom-up and padded
 * to a 4-byte boundary, per the BMP spec.
 */
export function encodeMonochromeBmp(img: RgbaImage, options: BmpOptions = {}): Uint8Array {
	const { width, height, data } = img;
	if (width <= 0 || height <= 0) throw new Error('BMP dimensions must be positive');

	const threshold = options.threshold ?? DEFAULT_THRESHOLD;
	const ppm = Math.round(((options.dpi ?? DEFAULT_DPI) * 1000) / 25.4); // px per metre

	const rowBytes = Math.ceil(width / 8);
	const rowStride = (rowBytes + 3) & ~3; // pad each row to 4 bytes
	const imageSize = rowStride * height;
	const dataOffset = FILE_HEADER + INFO_HEADER + PALETTE;
	const fileSize = dataOffset + imageSize;

	const buf = new Uint8Array(fileSize);
	const dv = new DataView(buf.buffer);
	let o = 0;

	// BITMAPFILEHEADER
	buf[o++] = 0x42; // 'B'
	buf[o++] = 0x4d; // 'M'
	dv.setUint32(o, fileSize, true);
	o += 4;
	dv.setUint32(o, 0, true);
	o += 4; // reserved
	dv.setUint32(o, dataOffset, true);
	o += 4;

	// BITMAPINFOHEADER
	dv.setUint32(o, INFO_HEADER, true);
	o += 4;
	dv.setInt32(o, width, true);
	o += 4;
	dv.setInt32(o, height, true);
	o += 4; // positive height → bottom-up rows
	dv.setUint16(o, 1, true);
	o += 2; // planes
	dv.setUint16(o, 1, true);
	o += 2; // bits per pixel
	dv.setUint32(o, BI_RGB, true);
	o += 4; // no compression
	dv.setUint32(o, imageSize, true);
	o += 4;
	dv.setInt32(o, ppm, true);
	o += 4; // x px/m
	dv.setInt32(o, ppm, true);
	o += 4; // y px/m
	dv.setUint32(o, 2, true);
	o += 4; // colours used
	dv.setUint32(o, 2, true);
	o += 4; // important colours

	// Palette (BGRA): index 0 = black, index 1 = white
	buf[o++] = 0x00;
	buf[o++] = 0x00;
	buf[o++] = 0x00;
	buf[o++] = 0x00;
	buf[o++] = 0xff;
	buf[o++] = 0xff;
	buf[o++] = 0xff;
	buf[o++] = 0x00;

	// Pixel rows, bottom-up
	for (let y = height - 1; y >= 0; y--) {
		const rowStart = o;
		for (let bx = 0; bx < rowBytes; bx++) {
			let byte = 0;
			for (let bit = 0; bit < 8; bit++) {
				const x = bx * 8 + bit;
				let white = 1;
				if (x < width) {
					const i = (y * width + x) * 4;
					const alpha = data[i + 3];
					const lum = alpha === 0 ? 255 : luminance(data[i], data[i + 1], data[i + 2]);
					white = lum >= threshold ? 1 : 0;
				}
				byte |= white << (7 - bit);
			}
			buf[rowStart + bx] = byte;
		}
		o += rowStride;
	}

	return buf;
}
