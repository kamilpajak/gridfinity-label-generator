<script lang="ts">
	import type { BatchLabelConfig, TapeHeight } from '$lib/types/batch';
	import { deriveLabelText, renderBatchLabelToCanvas } from '$lib/utils/batch-renderer';

	interface Props {
		config: BatchLabelConfig;
		height: TapeHeight;
		/** Row index, used only for test ids. */
		index: number;
	}

	let { config, height, index }: Props = $props();

	// On-screen size: px = mm * SCALE, so a 35mm/12mm chip renders small but
	// true-to-shape. The canvas backing store carries the real render at CHIP_DPI.
	const SCALE = 4;
	// Modest DPI: chips are tiny on screen, so ~2x the display size is plenty sharp
	// while keeping 20 concurrent renders cheap (existing image/svg/qr caches help).
	const CHIP_DPI = 200;

	const heightPx = $derived(height * SCALE);
	const widthPx = $derived(config.width * SCALE);
	// Printable area (label minus 2mm side + 1mm top/bottom margins); the surrounding
	// white box supplies the margins so the chip matches the printed tape 1:1.
	const printableWidthPx = $derived((config.width - 4) * SCALE);
	const printableHeightPx = $derived((height - 2) * SCALE);

	// Kept only for the visually-hidden text hook used by e2e.
	const text = $derived(deriveLabelText(config));

	let canvasEl = $state<HTMLCanvasElement | undefined>();
	let renderToken = 0;
	// Serialize renders per chip and skip superseded ones so a slow render never
	// clobbers a newer one on the same canvas.
	let inFlight: Promise<void> = Promise.resolve();

	$effect(() => {
		const el = canvasEl;
		const cfg = config;
		const h = height;
		if (!el || typeof document === 'undefined') return;

		const token = ++renderToken;
		inFlight = inFlight
			.then(async () => {
				if (token !== renderToken) return; // superseded before it started
				await renderBatchLabelToCanvas({ canvas: el, config: cfg, height: h, dpi: CHIP_DPI });
			})
			.catch((e) => {
				console.warn('Failed to render batch chip preview:', e);
			});
	});
</script>

<div
	class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-white shadow-md"
	style="height: {heightPx}px; width: {widthPx}px;"
	data-testid="batch-chip-{index}"
>
	<canvas bind:this={canvasEl} style="width: {printableWidthPx}px; height: {printableHeightPx}px;"
	></canvas>

	<!-- Visually-hidden text hook: keeps e2e assertions on chip text working while
	     the visible label is a canvas render. -->
	<span class="sr-only" data-testid="batch-chip-primary-{index}">{text.primaryText}</span>
</div>
