<script lang="ts">
	import { onMount } from 'svelte';
	import { renderLabelToCanvas } from '$lib/utils/label-renderer';
	import { solveLabelLayout } from '$lib/utils/label-constraint-solver';
	import { renderBatchTape } from '$lib/utils/batch-renderer';
	import type { BatchState } from '$lib/types/batch';

	let status = $state('Ready');
	let singleCanvas: HTMLCanvasElement;
	let batchCanvas: HTMLCanvasElement;

	// Test configuration
	const testConfig = {
		mode: 'general',
		primaryText: 'RESISTOR',
		secondaryText: '10kΩ ±5%',
		width: 45,
		height: 12,
		dpi: 300,
		showStandard: false,
		showHardwareImage: false,
		showQRCode: false
	};

	async function renderBothModes() {
		try {
			status = 'Rendering single mode...';

			// === SINGLE MODE ===
			const margins = { left: 2, right: 2, top: 1, bottom: 1 };
			const printableWidth = testConfig.width - margins.left - margins.right;
			const printableHeight = testConfig.height - margins.top - margins.bottom;
			const scale = testConfig.dpi / 25.4;

			singleCanvas.width = Math.round(printableWidth * scale);
			singleCanvas.height = Math.round(printableHeight * scale);

			const dimensions = {
				width: testConfig.width,
				height: testConfig.height,
				printableWidth,
				printableHeight
			};

			const layout = await solveLabelLayout({
				dimensions,
				showQRCode: testConfig.showQRCode,
				showHardwareImage: testConfig.showHardwareImage,
				showStandard: testConfig.showStandard,
				primaryText: testConfig.primaryText,
				secondaryText: testConfig.secondaryText
			});

			await renderLabelToCanvas({
				canvas: singleCanvas,
				dimensions,
				layout,
				content: {
					primaryText: testConfig.primaryText,
					secondaryText: testConfig.secondaryText,
					showStandard: testConfig.showStandard,
					showHardwareImage: testConfig.showHardwareImage,
					showQRCode: testConfig.showQRCode
				},
				scale,
				showMargins: false
			});

			status = 'Rendering batch mode...';

			// === BATCH MODE ===
			const batch: BatchState = {
				height: testConfig.height as 9 | 12,
				labels: [
					{
						mode: 'general',
						primaryText: testConfig.primaryText,
						secondaryText: testConfig.secondaryText,
						width: testConfig.width
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({
				canvas: batchCanvas,
				batch,
				dpi: testConfig.dpi,
				showMargins: false
			});

			status = 'Rendered successfully';
		} catch (e) {
			status = `Error: ${e instanceof Error ? e.message : String(e)}`;
			console.error(e);
		}
	}

	onMount(() => {
		renderBothModes();
	});

	// Expose function for Playwright to get canvas data
	if (typeof window !== 'undefined') {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(window as any).getSingleCanvasData = () => {
			const ctx = singleCanvas.getContext('2d')!;
			const imageData = ctx.getImageData(0, 0, singleCanvas.width, singleCanvas.height);
			return {
				width: singleCanvas.width,
				height: singleCanvas.height,
				data: Array.from(imageData.data)
			};
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(window as any).getBatchCanvasData = () => {
			const ctx = batchCanvas.getContext('2d')!;
			// Batch canvas now contains ONLY printable area (no margins)
			// Layout: [printable label 1] [1mm gap] [printable label 2] ...
			// We extract only the first label (no gap)
			const margins = { left: 2, right: 2, top: 1, bottom: 1 };
			const printableWidth = testConfig.width - margins.left - margins.right;
			const printableHeight = testConfig.height - margins.top - margins.bottom;

			const scale = testConfig.dpi / 25.4;
			const labelWidth = Math.round(printableWidth * scale);
			const labelHeight = Math.round(printableHeight * scale);

			// Extract first label (starts at x=0 now, since canvas is printable area only)
			const imageData = ctx.getImageData(0, 0, labelWidth, labelHeight);
			return {
				width: labelWidth,
				height: labelHeight,
				data: Array.from(imageData.data)
			};
		};
	}
</script>

<div data-testid="render-comparison-page">
	<h1>Render Comparison Test Page</h1>
	<p data-testid="status">{status}</p>

	<div style="display: flex; gap: 20px; margin-top: 20px;">
		<div>
			<h2>Single Mode</h2>
			<canvas bind:this={singleCanvas} data-testid="single-canvas"></canvas>
		</div>
		<div>
			<h2>Batch Mode</h2>
			<canvas bind:this={batchCanvas} data-testid="batch-canvas"></canvas>
		</div>
	</div>
</div>
