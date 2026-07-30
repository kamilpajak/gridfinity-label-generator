/**
 * Units and per-tape geometry for Brother P-touch `.lbx` generation.
 *
 * `.lbx` coordinates are in points. Values here were verified in Phase 0 by
 * generating a `.lbx` from scratch and opening it in P-touch Editor (see
 * docs/plan-lbx-export.md): a 12 mm label with the paper block below renders
 * correctly on a 12 mm tape. Element order and compact (no-whitespace) XML are
 * required — see label-xml.ts.
 */

/** Points per millimetre (72 pt / 25.4 mm). */
export const PT_PER_MM = 72 / 25.4;

/** Convert a millimetre value to points, rounded to one decimal (as P-touch does). */
export function mmToPt(mm: number): number {
	return Math.round(mm * PT_PER_MM * 10) / 10;
}

export interface TapeSpec {
	/** Paper `width` in pt = the physical tape width (the short dimension). */
	paperWidthPt: number;
	/** P-touch paper `format` code for this tape width. */
	format: string;
	/** Leading/trailing margin along the length axis (pt). */
	marginLengthPt: number;
	/** Margin on the tape-width axis, top and bottom (pt). */
	marginWidthPt: number;
	/** Printable band offset + height on the tape-width axis (pt). */
	bandYPt: number;
	bandHeightPt: number;
	/** Whether this spec has been validated in P-touch Editor. */
	validated: boolean;
}

/**
 * Per-tape geometry, keyed by the app's `TapeHeight` (9 | 12 mm).
 * 12 mm is validated (Phase 0); 9 mm is scaled from it and awaits validation.
 */
export const TAPE_SPECS: Record<number, TapeSpec> = {
	12: {
		paperWidthPt: 34,
		format: '259',
		marginLengthPt: 2,
		marginWidthPt: 11.3,
		bandYPt: 11.3,
		bandHeightPt: 11.4,
		validated: true
	},
	9: {
		paperWidthPt: 25.6,
		format: '258',
		marginLengthPt: 2,
		marginWidthPt: 8.5,
		bandYPt: 8.5,
		bandHeightPt: 8.6,
		validated: false
	}
};

/** The printer whose paper blocks the templates use; P-touch remaps to the user's printer on open. */
export const PT_PRINTER_ID = '18992';
export const PT_PRINTER_NAME = 'Brother PT-9500PC';

/**
 * C0 control characters that XML 1.0 forbids in text content. Tab (0x09), LF
 * (0x0A) and CR (0x0D) are allowed and kept; everything else in 0x00–0x1F plus
 * DEL (0x7F) is stripped. P-touch rejects a `.lbx` whose text carries raw
 * control bytes, so we remove them before escaping.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Escape a string for use in XML text or attribute content. */
export function xmlEscape(value: string): string {
	return value
		.replace(CONTROL_CHARS, '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Count of code points (P-touch `stringItem charLen` counts characters, not UTF-8 bytes). */
export function charLength(text: string): number {
	return [...text].length;
}
