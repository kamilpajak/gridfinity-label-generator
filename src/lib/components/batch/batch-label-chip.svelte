<script lang="ts">
	import type { BatchLabelConfig, TapeHeight } from '$lib/types/batch';
	import { deriveLabelText } from '$lib/utils/batch-renderer';
	import StandardImage from '$lib/components/shared/standard-image.svelte';

	interface Props {
		config: BatchLabelConfig;
		height: TapeHeight;
		/** Row index, used only for test ids. */
		index: number;
	}

	let { config, height, index }: Props = $props();

	// Physical proportions: px = mm * SCALE, so a 35mm/12mm chip renders small
	// but true-to-shape. DOM render (not canvas) keeps 20 rows cheap.
	const SCALE = 4;
	const heightPx = $derived(height * SCALE);
	const widthPx = $derived(config.width * SCALE);
	const primaryFontPx = $derived(height === 12 ? 3.5 * SCALE : 2.8 * SCALE);
	const secondaryFontPx = $derived(height === 12 ? 2.2 * SCALE : 1.8 * SCALE);

	const text = $derived(deriveLabelText(config));

	// Right-side indicator: QR takes precedence, else the hardware/custom image.
	const showQr = $derived((config.showQRCode ?? false) && !!config.qrCode && height === 12);
	const fastenerImage = $derived(
		config.mode === 'fastener' && (config.showImage ?? true) ? text.standard?.image : undefined
	);
	const customImage = $derived(
		config.mode === 'general' && (config.showCustomImage ?? true) && height === 12
			? config.customImage?.data
			: undefined
	);
	const rightImage = $derived(fastenerImage ?? customImage);
</script>

<div
	class="relative flex shrink-0 items-center overflow-hidden rounded-[2px] bg-white text-black shadow-md"
	style="height: {heightPx}px; width: {widthPx}px; padding: 0 {2 * SCALE}px;"
	data-testid="batch-chip-{index}"
>
	<div class="flex h-full w-full items-center justify-between font-mono">
		<div class="flex w-full flex-col justify-center overflow-hidden leading-[1.1]">
			<span
				class="truncate font-bold tracking-tighter"
				style="font-size: {primaryFontPx}px;"
				data-testid="batch-chip-primary-{index}"
			>
				{text.primaryText}
			</span>
			{#if text.secondaryText}
				<span
					class="truncate font-semibold tracking-tight text-slate-800"
					style="font-size: {secondaryFontPx}px;"
				>
					{text.secondaryText}
				</span>
			{/if}
		</div>

		{#if showQr}
			<div
				class="ml-2 flex h-[80%] shrink-0 items-center justify-center border-l-2 border-slate-300 pl-2"
			>
				<div
					class="rounded-sm bg-black"
					style="width: {heightPx * 0.55}px; height: {heightPx * 0.55}px;"
				></div>
			</div>
		{:else if rightImage}
			<div
				class="ml-2 flex h-[80%] shrink-0 items-center justify-center border-l-2 border-slate-300 pl-2"
			>
				<div style="width: {heightPx * 0.75}px; height: {heightPx * 0.75}px;">
					<StandardImage src={rightImage} alt="" class="h-full w-full object-contain" />
				</div>
			</div>
		{/if}
	</div>
</div>
