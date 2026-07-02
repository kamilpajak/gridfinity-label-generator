<script lang="ts">
	// Fonts are now imported globally in app.css
	import { onMount, onDestroy } from 'svelte';
	import type { ISODINStandard } from '$lib/data/standards';
	import type { CustomImage } from '$lib/types/batch';
	import TagIcon from '@lucide/svelte/icons/tag';

	/** Display scale for the preview chip (px per mm) — physically proportioned,
	 * but large enough to make good use of the main area (capped to 100% width). */
	const PX_PER_MM = 16;
	/** Constant internal render width (px). The canvas backing store is always
	 * this wide regardless of label width, so narrow labels render at high
	 * resolution (crisp text/QR) and wide labels at lower resolution — the CSS
	 * chip scales it to PX_PER_MM. This mirrors the original container-fit
	 * behaviour that the canvas pixel tests were calibrated against. */
	const RENDER_WIDTH_PX = 700;
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
			// Render into a constant-width backing store (independent of the small
			// on-screen chip). Narrow labels get more px/mm (crisp), wide labels
			// fewer — the CSS chip downscales the bitmap.
			scale = RENDER_WIDTH_PX / labelWidth;

			// Set canvas backing-store size (high resolution)
			canvasRef.width = labelWidth * scale * dpr;
			canvasRef.height = labelHeight * scale * dpr;

			// Display size follows the container chip; CSS scales the bitmap down.
			canvasRef.style.width = '100%';
			canvasRef.style.height = '100%';

			// Render label
			const render = async () => {
				// Additional check for TypeScript
				if (!canvasRef || !layout) return;

				// Note: isRendering is set synchronously before RAF to prevent race conditions

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
					if (signal.aborted) {
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
					// Only reset if we haven't been superseded by a new render
					if (!signal.aborted) {
						isRendering = false;
					}
				}
			};

			// Set rendering flag synchronously to prevent race conditions in tests
			// that wait for renderStatus='stable' before capturing canvas
			isRendering = true;

			// Add small delay to ensure DOM is ready and prevent rapid fire renders
			requestAnimationFrame(() => {
				if (!signal.aborted) {
					render();
				}
				// Note: No else branch needed. If aborted, a new effect already set
				// isRendering = true, so resetting it here would clobber that state.
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

<div class="flex w-full flex-col items-center gap-8">
	{#if hasContent}
		<div class="flex w-full items-center justify-center py-4">
			<!-- Physically-scaled, centered tape chip with soft glow -->
			<div
				bind:this={container}
				class="group relative shrink-0"
				style="width: min(100%, {labelWidth * PX_PER_MM}px, {RENDER_WIDTH_PX}px); aspect-ratio: {labelWidth} / {labelHeight};"
			>
				<div
					class="pointer-events-none absolute -inset-3 rounded bg-white/20 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-90"
				></div>
				<canvas
					bind:this={canvasRef}
					class="relative h-full w-full rounded-[2px] bg-white shadow-2xl"
					style="image-rendering: crisp-edges;"
					data-render-status={renderStatus}
					data-testid="label-preview-canvas"
					data-primary-text={primaryText || ''}
					data-secondary-text={fullSecondaryText || ''}
					data-primary-font-size={layout?.primaryFontSize.toFixed(2) || ''}
					data-secondary-font-size={layout?.secondaryFontSize.toFixed(2) || ''}
				></canvas>
			</div>
		</div>
	{:else}
		<div bind:this={container} class="flex w-full items-center justify-center py-4">
			<div
				class="flex max-w-md flex-col items-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-12 text-center backdrop-blur lg:p-16"
				data-testid="label-preview-placeholder"
			>
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
					<TagIcon class="h-8 w-8 text-slate-600" />
				</div>
				<p class="text-lg font-bold text-slate-300">Ready to design</p>
				<p class="mt-2 max-w-[220px] text-sm text-slate-400">
					Adjust the settings in the sidebar to preview your label.
				</p>
			</div>
		</div>
	{/if}

	<!-- Dimension readout pill -->
	<div
		class="flex items-center gap-3 rounded-full border border-slate-800 bg-slate-900/50 px-4 py-2 font-mono text-sm text-slate-400"
	>
		<span class="text-slate-500">Width:</span>
		<span class="font-bold text-cyan-400">{labelWidth}mm</span>
		<span class="mx-1 h-4 w-px bg-slate-700"></span>
		<span class="text-slate-500">Height:</span>
		<span class="font-bold text-amber-400">{labelHeight}mm</span>
	</div>
</div>
