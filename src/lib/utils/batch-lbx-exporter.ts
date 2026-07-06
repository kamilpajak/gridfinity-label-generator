/**
 * Export a batch of labels to a single Brother P-touch `.lbx` file.
 *
 * The batch is rendered as one continuous strip (the same canvas as the PNG
 * batch export), baked into a 1-bit BMP, and embedded as a single `image:image`
 * object on one long sheet. The user opens ONE file that prints all labels
 * side-by-side — no per-label files, no database/CSV, and the `×` survives
 * because it is pixels, not text. See docs/plan-lbx-export.md ("Batch route
 * investigation") for why this beats the database/multi-sheet routes.
 */
import { renderBatchTape } from './batch-renderer';
import type { BatchRenderData } from '$lib/types/batch';
import { encodeMonochromeBmp } from './lbx/bmp';
import { buildImageLabelXml } from './lbx/label-xml';
import { buildPropXml } from './lbx/prop-xml';
import { buildLbxBlob } from './lbx/lbx-zip';
import { downloadBlob } from './label-lbx-exporter';

const DEFAULT_DPI = 360;
/** Leading/trailing blank margin on the strip (mm), matching the single-label export. */
const END_MARGIN_MM = 2;
const TOP_MARGIN_MM = 1;
const BMP_FILE = 'Object0.bmp';

export interface BatchLbxExportOptions {
	batch: BatchRenderData;
	dpi?: number;
}

/** Build the batch `.lbx` Blob (renders the strip → 1-bit BMP → ZIP). */
export async function buildBatchLbx(options: BatchLbxExportOptions): Promise<Blob> {
	const { batch, dpi = DEFAULT_DPI } = options;
	if (batch.labels.length === 0) throw new Error('Cannot export empty batch');

	const canvas = document.createElement('canvas');
	await renderBatchTape({ canvas, batch, dpi, showMargins: false });

	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable');
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const bmp = encodeMonochromeBmp(imageData, { dpi });

	// Physical size derived from the rendered strip (printable area, no margins).
	const pxToMm = 25.4 / dpi;
	const stripLengthMm = canvas.width * pxToMm;
	const stripHeightMm = canvas.height * pxToMm;

	const labelXml = buildImageLabelXml({
		tapeHeightMm: batch.height,
		labelLengthMm: stripLengthMm + END_MARGIN_MM * 2,
		image: {
			fileName: BMP_FILE,
			xMm: END_MARGIN_MM,
			yMm: TOP_MARGIN_MM,
			widthMm: stripLengthMm,
			heightMm: stripHeightMm
		}
	});
	const propXml = buildPropXml({ title: `Batch (${batch.labels.length} labels)` });

	return buildLbxBlob({ 'label.xml': labelXml, 'prop.xml': propXml, [BMP_FILE]: bmp });
}

/** File-name stem for a batch `.lbx`, e.g. `batch_5_labels.lbx`. */
export function batchLbxFileName(labelCount: number): string {
	return `batch_${labelCount}_labels.lbx`;
}

/** Build and download the batch as a single `.lbx`. */
export async function exportBatchTapeAsLbx(options: BatchLbxExportOptions): Promise<void> {
	const blob = await buildBatchLbx(options);
	downloadBlob(blob, batchLbxFileName(options.batch.labels.length));
}
