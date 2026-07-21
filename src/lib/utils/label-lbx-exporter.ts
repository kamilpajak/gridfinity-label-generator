/**
 * Export a single label to a Brother P-touch `.lbx` file.
 *
 * The label is rendered with the same canvas pipeline as the PNG export, then
 * baked into a 1-bit BMP and embedded as an `image:image` object. P-touch opens
 * it on the correct tape showing a pixel-perfect copy of the app's label — no
 * font substitution, no lost characters (the `×` survives because it is pixels,
 * not text).
 */
import { renderLabelToExportCanvas, type CanvasExportOptions } from './label-exporter';
import { encodeMonochromeBmp } from './lbx/bmp';
import { buildImageLabelXml } from './lbx/label-xml';
import { buildPropXml } from './lbx/prop-xml';
import { buildLbxBlob } from './lbx/lbx-zip';

/** Margins (mm) matching the PNG export crop; the rendered canvas excludes them. */
const EXPORT_MARGINS = { left: 2, right: 2, top: 1, bottom: 1 };
const BMP_FILE = 'Object0.bmp';

/** Build the `.lbx` Blob for a single label (renders to canvas → 1-bit BMP → ZIP). */
export async function buildSingleLabelLbx(options: CanvasExportOptions): Promise<Blob> {
	const { canvas, printableWidth, printableHeight } = await renderLabelToExportCanvas(options);

	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable');
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const bmp = encodeMonochromeBmp(imageData, { dpi: options.dpi ?? 360 });

	const margins = options.margins ?? EXPORT_MARGINS;
	const labelXml = buildImageLabelXml({
		tapeHeightMm: options.labelHeight as 9 | 12,
		labelLengthMm: options.labelWidth,
		image: {
			fileName: BMP_FILE,
			xMm: margins.left,
			yMm: margins.top,
			widthMm: printableWidth,
			heightMm: printableHeight
		}
	});
	const propXml = buildPropXml({ title: lbxTitle(options) });

	return buildLbxBlob({ 'label.xml': labelXml, 'prop.xml': propXml, [BMP_FILE]: bmp });
}

/** A human-friendly document title for `prop.xml`. */
function lbxTitle(options: CanvasExportOptions): string {
	return options.primaryText?.trim() || options.secondaryText?.trim() || 'label';
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
export async function exportSingleLabelAsLbx(options: CanvasExportOptions): Promise<void> {
	const blob = await buildSingleLabelLbx(options);
	const name = `${lbxFileName(lbxTitle(options))}.lbx`;
	downloadBlob(blob, name);
}
