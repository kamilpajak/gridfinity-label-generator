<script lang="ts">
	import { onMount } from 'svelte';
	import { solveLabelLayout } from '$lib/utils/label-constraint-solver';
	import { enrichWithCoverageMetrics } from '$lib/utils/layout-metrics';
	import { renderLabelToCanvas } from '$lib/utils/label-renderer';
	import { formatPrimaryText } from '$lib/utils/label-formatter';
	import type { SolverOutput } from '$lib/utils/label-constraint-solver';
	import { standards } from '$lib/data/standards';
	import type { ISODINStandard } from '$lib/data/standards';

	interface TestCase {
		name: string;
		labelWidth: number;
		labelHeight: number;
		showImage: boolean;
		showQR: boolean;
		showStandard: boolean;
		labelMode: 'fastener' | 'general';
		threadSize: string;
		length: string;
		primaryText?: string;
		secondaryText?: string;
		standardName: string;
		optionalNote?: string;
		qrCodeUrl?: string;
	}

	interface TestResult {
		config: TestCase;
		imageDataUrl: string | null;
		layout: SolverOutput | null;
		standard: ISODINStandard | undefined;
		printableWidth: number;
		printableHeight: number;
	}

	interface TestPair {
		narrow: TestCase;
		wide: TestCase;
	}

	const testPairs: TestPair[] = [
		// 1. Baseline
		{
			narrow: {
				name: 'General Item',
				labelMode: 'general',
				labelWidth: 35,
				labelHeight: 12,
				showImage: false,
				showQR: false,
				showStandard: false,
				threadSize: '',
				length: '',
				primaryText: 'Resistors 10kΩ',
				secondaryText: '1/4W ±5%',
				standardName: ''
			},
			wide: {
				name: 'General Item',
				labelMode: 'general',
				labelWidth: 55,
				labelHeight: 12,
				showImage: false,
				showQR: false,
				showStandard: false,
				threadSize: '',
				length: '',
				primaryText: 'Resistors 10kΩ',
				secondaryText: '1/4W ±5%',
				standardName: ''
			}
		},

		// 2. Simple Text Test
		{
			narrow: {
				name: 'General Item - Simple Text',
				labelMode: 'general',
				labelWidth: 35,
				labelHeight: 12,
				showImage: false,
				showQR: false,
				showStandard: false,
				threadSize: '',
				length: '',
				primaryText: 'PRIMARY',
				secondaryText: 'SECONDARY',
				standardName: ''
			},
			wide: {
				name: 'General Item - Simple Text',
				labelMode: 'general',
				labelWidth: 55,
				labelHeight: 12,
				showImage: false,
				showQR: false,
				showStandard: false,
				threadSize: '',
				length: '',
				primaryText: 'PRIMARY',
				secondaryText: 'SECONDARY',
				standardName: ''
			}
		},

		// 3. Threshold Boundary Testing
		{
			narrow: {
				name: 'DIN 604 - Below Image Threshold (AR 3.30)',
				labelMode: 'fastener',
				labelWidth: 35,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '20',
				standardName: 'DIN 604'
			},
			wide: {
				name: 'DIN 604 - Below Image Threshold (AR 3.30)',
				labelMode: 'fastener',
				labelWidth: 55,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '20',
				standardName: 'DIN 604'
			}
		},
		{
			narrow: {
				name: 'DIN 7968 - Above Image Threshold (AR 3.45)',
				labelMode: 'fastener',
				labelWidth: 35,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '20',
				standardName: 'DIN 7968'
			},
			wide: {
				name: 'DIN 7968 - Above Image Threshold (AR 3.45)',
				labelMode: 'fastener',
				labelWidth: 55,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '20',
				standardName: 'DIN 7968'
			}
		},

		// 2. Aspect Ratio Extremes (Layout Mode Testing)
		{
			narrow: {
				name: 'DIN 467 - Tallest Image',
				labelMode: 'fastener',
				labelWidth: 35,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M6',
				length: '',
				standardName: 'DIN 467'
			},
			wide: {
				name: 'DIN 467 - Tallest Image',
				labelMode: 'fastener',
				labelWidth: 55,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M6',
				length: '',
				standardName: 'DIN 467'
			}
		},
		{
			narrow: {
				name: 'DIN 582 - Square Image',
				labelMode: 'fastener',
				labelWidth: 35,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '',
				standardName: 'DIN 582'
			},
			wide: {
				name: 'DIN 582 - Square Image',
				labelMode: 'fastener',
				labelWidth: 55,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '',
				standardName: 'DIN 582'
			}
		},
		{
			narrow: {
				name: 'DIN 2510 - Wide Image',
				labelMode: 'fastener',
				labelWidth: 35,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M10',
				length: '',
				standardName: 'DIN 2510'
			},
			wide: {
				name: 'DIN 2510 - Wide Image',
				labelMode: 'fastener',
				labelWidth: 55,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M10',
				length: '',
				standardName: 'DIN 2510'
			}
		},
		{
			narrow: {
				name: 'DIN 2093 - Widest Image',
				labelMode: 'fastener',
				labelWidth: 35,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '',
				standardName: 'DIN 2093'
			},
			wide: {
				name: 'DIN 2093 - Widest Image',
				labelMode: 'fastener',
				labelWidth: 55,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '',
				standardName: 'DIN 2093'
			}
		},

		// 4. Feature Combinations
		{
			narrow: {
				name: 'DIN 582 - With QR & Note',
				labelMode: 'fastener',
				labelWidth: 35,
				labelHeight: 12,
				showImage: true,
				showQR: true,
				showStandard: true,
				threadSize: 'M8',
				length: '',
				standardName: 'DIN 582',
				optionalNote: 'INOX',
				qrCodeUrl: 'https://example.com'
			},
			wide: {
				name: 'DIN 582 - With QR & Note',
				labelMode: 'fastener',
				labelWidth: 55,
				labelHeight: 12,
				showImage: true,
				showQR: true,
				showStandard: true,
				threadSize: 'M8',
				length: '',
				standardName: 'DIN 582',
				optionalNote: 'INOX',
				qrCodeUrl: 'https://example.com'
			}
		},
		{
			narrow: {
				name: 'DIN 582 - Without QR',
				labelMode: 'fastener',
				labelWidth: 35,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '',
				standardName: 'DIN 582',
				optionalNote: 'INOX'
			},
			wide: {
				name: 'DIN 582 - Without QR',
				labelMode: 'fastener',
				labelWidth: 55,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '',
				standardName: 'DIN 582',
				optionalNote: 'INOX'
			}
		},
		{
			narrow: {
				name: 'DIN 582 - Text Only',
				labelMode: 'fastener',
				labelWidth: 35,
				labelHeight: 12,
				showImage: false,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '',
				standardName: 'DIN 582'
			},
			wide: {
				name: 'DIN 582 - Text Only',
				labelMode: 'fastener',
				labelWidth: 55,
				labelHeight: 12,
				showImage: false,
				showQR: false,
				showStandard: true,
				threadSize: 'M8',
				length: '',
				standardName: 'DIN 582'
			}
		},

		// 5. Bug Report: ISO 14580 (Torx) - Text Clipping Test
		{
			narrow: {
				name: 'ISO 14580 - Torx M2.5×30 (Bug Report)',
				labelMode: 'fastener',
				labelWidth: 35,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M2.5',
				length: '30',
				standardName: 'ISO 14580'
			},
			wide: {
				name: 'ISO 14580 - Torx M2.5×30 (Bug Report)',
				labelMode: 'fastener',
				labelWidth: 55,
				labelHeight: 12,
				showImage: true,
				showQR: false,
				showStandard: true,
				threadSize: 'M2.5',
				length: '30',
				standardName: 'ISO 14580'
			}
		}
	];

	let results: TestResult[] = [];
	let hoveredIndex: number | null = null;

	// Export function to reproduce the exact export behavior
	async function exportAsPng(result: TestResult) {
		const config = result.config;
		const printableWidth = config.labelWidth - 4;
		const printableHeight = config.labelHeight - 2;
		const dpi = 360;
		const scale = dpi / 25.4; // Same as label-exporter.ts

		// Create canvas with exact export dimensions
		const exportCanvas = document.createElement('canvas');
		exportCanvas.width = Math.round(printableWidth * scale);
		exportCanvas.height = Math.round(printableHeight * scale);

		const primaryText = formatPrimaryText(
			config.labelMode,
			config.threadSize,
			config.length,
			config.primaryText || ''
		);

		let fullSecondaryText = '';
		if (config.labelMode === 'general' && config.secondaryText) {
			fullSecondaryText = config.secondaryText;
		} else if (config.showStandard && result.standard) {
			const primaryDesignation = result.standard.designations.find(
				(d) => d.system === result.standard!.primarySystem
			);
			if (primaryDesignation) {
				fullSecondaryText = `${primaryDesignation.system} ${primaryDesignation.code}`;
			}
		}
		if (config.optionalNote) {
			fullSecondaryText = fullSecondaryText
				? `${fullSecondaryText} ${config.optionalNote}`
				: config.optionalNote;
		}

		await renderLabelToCanvas({
			canvas: exportCanvas,
			dimensions: {
				width: config.labelWidth,
				height: config.labelHeight,
				printableWidth,
				printableHeight
			},
			layout: result.layout!,
			content: {
				primaryText,
				secondaryText: fullSecondaryText,
				standard: result.standard,
				showHardwareImage: config.showImage,
				showQRCode: config.showQR,
				showStandard: config.showStandard,
				qrCodeUrl: config.qrCodeUrl
			},
			scale,
			showMargins: false
		});

		// Download
		exportCanvas.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${config.name.replace(/[^a-z0-9]/gi, '-')}-${config.labelWidth}x${config.labelHeight}.png`;
			a.click();
			URL.revokeObjectURL(url);
		}, 'image/png');
	}

	async function generateLabel(config: TestCase): Promise<TestResult> {
		const printableWidth = config.labelWidth - 4;
		const printableHeight = config.labelHeight - 2;

		// Find standard
		const standard: ISODINStandard | undefined = standards.find((s) =>
			s.designations.some((d) => `${d.system} ${d.code}` === config.standardName)
		);

		// Format primary text
		const primaryText = formatPrimaryText(
			config.labelMode,
			config.threadSize,
			config.length,
			config.primaryText || ''
		);

		// Calculate secondary text
		let fullSecondaryText = '';

		// For general mode, use the secondaryText from config
		if (config.labelMode === 'general' && config.secondaryText) {
			fullSecondaryText = config.secondaryText;
		} else if (config.showStandard && standard) {
			// For fastener mode, use standard designation
			const primaryDesignation = standard.designations.find(
				(d) => d.system === standard.primarySystem
			);
			if (primaryDesignation) {
				fullSecondaryText = `${primaryDesignation.system} ${primaryDesignation.code}`;
			} else if (standard.designations.length > 0) {
				fullSecondaryText = `${standard.designations[0].system} ${standard.designations[0].code}`;
			}
		}

		// Add optional note
		if (config.optionalNote) {
			fullSecondaryText = fullSecondaryText
				? `${fullSecondaryText} ${config.optionalNote}`
				: config.optionalNote;
		}

		// Calculate hardware image aspect ratio
		let hardwareImageAspectRatio: number | undefined;
		if (config.showImage && standard?.image) {
			try {
				const img = new Image();
				await new Promise<void>((resolve, reject) => {
					img.onload = () => resolve();
					img.onerror = reject;
					img.src = standard.image!;
				});
				hardwareImageAspectRatio = img.naturalWidth / img.naturalHeight;
			} catch (e) {
				console.warn('Failed to load image for aspect ratio calculation:', e);
			}
		}

		// Solve layout
		const layout = await solveLabelLayout({
			dimensions: {
				width: config.labelWidth,
				height: config.labelHeight,
				printableWidth,
				printableHeight
			},
			showQRCode: config.showQR,
			showHardwareImage: config.showImage,
			showStandard: config.showStandard,
			primaryText,
			secondaryText: fullSecondaryText,
			hardwareImageAspectRatio
		});

		// Measure actual cap-heights for visual comparison
		const measureCapHeight = (fontFamily: string, fontWeight: string, fontSize: number) => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			if (!ctx) return 0;

			ctx.font = `${fontWeight} ${fontSize * 100}px "${fontFamily}"`;
			ctx.textBaseline = 'alphabetic';
			const metrics = ctx.measureText('M'); // Capital M for cap-height

			return metrics.actualBoundingBoxAscent / 100; // Returns height in mm (not ratio)
		};

		// These return actual heights in mm, not ratios
		const visualPrimaryCapHeight = measureCapHeight('Noto Sans', '900', layout.primaryFontSize);
		const visualSecondaryCapHeight = measureCapHeight('Oswald', '300', layout.secondaryFontSize);

		// Log font sizes and spacing for analysis
		const logData: Record<string, string | number | undefined> = {
			mode: layout.layoutMode,
			primary: `${layout.primaryFontSize.toFixed(2)}mm (${primaryText})`,
			primaryCapHeight: `${visualPrimaryCapHeight.toFixed(2)}mm (visual)`,
			secondary: `${layout.secondaryFontSize.toFixed(2)}mm (${fullSecondaryText})`,
			secondaryCapHeight: `${visualSecondaryCapHeight.toFixed(2)}mm (visual)`,
			capHeightRatio: (visualSecondaryCapHeight / visualPrimaryCapHeight).toFixed(3),
			textY: `${layout.primaryText.y.toFixed(2)}mm (baseline)`
		};

		// Add image metrics for all modes
		if (layout.hardwareImage && layout.hardwareImage.width && layout.hardwareImage.height) {
			const imageWidth = layout.hardwareImage.width;
			const imageHeight = layout.hardwareImage.height;
			const calculatedAR = imageWidth / imageHeight;
			const expectedAR = hardwareImageAspectRatio || 0;

			logData.imageWidth = `${imageWidth.toFixed(2)}mm`;
			logData.imageHeight = `${imageHeight.toFixed(2)}mm`;
			logData.imageAR = calculatedAR.toFixed(3);
			logData.expectedAR = expectedAR.toFixed(3);
			logData.arMatch = Math.abs(calculatedAR - expectedAR) < 0.001 ? '✓' : '✗ DISTORTED';

			// Add IMAGE_HORIZONTAL specific metrics
			if (layout.layoutMode === 'IMAGE_HORIZONTAL') {
				const imageY = layout.hardwareImage.y;
				const imageBottom = imageY + imageHeight;
				const textVisualTop = layout.primaryText.y - visualPrimaryCapHeight;
				const textBottom = layout.primaryText.y + layout.primaryFontSize * 0.01;

				const spacing = textVisualTop - imageBottom;
				const topMargin = imageY;
				const bottomMargin = printableHeight - textBottom;
				const totalHeight = imageHeight + spacing + visualPrimaryCapHeight;

				logData.imageY = `${imageY.toFixed(2)}mm`;
				logData.imageBottom = `${imageBottom.toFixed(2)}mm`;
				logData.spacing = `${spacing.toFixed(2)}mm`;
				logData.textVisualTop = `${textVisualTop.toFixed(2)}mm`;
				logData.textBottom = `${textBottom.toFixed(2)}mm`;
				logData.topMargin = `${topMargin.toFixed(2)}mm`;
				logData.bottomMargin = `${bottomMargin.toFixed(2)}mm`;
				logData.totalHeight = `${totalHeight.toFixed(2)}mm`;
				logData.printableHeight = `${printableHeight.toFixed(2)}mm`;
				logData.marginDiff = `${Math.abs(topMargin - bottomMargin).toFixed(3)}mm`;
			}
		}

		console.log(`[${config.name}] Layout:`, logData);

		// Enrich with coverage metrics
		const layoutResult = await enrichWithCoverageMetrics(
			layout,
			{
				width: config.labelWidth,
				height: config.labelHeight,
				printableWidth,
				printableHeight
			},
			{
				primaryText,
				secondaryText: fullSecondaryText,
				showHardwareImage: config.showImage,
				showQRCode: config.showQR
			}
		);

		// Create canvas with printable area dimensions only
		const canvas = document.createElement('canvas');
		canvas.width = printableWidth * 10; // 10px per mm
		canvas.height = printableHeight * 10;

		// Render to canvas
		await renderLabelToCanvas({
			canvas,
			dimensions: {
				width: config.labelWidth,
				height: config.labelHeight,
				printableWidth,
				printableHeight
			},
			layout: layoutResult,
			content: {
				primaryText,
				secondaryText: fullSecondaryText,
				standard: standard,
				showHardwareImage: config.showImage,
				showQRCode: config.showQR,
				showStandard: config.showStandard,
				qrCodeUrl: config.qrCodeUrl
			},
			scale: 10,
			showMargins: false
		});

		// Convert canvas to data URL for display
		const imageDataUrl = canvas.toDataURL('image/png');

		return {
			config,
			imageDataUrl,
			layout: layoutResult,
			standard,
			printableWidth,
			printableHeight
		};
	}

	async function generateAllLabels() {
		const allTestCases: TestCase[] = [];
		testPairs.forEach((pair) => {
			allTestCases.push(pair.narrow);
			allTestCases.push(pair.wide);
		});
		results = await Promise.all(allTestCases.map((tc) => generateLabel(tc)));
	}

	onMount(() => {
		generateAllLabels();
	});
</script>

<div class="container">
	<h1>Label Layout Test Grid</h1>
	<p class="subtitle">
		Hover over labels to see debug information. Each row shows 35×12mm (left) and 55×12mm (right)
		comparison.
	</p>

	<div class="grid">
		{#each results as result, i (i)}
			{@const isNarrow = i % 2 === 0}

			{#if isNarrow}
				<div class="row-header">
					<h3>{result.config.name}</h3>
				</div>
			{/if}

			<div
				class="label-card"
				class:narrow={isNarrow}
				class:wide={!isNarrow}
				role="button"
				tabindex="0"
				onmouseenter={() => (hoveredIndex = i)}
				onmouseleave={() => (hoveredIndex = null)}
				onfocus={() => (hoveredIndex = i)}
				onblur={() => (hoveredIndex = null)}
			>
				<div class="label-header">
					<span class="label-size">{result.config.labelWidth}×{result.config.labelHeight}mm</span>
					<button class="export-btn" onclick={() => exportAsPng(result)}>Export PNG</button>
				</div>

				<div class="canvas-wrapper">
					{#if result.imageDataUrl}
						<img
							src={result.imageDataUrl}
							alt={result.config.name}
							style="width: {result.printableWidth * 8}px; height: {result.printableHeight * 8}px;"
						/>
						{#if hoveredIndex === i}
							<svg
								class="helper-overlay"
								style="width: {result.printableWidth * 8}px; height: {result.printableHeight *
									8}px;"
								viewBox="0 0 {result.printableWidth} {result.printableHeight}"
							>
								<!-- Horizontal centerline -->
								<line
									x1="0"
									y1={result.printableHeight / 2}
									x2={result.printableWidth}
									y2={result.printableHeight / 2}
									stroke="#ff0066"
									stroke-width="0.1"
									stroke-dasharray="0.5 0.3"
									opacity="0.7"
								/>
							</svg>
						{/if}
					{/if}
				</div>

				{#if hoveredIndex === i && result.layout?.metadata}
					<div class="tooltip">
						<div class="tooltip-section">
							<h4>Layout</h4>
							<div class="tooltip-row">
								<span>Mode:</span>
								<span class="value">{result.layout.layoutMode || 'N/A'}</span>
							</div>
							<div class="tooltip-row">
								<span>Primary Font:</span>
								<span class="value">{result.layout.primaryFontSize.toFixed(1)}mm</span>
							</div>
							<div class="tooltip-row">
								<span>Secondary Font:</span>
								<span class="value">{result.layout.secondaryFontSize.toFixed(1)}mm</span>
							</div>
						</div>

						<div class="tooltip-section">
							<h4>Coverage</h4>
							<div class="tooltip-row">
								<span>Total:</span>
								<span class="value">{result.layout.metadata.coveragePercentage.toFixed(1)}%</span>
							</div>
							<div class="tooltip-row">
								<span>Primary Text:</span>
								<span class="value"
									>{(
										(result.layout.metadata.breakdown.primaryText /
											result.layout.metadata.printableArea) *
										100
									).toFixed(1)}%</span
								>
							</div>
							<div class="tooltip-row">
								<span>Secondary Text:</span>
								<span class="value"
									>{(
										(result.layout.metadata.breakdown.secondaryText /
											result.layout.metadata.printableArea) *
										100
									).toFixed(1)}%</span
								>
							</div>
							{#if result.layout.metadata.breakdown.image > 0}
								<div class="tooltip-row">
									<span>Image:</span>
									<span class="value"
										>{(
											(result.layout.metadata.breakdown.image /
												result.layout.metadata.printableArea) *
											100
										).toFixed(1)}%</span
									>
								</div>
							{/if}
							{#if result.layout.metadata.breakdown.qrCode > 0}
								<div class="tooltip-row">
									<span>QR Code:</span>
									<span class="value"
										>{(
											(result.layout.metadata.breakdown.qrCode /
												result.layout.metadata.printableArea) *
											100
										).toFixed(1)}%</span
									>
								</div>
							{/if}
						</div>

						<div class="tooltip-section">
							<h4>Configuration</h4>
							<div class="tooltip-row">
								<span>Thread:</span>
								<span class="value">{result.config.threadSize}</span>
							</div>
							{#if result.config.length}
								<div class="tooltip-row">
									<span>Length:</span>
									<span class="value">{result.config.length}mm</span>
								</div>
							{/if}
							<div class="tooltip-row">
								<span>Standard:</span>
								<span class="value">{result.config.standardName}</span>
							</div>
							{#if result.config.optionalNote}
								<div class="tooltip-row">
									<span>Note:</span>
									<span class="value">{result.config.optionalNote}</span>
								</div>
							{/if}
							<div class="tooltip-row">
								<span>Image:</span>
								<span class="value">{result.config.showImage ? 'ON' : 'OFF'}</span>
							</div>
							<div class="tooltip-row">
								<span>QR Code:</span>
								<span class="value">{result.config.showQR ? 'ON' : 'OFF'}</span>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.container {
		max-width: 1600px;
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		font-size: 2rem;
		margin-bottom: 0.5rem;
	}

	.subtitle {
		color: #666;
		margin-bottom: 2rem;
		font-size: 0.95rem;
	}

	.grid {
		display: grid;
		grid-template-columns: auto 1fr 1fr;
		gap: 1rem 1.5rem;
		align-items: center;
	}

	.row-header {
		grid-column: 1 / -1;
		margin-top: 1.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid #e5e7eb;
	}

	.row-header:first-child {
		margin-top: 0;
	}

	.row-header h3 {
		font-size: 1.1rem;
		margin: 0;
		color: #333;
		font-weight: 600;
	}

	.label-card {
		position: relative;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 1rem;
		transition: all 0.2s;
		cursor: pointer;
	}

	.label-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		border-color: #333;
	}

	.label-card.narrow {
		grid-column: 2;
	}

	.label-card.wide {
		grid-column: 3;
	}

	.label-header {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.label-size {
		font-size: 0.8rem;
		color: #666;
		font-weight: 500;
	}

	.export-btn {
		font-size: 0.7rem;
		padding: 0.25rem 0.5rem;
		background: #333;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		margin-left: 0.5rem;
	}

	.export-btn:hover {
		background: #555;
	}

	.canvas-wrapper {
		position: relative;
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 120px;
	}

	.helper-overlay {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	img {
		display: block;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		background: white;
		flex-shrink: 0;
	}

	.tooltip {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 0.5rem;
		background: white;
		border: 1px solid #333;
		border-radius: 8px;
		padding: 1rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 10;
		max-height: 400px;
		overflow-y: auto;
	}

	.tooltip-section {
		margin-bottom: 1rem;
	}

	.tooltip-section:last-child {
		margin-bottom: 0;
	}

	.tooltip-section h4 {
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #666;
		margin: 0 0 0.5rem 0;
		font-weight: 600;
	}

	.tooltip-row {
		display: flex;
		justify-content: space-between;
		padding: 0.35rem 0;
		border-bottom: 1px solid #f0f0f0;
		font-size: 0.9rem;
	}

	.tooltip-row:last-child {
		border-bottom: none;
	}

	.tooltip-row span {
		color: #666;
	}

	.tooltip-row .value {
		font-weight: 600;
		color: #333;
	}
</style>
