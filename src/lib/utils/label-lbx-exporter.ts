/**
 * Export a single label to a Brother P-touch `.lbx` file (editable in P-touch
 * Editor), mirroring the PNG export. Phase 1: one text line on 9/12 mm tape.
 * QR codes, custom images, and multi-line/secondary text come in later phases.
 */
import { buildLabelXml } from './lbx/label-xml';
import { buildPropXml } from './lbx/prop-xml';
import { buildLbxBlob } from './lbx/lbx-zip';

export interface LbxExportOptions {
	/** The single line of label text (already formatted, e.g. "M8 × 20 DIN 912"). */
	text: string;
	/** Tape width in mm (9 or 12). */
	tapeHeightMm: 9 | 12;
	/** Label length along the tape, in mm. */
	labelLengthMm: number;
	/** Optional file name (without extension); defaults to a slug of the text. */
	fileName?: string;
}

/** Build the `.lbx` Blob (pure — no DOM), so it is unit-testable. */
export function buildSingleLabelLbx(options: LbxExportOptions): Blob {
	const labelXml = buildLabelXml({
		text: options.text,
		tapeHeightMm: options.tapeHeightMm,
		labelLengthMm: options.labelLengthMm
	});
	const propXml = buildPropXml({ title: options.text });
	return buildLbxBlob({ 'label.xml': labelXml, 'prop.xml': propXml });
}

/** Turn label text into a safe file-name stem. */
export function lbxFileName(text: string): string {
	const slug = text
		.replace(/[×✕]/g, 'x')
		.replace(/[^\w.-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
	return slug || 'label';
}

/** Trigger a browser download of a Blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/** Build and download a single label as `.lbx`. */
export function exportSingleLabelAsLbx(options: LbxExportOptions): void {
	const blob = buildSingleLabelLbx(options);
	const name = `${options.fileName ?? lbxFileName(options.text)}.lbx`;
	downloadBlob(blob, name);
}
