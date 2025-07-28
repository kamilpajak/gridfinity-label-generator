<script lang="ts">
	import '@fontsource/noto-sans/900.css'; // Import Noto Sans Black 900
	import '@fontsource/oswald/300.css'; // Import Oswald Light 300
	import QRCode from 'qrcode';
	import { shortenUrl, shouldShortenUrl, isValidUrl } from '$lib/utils/url-shortener';
	import type { ISODINStandard } from '$lib/data/standards';
	import { AspectRatio } from '$lib/components/ui/aspect-ratio';
	import {
		calculateTextPositions,
		calculateRightElementsLayout,
		calculateFontSizes,
		calculateQRCodeSize,
		type LabelDimensions
	} from '$lib/utils/label-layout';

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
		labelWidth
	}: Props = $props();

	// Label dimensions
	// Physical label has margins: 2mm left/right, 1mm top/bottom
	const dimensions = $derived<LabelDimensions>({
		width: labelWidth,
		height: labelHeight,
		printableWidth: labelWidth - 4, // 2mm left + 2mm right margins
		printableHeight: labelHeight - 2 // 1mm top + 1mm bottom margins
	});

	// Calculate layout
	const textPositions = $derived(calculateTextPositions(dimensions));
	const fontSizes = $derived(calculateFontSizes(labelHeight));
	const qrCodeSize = $derived(calculateQRCodeSize(labelHeight));
	const rightElements = $derived(
		calculateRightElementsLayout(dimensions, qrCodeSize, showQRCode, showHardwareImage)
	);

	// Process QR code
	let qrCodeSvg = $state('');
	let qrCodeViewBox = $state('');
	let isProcessingUrl = $state(false);

	$effect(() => {
		if (!showQRCode || !qrCodeUrl) {
			qrCodeSvg = '';
			return;
		}

		isProcessingUrl = true;
		let urlToEncode = qrCodeUrl;

		// Handle URL shortening if needed
		if (isValidUrl(qrCodeUrl) && shouldShortenUrl(qrCodeUrl)) {
			shortenUrl(qrCodeUrl).then((result) => {
				if (result.success && result.shortUrl) {
					urlToEncode = result.shortUrl;
				}
				generateQR(urlToEncode);
			});
		} else {
			generateQR(urlToEncode);
		}

		async function generateQR(data: string) {
			try {
				const svg = await QRCode.toString(data, {
					type: 'svg',
					width: rightElements.size * 10, // Scale up for quality
					margin: 0,
					color: {
						dark: '#000000',
						light: '#0000' // Transparent background
					}
				});

				// Extract viewBox and inner content of the SVG
				const svgMatch = svg.match(/<svg[^>]*viewBox="([^"]*?)"[^>]*>(.*?)<\/svg>/s);
				if (svgMatch) {
					qrCodeViewBox = svgMatch[1]; // e.g., "0 0 21 21"
					qrCodeSvg = svgMatch[2]; // SVG content
				} else {
					// Fallback: use the whole SVG if extraction fails
					qrCodeSvg = svg;
				}
			} catch (error) {
				console.error('QR code generation error:', error);
				qrCodeSvg = '';
			} finally {
				isProcessingUrl = false;
			}
		}
	});
</script>

<div class="label-preview-container w-full">
	<AspectRatio ratio={labelWidth / labelHeight}>
		<svg
			width="100%"
			height="100%"
			viewBox={`0 0 ${labelWidth} ${labelHeight}`}
			preserveAspectRatio="xMidYMid meet"
			class="h-full w-full bg-white shadow-sm"
		>
			<!-- Label background -->
			<rect
				x="0"
				y="0"
				width={labelWidth}
				height={labelHeight}
				fill="white"
				stroke="#e5e7eb"
				stroke-width="0.1"
			/>

			<!-- Printable area boundary (visual guide - remove in production) -->
			<rect
				x="2"
				y="1"
				width={dimensions.printableWidth}
				height={dimensions.printableHeight}
				fill="none"
				stroke="#f3f4f6"
				stroke-width="0.05"
				stroke-dasharray="0.2"
			/>

			<!-- Printable area content group - offset by margins -->
			<!-- This transform shifts the coordinate origin to the printable area -->
			<!-- All child elements use coordinates relative to printable area (0,0) -->
			<g transform="translate(2, 1)">
				<!-- Primary text -->
				{#if primaryText}
					<text
						x={textPositions.x}
						y={textPositions.primaryY}
						font-family="Noto Sans, sans-serif"
						font-size={fontSizes.primary}
						font-weight="900"
						fill="black"
					>
						{primaryText}
					</text>
				{/if}

				<!-- Secondary text (standard or custom) -->
				{#if secondaryText || (showStandard && standard)}
					<text
						x={textPositions.x}
						y={textPositions.secondaryY}
						font-family="Oswald, sans-serif"
						font-size={fontSizes.secondary}
						font-weight="300"
						fill="black"
					>
						{(secondaryText ||
							standard?.designations.map((d) => `${d.system} ${d.code}`).join(' / ') ||
							'') + (optionalNote ? ` ${optionalNote}` : '')}
					</text>
				{/if}

				<!-- Hardware image -->
				{#if showHardwareImage && standard?.image}
					<image
						x={rightElements.hardwareImageX}
						y={rightElements.y}
						width={rightElements.size}
						height={rightElements.size}
						href={standard.image}
						preserveAspectRatio="xMidYMid meet"
					/>
				{/if}

				<!-- QR Code -->
				{#if showQRCode && qrCodeSvg && !isProcessingUrl}
					<svg
						x={rightElements.x}
						y={rightElements.y}
						width={rightElements.size}
						height={rightElements.size}
						viewBox={qrCodeViewBox}
					>
						{@html qrCodeSvg}
					</svg>
				{/if}

				<!-- Loading indicator for QR code -->
				{#if showQRCode && isProcessingUrl}
					<text
						x={rightElements.x + rightElements.size / 2}
						y={rightElements.y + rightElements.size / 2}
						font-family="Arial, sans-serif"
						font-size="1"
						fill="#999"
						text-anchor="middle"
						dominant-baseline="middle"
					>
						...
					</text>
				{/if}
			</g>
			<!-- End of printable area content group -->
		</svg>
	</AspectRatio>

	<div class="mt-2 text-center text-xs text-muted-foreground">
		Preview: {labelWidth}mm × {labelHeight}mm (Printable: {dimensions.printableWidth}mm × {dimensions.printableHeight}mm)
	</div>
</div>

<style>
	.label-preview-container {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
