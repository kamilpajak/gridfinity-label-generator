<script lang="ts">
	import '@fontsource/noto-sans/900.css'; // Import Noto Sans Black 900
	import '@fontsource/oswald/300.css'; // Import Oswald Light 300
	import { onMount } from 'svelte';
	import type { ISODINStandard } from '$lib/data/standards';
	import { AspectRatio } from '$lib/components/ui/aspect-ratio';
	import TagIcon from '@lucide/svelte/icons/tag';
	import {
		solveLabelLayout,
		type LabelDimensions,
		type SolverOutput
	} from '$lib/utils/label-constraint-solver';
	import { renderLabelToCanvas } from '$lib/utils/label-renderer';

	interface Props {
		primaryText: string;
		secondaryText?: string;
		optionalNote?: string;
		standard?: ISODINStandard;
		showStandard: boolean;
		showHardwareImage: boolean;
		showQRCode: boolean;
		qrCodeUrl?: string;
		labelHeight: number; // 9 or 12 mm
		labelWidth: number; // 30-80 mm
		canvasRef?: HTMLCanvasElement | undefined;
	}

	let {
		primaryText,
		secondaryText,
		optionalNote,
		standard,
		showStandard,
		showHardwareImage,
		showQRCode,
		qrCodeUrl,
		labelHeight,
		labelWidth,
		canvasRef = $bindable()
	}: Props = $props();

	let container: HTMLDivElement;
	let scale = $state(1);

	// Check if we have any content to display
	const hasContent = $derived(
		primaryText?.trim() ||
			secondaryText?.trim() ||
			optionalNote?.trim() ||
			(showStandard && standard) ||
			(showQRCode && qrCodeUrl?.trim())
	);

	// Label dimensions
	// Physical label has margins: 2mm left/right, 1mm top/bottom
	const dimensions = $derived<LabelDimensions>({
		width: labelWidth,
		height: labelHeight,
		printableWidth: labelWidth - 4, // 2mm left + 2mm right margins
		printableHeight: labelHeight - 2 // 1mm top + 1mm bottom margins
	});

	// Prepare full secondary text including optional note
	const fullSecondaryText = $derived(
		(secondaryText ||
			(showStandard && standard
				? standard.designations.map((d) => `${d.system} ${d.code}`).join(' / ')
				: '')) + (optionalNote ? ` ${optionalNote}` : '')
	);

	// Calculate layout using constraint solver
	const layout = $derived<SolverOutput>(
		solveLabelLayout({
			dimensions,
			showQRCode,
			showHardwareImage,
			showStandard,
			primaryText: primaryText || '',
			secondaryText: fullSecondaryText
		})
	);

	// Render to canvas whenever dependencies change
	$effect(() => {
		if (!canvasRef || !container) return;

		// Set canvas size based on container and device pixel ratio
		const dpr = window.devicePixelRatio || 1;
		const rect = container.getBoundingClientRect();

		if (rect.width > 0 && rect.height > 0) {
			// Calculate scale to fit container
			scale = Math.min(rect.width / labelWidth, rect.height / labelHeight);

			// Set canvas size
			canvasRef.width = labelWidth * scale * dpr;
			canvasRef.height = labelHeight * scale * dpr;

			// Set display size
			canvasRef.style.width = `${labelWidth * scale}px`;
			canvasRef.style.height = `${labelHeight * scale}px`;

			// Render label
			renderLabelToCanvas({
				canvas: canvasRef,
				dimensions,
				layout,
				content: {
					primaryText: primaryText || '',
					secondaryText: fullSecondaryText,
					standard,
					showStandard,
					showHardwareImage,
					showQRCode,
					qrCodeUrl
				},
				scale: scale * dpr,
				showMargins: true
			}).catch((error) => {
				console.error('Failed to render label:', error);
			});
		}
	});

	onMount(() => {
		// Handle window resize
		const handleResize = () => {
			// Force a re-render by updating scale
			const temp = scale;
			scale = 0;
			scale = temp;
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});
</script>

<div class="label-preview-container w-full" bind:this={container}>
	<AspectRatio ratio={labelWidth / labelHeight}>
		{#if hasContent}
			<canvas
				bind:this={canvasRef}
				class="h-full w-full bg-white shadow-sm"
				style="image-rendering: crisp-edges;"
			></canvas>
		{:else}
			<div
				class="flex h-full w-full flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 bg-muted/50"
			>
				<TagIcon class="mb-3 h-12 w-12 text-muted-foreground/40" />
				<p class="text-sm font-medium text-muted-foreground">Enter text to preview your label</p>
				<p class="mt-1 text-xs text-muted-foreground/70">Start typing in the form above</p>
				<!-- Alternative: Show sample label with watermark
				<div class="mt-3 rounded border border-dashed border-muted-foreground/20 bg-muted/30 px-3 py-1">
					<p class="text-xs font-medium text-muted-foreground/50">Example: M8</p>
					<p class="text-xs text-muted-foreground/40">ISO 4762</p>
				</div>
				-->
			</div>
		{/if}
	</AspectRatio>

	<div class="mt-2 text-center text-xs text-muted-foreground">
		{#if hasContent}
			Preview: {labelWidth}mm × {labelHeight}mm (Printable: {dimensions.printableWidth}mm × {dimensions.printableHeight}mm)
		{:else}
			Label size: {labelWidth}mm × {labelHeight}mm
		{/if}
	</div>
</div>

<style>
	.label-preview-container {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
