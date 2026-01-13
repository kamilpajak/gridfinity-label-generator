<script lang="ts">
	// Fonts are now imported globally in app.css
	import { onMount, onDestroy } from 'svelte';
	import type { ISODINStandard } from '$lib/data/standards';
	import type { CustomImage } from '$lib/types/batch';
	import { AspectRatio } from '$lib/components/ui/aspect-ratio';
	import TagIcon from '@lucide/svelte/icons/tag';
	import {
		solveLabelLayout,
		type LabelDimensions,
		type SolverOutput
	} from '$lib/utils/label-constraint-solver';
	import { renderLabelToCanvas, resolveImageWithSvgPriority } from '$lib/utils/label-renderer';
	import { enrichWithCoverageMetrics } from '$lib/utils/layout-metrics';

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
		/** Custom image for general mode labels */
		customImage?: CustomImage;
		/** Whether to show custom image on label */
		showCustomImage?: boolean;
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
		canvasRef = $bindable(),
		customImage,
		showCustomImage = false
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

	// Determine if we're in General Item mode (no hardware standard selected)
	const isGeneralItemMode = $derived(!standard);

	// Prepare full secondary text including optional note
	const fullSecondaryText = $derived(
		(
			(secondaryText ||
				(showStandard && standard
					? (() => {
							// Use only the primary designation for the label
							const primaryDesignation = standard.designations.find(
								(d) => d.system === standard.primarySystem
							);
							if (primaryDesignation) {
								return `${primaryDesignation.system} ${primaryDesignation.code}`;
							}
							// Fallback to first designation if primary not found
							return standard.designations.length > 0
								? `${standard.designations[0].system} ${standard.designations[0].code}`
								: '';
						})()
					: '')) + (optionalNote ? ` ${optionalNote}` : '')
		).trim()
	);

	// Calculate layout using constraint solver
	let layout = $state<SolverOutput | null>(null);
	let isCalculatingLayout = $state(false);
	let layoutController: AbortController | null = null;
	let renderController: AbortController | null = null;

	// Calculate layout when dependencies change
	$effect(() => {
		// Explicitly track dependencies to ensure re-calculation when they change
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		primaryText;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		fullSecondaryText;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		showQRCode;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		showHardwareImage;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		showStandard;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		standard;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		dimensions;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		customImage;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		showCustomImage;

		const calculateLayout = async () => {
			// Cancel any previous layout calculation
			if (layoutController) {
				layoutController.abort();
			}

			// Create new controller for this calculation
			layoutController = new AbortController();
			const signal = layoutController.signal;

			isCalculatingLayout = true;
			try {
				// Check if aborted before starting expensive calculation
				if (signal.aborted) {
					return;
				}

				// Calculate image aspect ratio based on mode
				let hardwareImageAspectRatio: number | undefined;

				if (isGeneralItemMode && showCustomImage && customImage) {
					// General Item mode with custom image - use custom image aspect ratio
					hardwareImageAspectRatio = customImage.aspectRatio;
				} else if (!isGeneralItemMode && showHardwareImage && standard?.image) {
					// Fastener mode with standard image - load with SVG priority
					const resolved = await resolveImageWithSvgPriority(standard.image!);
					if (resolved.image) {
						hardwareImageAspectRatio = resolved.image.naturalWidth / resolved.image.naturalHeight;
					}
				}

				// Determine effective show flags for layout solver
				// In General Item mode, use custom image; in Fastener mode, use hardware image
				const effectiveShowImage = isGeneralItemMode
					? showCustomImage && !!customImage
					: showHardwareImage;
				const effectiveShowStandard = isGeneralItemMode ? false : showStandard;

				const baseLayout = await solveLabelLayout({
					dimensions,
					showQRCode,
					showHardwareImage: effectiveShowImage,
					showStandard: effectiveShowStandard,
					primaryText: primaryText || '',
					secondaryText: fullSecondaryText,
					hardwareImageAspectRatio
				});

				// Enrich with coverage metrics
				const newLayout = await enrichWithCoverageMetrics(baseLayout, dimensions, {
					primaryText: primaryText || '',
					secondaryText: fullSecondaryText,
					showHardwareImage,
					showQRCode
				});

				// Check if aborted after calculation but before setting layout
				if (signal.aborted) {
					return;
				}

				layout = newLayout;
			} catch (error) {
				if (error instanceof Error && error.message.includes('aborted')) {
					return;
				}
				console.error('[Layout] Layout calculation failed:', error);
			} finally {
				isCalculatingLayout = false;
			}
		};

		calculateLayout();
	});

	let isRendering = $state(false);

	// Compute render status for e2e tests (event-driven stability detection)
	// Replaces polling-based canvas stability checks with instant attribute checks
	const renderStatus = $derived<'idle' | 'rendering' | 'stable'>(
		!hasContent
			? 'idle'
			: isCalculatingLayout || isRendering
				? 'rendering'
				: layout !== null
					? 'stable'
					: 'rendering' // Default to rendering if layout is null but has content
	);

	// Render to canvas whenever dependencies change
	$effect(() => {
		// Explicitly track dependencies to ensure re-render when they change
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		layout;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		qrCodeUrl;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		showQRCode;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		customImage;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		showCustomImage;

		if (!canvasRef || !container || !layout) return;

		// Cancel any previous render
		if (renderController) {
			renderController.abort();
		}

		// Create new controller for this render
		renderController = new AbortController();
		const signal = renderController.signal;

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
			const render = async () => {
				// Additional check for TypeScript
				if (!canvasRef || !layout) return;

				isRendering = true;

				// Clear canvas immediately to prevent artifacts from aborted renders
				const ctx = canvasRef.getContext('2d');
				if (ctx) {
					ctx.setTransform(1, 0, 0, 1, 0, 0);
					ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
					ctx.fillStyle = 'white';
					ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);
				}

				try {
					// Check if aborted before starting render
					if (signal?.aborted) {
						return;
					}

					// In General Item mode, use custom image; in Fastener mode, use hardware image
					const effectiveShowImage = isGeneralItemMode
						? showCustomImage && !!customImage
						: showHardwareImage;

					await renderLabelToCanvas({
						canvas: canvasRef,
						dimensions,
						layout,
						content: {
							primaryText: primaryText || '',
							secondaryText: fullSecondaryText,
							standard,
							showStandard: isGeneralItemMode ? false : showStandard,
							showHardwareImage: effectiveShowImage,
							showQRCode,
							qrCodeUrl,
							customImageSrc: isGeneralItemMode && showCustomImage ? customImage?.data : undefined
						},
						scale: scale * dpr,
						showMargins: true,
						signal
					});
				} catch (error) {
					// Handle abort and other errors
					if (error instanceof Error && error.message === 'Render aborted') {
						// Clear canvas when aborted to remove partial renders
						if (ctx) {
							ctx.setTransform(1, 0, 0, 1, 0, 0);
							ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
							ctx.fillStyle = 'white';
							ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);
						}
						return;
					}
					console.error('Failed to render label:', error);
				} finally {
					isRendering = false;
				}
			};

			// Add small delay to ensure DOM is ready and prevent rapid fire renders
			requestAnimationFrame(() => {
				if (!signal?.aborted) {
					render();
				}
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

	onDestroy(() => {
		// Cancel any pending operations
		if (layoutController) {
			layoutController.abort();
		}
		if (renderController) {
			renderController.abort();
		}
	});
</script>

<div class="label-preview-container w-full" bind:this={container}>
	<AspectRatio ratio={labelWidth / labelHeight}>
		{#if hasContent}
			<canvas
				bind:this={canvasRef}
				class="h-full w-full bg-white shadow-lg"
				style="image-rendering: crisp-edges;"
				data-render-status={renderStatus}
				data-testid="label-preview-canvas"
				data-primary-text={primaryText || ''}
				data-secondary-text={fullSecondaryText || ''}
				data-primary-font-size={layout?.primaryFontSize.toFixed(2) || ''}
				data-secondary-font-size={layout?.secondaryFontSize.toFixed(2) || ''}
			></canvas>
		{:else}
			<div
				class="flex h-full w-full flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 bg-muted/50"
				data-testid="label-preview-placeholder"
			>
				<TagIcon class="mb-3 h-8 w-8 text-muted-foreground/40 lg:h-12 lg:w-12" />
				<p class="text-sm font-medium text-muted-foreground">
					<span class="lg:hidden">Enter text to preview</span>
					<span class="hidden lg:inline">Enter text to preview your label</span>
				</p>
				<p class="mt-1 text-xs text-muted-foreground/70">
					<span class="lg:hidden">Start typing above</span>
					<span class="hidden lg:inline">Start typing in the form above</span>
				</p>
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
