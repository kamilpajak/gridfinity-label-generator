<script lang="ts">
	import { Switch } from '$lib/components/ui/switch';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Slider } from '$lib/components/ui/slider';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import InfoIcon from '@lucide/svelte/icons/info';
	import { UI_TEXT } from '$lib/constants/ui-text';

	interface Props {
		showStandard: boolean;
		showHardwareImage: boolean;
		showQRCode: boolean;
		labelHeight: string;
		labelWidth: number;
		standardReferenceDisabled: boolean;
		hardwareImageDisabled: boolean;
		qrCodeDisabled: boolean;
		onShowStandardChange: (value: boolean) => void;
		onShowHardwareImageChange: (value: boolean) => void;
		onShowQRCodeChange: (value: boolean) => void;
		onLabelHeightChange: (value: string | undefined) => void;
		onLabelWidthChange: (value: number) => void;
	}

	let {
		showStandard,
		showHardwareImage,
		showQRCode,
		labelHeight,
		labelWidth,
		standardReferenceDisabled,
		hardwareImageDisabled,
		qrCodeDisabled,
		onShowStandardChange,
		onShowHardwareImageChange,
		onShowQRCodeChange,
		onLabelHeightChange,
		onLabelWidthChange
	}: Props = $props();
</script>

<div class="space-y-4">
	<Tooltip.Provider>
		<div class="flex items-center justify-between space-x-2">
			<div class="space-y-0.5">
				<div class="font-medium">{UI_TEXT.settings.standardReference.title}</div>
				<div class="text-sm text-muted-foreground">
					{standardReferenceDisabled
						? UI_TEXT.settings.standardReference.disabledGeneral
						: UI_TEXT.settings.standardReference.description}
				</div>
			</div>
			<Switch
				checked={showStandard}
				onCheckedChange={onShowStandardChange}
				disabled={standardReferenceDisabled}
				data-testid="standard-reference-switch"
			/>
		</div>

		<div class="flex items-center justify-between space-x-2">
			<div class="space-y-0.5">
				<div class="flex items-center gap-1.5 font-medium">
					{UI_TEXT.settings.hardwareIcon.title}
					{#if labelWidth < 50 && !hardwareImageDisabled && !qrCodeDisabled}
						<Tooltip.Root>
							<Tooltip.Trigger>
								<InfoIcon class="h-3.5 w-3.5 text-muted-foreground" />
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p class="max-w-xs text-sm">
									{UI_TEXT.tooltips.hardwareIconUnder50mm}
								</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}
				</div>
				<div class="text-sm text-muted-foreground">
					{#if hardwareImageDisabled}
						{labelHeight === '9'
							? UI_TEXT.settings.hardwareIcon.disabled9mm
							: UI_TEXT.settings.hardwareIcon.disabledGeneral}
					{:else if labelWidth < 50 && !qrCodeDisabled}
						{UI_TEXT.settings.hardwareIcon.description}<br />{UI_TEXT.settings.hardwareIcon
							.exclusiveWithQR}
					{:else}
						{UI_TEXT.settings.hardwareIcon.description}
					{/if}
				</div>
			</div>
			<Switch
				checked={showHardwareImage}
				onCheckedChange={onShowHardwareImageChange}
				disabled={hardwareImageDisabled}
				data-testid="hardware-image-switch"
			/>
		</div>

		<div class="flex items-center justify-between space-x-2">
			<div class="space-y-0.5">
				<div class="flex items-center gap-1.5 font-medium">
					{UI_TEXT.settings.qrCode.title}
					{#if labelWidth < 50 && !hardwareImageDisabled && !qrCodeDisabled}
						<Tooltip.Root>
							<Tooltip.Trigger>
								<InfoIcon class="h-3.5 w-3.5 text-muted-foreground" />
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p class="max-w-xs text-sm">
									{UI_TEXT.tooltips.qrCodeUnder50mm}
								</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}
				</div>
				<div class="text-sm text-muted-foreground">
					{#if qrCodeDisabled}
						{UI_TEXT.settings.qrCode.disabled9mm}
					{:else if labelWidth < 50 && !hardwareImageDisabled}
						{UI_TEXT.settings.qrCode.description}<br />{UI_TEXT.settings.qrCode
							.exclusiveWithHardware}
					{:else}
						{UI_TEXT.settings.qrCode.description}
					{/if}
				</div>
			</div>
			<Switch
				checked={showQRCode}
				onCheckedChange={onShowQRCodeChange}
				disabled={qrCodeDisabled}
				data-testid="qr-code-switch"
			/>
		</div>
	</Tooltip.Provider>

	<div class="border-t pt-4">
		<h4 class="mb-3 font-medium">{UI_TEXT.settings.dimensions.title}</h4>
		<div class="space-y-3">
			<div>
				<div class="mb-2 text-sm text-muted-foreground">
					{UI_TEXT.settings.dimensions.labelHeight}
				</div>
				<ToggleGroup
					value={labelHeight}
					onValueChange={onLabelHeightChange}
					variant="outline"
					type="single"
					class="w-full"
					data-testid="label-height-toggle"
				>
					<ToggleGroupItem value="9" class="min-h-[44px] flex-1">9mm</ToggleGroupItem>
					<ToggleGroupItem value="12" class="min-h-[44px] flex-1">12mm</ToggleGroupItem>
				</ToggleGroup>
			</div>
			<div>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-muted-foreground">{UI_TEXT.settings.dimensions.labelWidth}</span
					>
					<span class="text-sm font-medium">{labelWidth}mm</span>
				</div>
				<Slider
					value={labelWidth}
					onValueChange={onLabelWidthChange}
					type="single"
					min={35}
					max={100}
					step={1}
					class="w-full"
					data-testid="label-width-slider"
				/>
			</div>
		</div>
	</div>
</div>
