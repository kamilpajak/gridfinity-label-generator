<script lang="ts">
	import { onMount } from 'svelte';
	import { renderBatchTape } from '$lib/utils/batch-renderer';
	import { exportBatchTapeAsPNG } from '$lib/utils/batch-exporter';
	import type { BatchRenderData } from '$lib/types/batch';

	let canvas: HTMLCanvasElement;
	let status = 'Ready to render';
	let error = '';

	// Hard-coded batch for visual validation
	const testBatch: BatchRenderData = {
		height: 12,
		labels: [
			{
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M5',
				length: 20,
				width: 40,
				standard: 'ISO 4017',
				note: 'Test note'
			},
			{
				mode: 'general',
				primaryText: 'RESISTOR',
				secondaryText: '10kΩ ±5%',
				width: 45
			},
			{
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M8',
				length: 35,
				width: 50,
				standard: 'DIN 933'
			},
			{
				mode: 'general',
				primaryText: 'CAPACITOR',
				secondaryText: '100µF 25V',
				width: 35,
				qrCode: 'https://example.com'
			},
			{
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M2.5',
				length: 30,
				width: 35,
				standard: 'ISO 14580',
				note: 'Regression: text clipping bug'
			}
		]
	};

	async function renderTest() {
		try {
			status = 'Rendering...';
			error = '';
			await renderBatchTape({
				canvas,
				batch: testBatch,
				dpi: 300,
				showMargins: true
			});
			status = 'Rendered successfully! Check the canvas below.';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			status = 'Render failed';
			console.error('Render error:', e);
		}
	}

	function downloadPNG() {
		try {
			const link = document.createElement('a');
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
			link.download = `batch_test_${timestamp}.png`;
			link.href = canvas.toDataURL('image/png');
			link.click();
			status = 'Downloaded!';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			console.error('Download error:', e);
		}
	}

	async function exportBatch() {
		try {
			status = 'Exporting...';
			error = '';
			await exportBatchTapeAsPNG({
				batch: testBatch,
				dpi: 300
			});
			status = 'Export complete! Check your downloads folder.';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			status = 'Export failed';
			console.error('Export error:', e);
		}
	}

	onMount(() => {
		renderTest();
	});
</script>

<div class="container">
	<h1>Batch Mode Visual Test</h1>

	<div class="info">
		<h2>Test Configuration</h2>
		<ul>
			<li>Tape Height: {testBatch.height}mm</li>
			<li>Number of Labels: {testBatch.labels.length}</li>
			<li>DPI: 300</li>
			<li>Gap between labels: 4mm (2mm + 2mm margins)</li>
		</ul>

		<h3>Labels:</h3>
		<ol>
			{#each testBatch.labels as label, i (i)}
				<li>
					{#if label.mode === 'fastener'}
						<strong>Fastener:</strong>
						{label.threadSize} × {label.length}mm | {label.standard || 'No standard'} | Width: {label.width}mm
					{:else}
						<strong>General:</strong>
						{label.primaryText}
						{#if label.secondaryText}/ {label.secondaryText}{/if} | Width: {label.width}mm
						{#if label.qrCode}| QR: {label.qrCode}{/if}
					{/if}
				</li>
			{/each}
		</ol>
	</div>

	<div class="controls">
		<button onclick={renderTest}>Re-render</button>
		<button onclick={downloadPNG}>Download PNG (Basic)</button>
		<button onclick={exportBatch}>Export Batch (Production)</button>
	</div>

	<div class="status">
		<strong>Status:</strong>
		{status}
		{#if error}
			<div class="error">Error: {error}</div>
		{/if}
	</div>

	<div class="canvas-container">
		<h2>Output Preview:</h2>
		<canvas bind:this={canvas}></canvas>
	</div>

	<div class="instructions">
		<h2>Visual Validation Checklist:</h2>
		<ul>
			<li>✓ Are cutting lines visible and dashed?</li>
			<li>✓ Are cutting lines positioned between labels (not on edges)?</li>
			<li>✓ Is the gap between labels approximately 4mm (2mm margins on each side)?</li>
			<li>✓ Are labels readable at actual print size?</li>
			<li>✓ Do different label modes render correctly?</li>
			<li>✓ Is the overall layout horizontal?</li>
			<li>✓ Download PNG and view at 100% zoom to check print quality</li>
		</ul>
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 2rem auto;
		padding: 2rem;
		font-family: system-ui, sans-serif;
	}

	h1 {
		color: #333;
		border-bottom: 2px solid #333;
		padding-bottom: 0.5rem;
	}

	h2 {
		color: #555;
		margin-top: 1.5rem;
	}

	.info {
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		margin: 1rem 0;
	}

	.info ul,
	.info ol {
		margin: 0.5rem 0;
	}

	.info li {
		margin: 0.25rem 0;
	}

	.controls {
		margin: 1rem 0;
		display: flex;
		gap: 1rem;
	}

	button {
		padding: 0.5rem 1rem;
		font-size: 1rem;
		cursor: pointer;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
	}

	button:hover {
		background: #0056b3;
	}

	.status {
		padding: 1rem;
		background: #e9ecef;
		border-radius: 4px;
		margin: 1rem 0;
	}

	.error {
		color: red;
		margin-top: 0.5rem;
		font-family: monospace;
	}

	.canvas-container {
		margin: 2rem 0;
		overflow-x: auto;
		background: #888;
		padding: 2rem;
		border-radius: 4px;
	}

	canvas {
		display: block;
		background: white;
		max-width: 100%;
	}

	.instructions {
		background: #fff3cd;
		padding: 1rem;
		border-radius: 4px;
		border-left: 4px solid #ffc107;
	}

	.instructions ul {
		margin: 0.5rem 0;
	}

	.instructions li {
		margin: 0.25rem 0;
	}
</style>
