/**
 * Tests for the image-wrapped `.lbx` exporters (single + batch).
 *
 * The heavy canvas renderers are mocked; the exporters' own logic (read pixels →
 * 1-bit BMP → build XML → ZIP → download) runs for real against a mock canvas.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import type { BatchRenderData } from '$lib/types/batch';

vi.mock('./label-exporter', () => ({ renderLabelToExportCanvas: vi.fn() }));
vi.mock('./batch-renderer', () => ({ renderBatchTape: vi.fn() }));

import { renderLabelToExportCanvas, type CanvasExportOptions } from './label-exporter';
import { renderBatchTape } from './batch-renderer';
import { buildSingleLabelLbx, exportSingleLabelAsLbx } from './label-lbx-exporter';
import { buildBatchLbx, batchLbxFileName, exportBatchTapeAsLbx } from './batch-lbx-exporter';

/** A mock canvas whose pixels are all white, exposing getImageData. */
function mockCanvas(width: number, height: number): HTMLCanvasElement {
	const data = new Uint8ClampedArray(width * height * 4).fill(255);
	return {
		width,
		height,
		getContext: () => ({ getImageData: () => ({ width, height, data }) })
	} as unknown as HTMLCanvasElement;
}

const SINGLE_OPTS = {
	labelWidth: 35,
	labelHeight: 12,
	primaryText: 'M8 × 20',
	secondaryText: 'ISO 4762',
	showStandard: true,
	showHardwareImage: true,
	showQRCode: false,
	labelMode: 'fastener'
} as unknown as CanvasExportOptions;

async function entries(blob: Blob): Promise<Record<string, Uint8Array>> {
	return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

describe('image-wrapped .lbx exporters', () => {
	let clickSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.mocked(renderLabelToExportCanvas).mockResolvedValue({
			canvas: mockCanvas(439, 142),
			printableWidth: 31,
			printableHeight: 10
		});
		vi.mocked(renderBatchTape).mockResolvedValue(undefined as never);

		clickSpy = vi.fn();
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			if (tag === 'canvas') return mockCanvas(1431, 142);
			if (tag === 'a')
				return { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
			return document.createElement(tag);
		});
		vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
		vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);
		window.URL.createObjectURL = vi.fn(() => 'blob:mock');
		window.URL.revokeObjectURL = vi.fn();
	});

	afterEach(() => vi.restoreAllMocks());

	it('buildSingleLabelLbx wraps the rendered canvas as one image object', async () => {
		const files = await entries(await buildSingleLabelLbx(SINGLE_OPTS));
		expect(Object.keys(files).sort()).toEqual(['Object0.bmp', 'label.xml', 'prop.xml']);
		const xml = strFromU8(files['label.xml']);
		expect((xml.match(/<image:image>/g) || []).length).toBe(1);
		expect(xml).not.toContain('<text:text>');
		expect(files['Object0.bmp'][0]).toBe(0x42); // 'B' — real BMP
	});

	it('exportSingleLabelAsLbx downloads a named .lbx', async () => {
		await exportSingleLabelAsLbx(SINGLE_OPTS);
		expect(clickSpy).toHaveBeenCalledOnce();
	});

	it('buildBatchLbx renders one strip and embeds a single image', async () => {
		const batch = { height: 12, maxLabels: 20, labels: [{}, {}, {}] } as unknown as BatchRenderData;
		const files = await entries(await buildBatchLbx({ batch }));
		expect(Object.keys(files)).toContain('Object0.bmp');
		expect(renderBatchTape).toHaveBeenCalledOnce();
		const xml = strFromU8(files['label.xml']);
		expect((xml.match(/<image:image>/g) || []).length).toBe(1);
		expect(xml).toContain('width="34pt"'); // 12 mm tape
	});

	it('buildBatchLbx rejects an empty batch', async () => {
		const batch = { height: 12, maxLabels: 20, labels: [] } as unknown as BatchRenderData;
		await expect(buildBatchLbx({ batch })).rejects.toThrow();
	});

	it('exportBatchTapeAsLbx downloads a batch .lbx', async () => {
		const batch = { height: 9, maxLabels: 20, labels: [{}] } as unknown as BatchRenderData;
		await exportBatchTapeAsLbx({ batch });
		expect(clickSpy).toHaveBeenCalledOnce();
	});

	it('batchLbxFileName includes the label count', () => {
		expect(batchLbxFileName(5)).toBe('batch_5_labels.lbx');
	});
});
