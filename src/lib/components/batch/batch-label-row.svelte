<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Slider } from '$lib/components/ui/slider';
	import { Switch } from '$lib/components/ui/switch';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import * as Popover from '$lib/components/ui/popover';
	import { batchStore } from '$lib/stores/batch-store';
	import StandardSearch from '$lib/components/shared/standard-search.svelte';
	import {
		standards,
		formatDesignations,
		getStandardById,
		HardwareType
	} from '$lib/data/standards';
	import { getPitchOptions } from '$lib/data/thread-pitch';
	import type { BatchLabelConfig, FastenerLabelConfig, GeneralLabelConfig } from '$lib/types/batch';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import XIcon from '@lucide/svelte/icons/x';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { UI_TEXT } from '$lib/constants/ui-text';

	interface Props {
		label: BatchLabelConfig;
		index: number;
		tapeHeight: 9 | 12;
	}

	let { label, index, tapeHeight }: Props = $props();

	const labelNumber = $derived(index + 1);
	const isFastenerMode = $derived(label.mode === 'fastener');
	const qrDisabled = $derived(tapeHeight === 9);

	// Thread sizes
	const metricThreadSizes = [
		'M1.4',
		'M1.6',
		'M2',
		'M2.5',
		'M3',
		'M4',
		'M5',
		'M6',
		'M8',
		'M10',
		'M12',
		'M16',
		'M20'
	];
	const imperialThreadSizes = ['#4', '#6', '#8', '#10', '1/4″', '5/16″', '3/8″', '1/2″', '5/8″'];

	// Standards with images
	const standardsWithImages = $derived(standards.filter((s) => s.image));

	// Local state for controlled inputs
	let labelMode = $state(label.mode);
	let measurementSystem = $state<'metric' | 'imperial'>(
		isFastenerMode ? (label as FastenerLabelConfig).measurementSystem : 'metric'
	);

	let availableThreadSizes = $derived(
		measurementSystem === 'metric' ? metricThreadSizes : imperialThreadSizes
	);
	let threadSize = $state(isFastenerMode ? (label as FastenerLabelConfig).threadSize : '');
	let pitch = $state(isFastenerMode ? (label as FastenerLabelConfig).pitch || '' : '');
	let threadType = $state(isFastenerMode ? (label as FastenerLabelConfig).threadType || '' : '');
	let length = $state(
		isFastenerMode ? ((label as FastenerLabelConfig).length?.toString() ?? '') : ''
	);
	let primaryText = $state(!isFastenerMode ? (label as GeneralLabelConfig).primaryText : '');
	let secondaryText = $state(
		!isFastenerMode ? (label as GeneralLabelConfig).secondaryText || '' : ''
	);
	let width = $state(label.width);
	let standardId = $state(isFastenerMode ? (label as FastenerLabelConfig).standard || '' : '');
	let note = $state(label.note || '');
	let qrCode = $state(label.qrCode || '');
	let showImage = $state(
		isFastenerMode ? ((label as FastenerLabelConfig).showImage ?? true) : false
	);
	let showReference = $state(
		isFastenerMode ? ((label as FastenerLabelConfig).showReference ?? true) : false
	);
	let showQRCode = $state(label.showQRCode ?? true);

	let standardsOpen = $state(false);

	// Sync local state with prop changes
	$effect(() => {
		labelMode = label.mode;
		measurementSystem = isFastenerMode
			? (label as FastenerLabelConfig).measurementSystem
			: 'metric';
		threadSize = isFastenerMode ? (label as FastenerLabelConfig).threadSize : '';
		pitch = isFastenerMode ? (label as FastenerLabelConfig).pitch || '' : '';
		threadType = isFastenerMode ? (label as FastenerLabelConfig).threadType || '' : '';
		length = isFastenerMode ? ((label as FastenerLabelConfig).length?.toString() ?? '') : '';
		primaryText = !isFastenerMode ? (label as GeneralLabelConfig).primaryText : '';
		secondaryText = !isFastenerMode ? (label as GeneralLabelConfig).secondaryText || '' : '';
		width = label.width;
		standardId = isFastenerMode ? (label as FastenerLabelConfig).standard || '' : '';
		note = label.note || '';
		qrCode = label.qrCode || '';
		showImage = isFastenerMode ? ((label as FastenerLabelConfig).showImage ?? true) : false;
		showReference = isFastenerMode ? ((label as FastenerLabelConfig).showReference ?? true) : false;
		showQRCode = label.showQRCode ?? true;
	});

	const selectedStandard = $derived(getStandardById(standardId));

	// Disable hardware image for standards without images
	const hardwareImageDisabled = $derived(!selectedStandard?.image);

	// Disable QR code for 9mm tape
	const qrCodeDisabled = $derived(qrDisabled);

	// Mutual exclusion for Hardware Icon and QR Code on narrow labels (<50mm)
	// Track previous values to detect which one changed
	let prevShowImage = $state(showImage);
	let prevShowQRCode = $state(showQRCode);
	let prevWidth = $state(width);

	$effect(() => {
		// Only apply mutual exclusion when width < 50mm and both are not disabled
		if (width < 50 && !hardwareImageDisabled && !qrCodeDisabled) {
			// Check if Hardware Icon was just enabled
			if (showImage && !prevShowImage && showQRCode) {
				untrack(() => {
					showQRCode = false;
				});
			}
			// Check if QR Code was just enabled
			else if (showQRCode && !prevShowQRCode && showImage) {
				untrack(() => {
					showImage = false;
				});
			}
			// Check if width was just reduced below 50mm while both were enabled
			else if (prevWidth >= 50 && width < 50 && showImage && showQRCode) {
				// Prefer keeping Hardware Icon, disable QR Code
				untrack(() => {
					showQRCode = false;
				});
			}
		}

		// Update previous values for next change detection
		prevShowImage = showImage;
		prevShowQRCode = showQRCode;
		prevWidth = width;
	});

	// Disable length input for nuts and washers (they don't have length specification)
	const lengthDisabled = $derived(
		selectedStandard?.hardwareType === HardwareType.NUT ||
			selectedStandard?.hardwareType === HardwareType.WASHER
	);

	function closeStandards() {
		standardsOpen = false;
	}

	// Derived state for pitch selector visibility
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const showPitchSelector = $derived(labelMode === 'fastener');

	const availablePitchOptions = $derived(
		threadSize ? getPitchOptions(threadSize, measurementSystem) : []
	);

	// Update threadType when pitch changes
	$effect(() => {
		if (pitch) {
			const selectedPitchOption = availablePitchOptions.find((p) => p.value === pitch);
			threadType = selectedPitchOption?.type || '';
		} else {
			threadType = '';
		}
	});

	// Update store when any field changes
	function updateLabel() {
		let updatedLabel: BatchLabelConfig;

		if (labelMode === 'fastener') {
			updatedLabel = {
				mode: 'fastener',
				measurementSystem,
				threadSize,
				pitch: pitch || undefined,
				threadType: threadType || undefined,
				length: parseFloat(length) || undefined,
				width,
				standard: standardId || undefined,
				note: note || undefined,
				qrCode: qrDisabled ? undefined : qrCode || undefined,
				showImage,
				showReference,
				showQRCode
			};
		} else {
			updatedLabel = {
				mode: 'general',
				primaryText,
				secondaryText: secondaryText || undefined,
				width,
				note: note || undefined,
				qrCode: qrDisabled ? undefined : qrCode || undefined,
				showQRCode
			};
		}

		batchStore.updateLabel(index, updatedLabel);
	}

	// Watch for mode changes
	$effect(() => {
		// When mode changes, update the label
		if (labelMode !== label.mode) {
			updateLabel();
		}
	});

	// Watch for ANY field changes and update store
	$effect(() => {
		// Access all reactive fields to track changes
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _trackedFields = [
			labelMode,
			measurementSystem,
			threadSize,
			pitch,
			length,
			primaryText,
			secondaryText,
			width,
			standardId,
			note,
			qrCode,
			showImage,
			showReference,
			showQRCode
		];

		// Update store whenever any field changes
		updateLabel();
	});

	// Watch for measurement system changes and reset thread size/pitch
	let previousMeasurementSystem = $state(measurementSystem);
	$effect(() => {
		if (measurementSystem !== previousMeasurementSystem) {
			threadSize = '';
			pitch = '';
			previousMeasurementSystem = measurementSystem;
		}
	});

	// Reset pitch when thread size changes
	$effect(() => {
		if (threadSize) {
			pitch = '';
		}
	});

	function handleDuplicate() {
		batchStore.duplicateLabel(index);
	}

	function handleDelete() {
		batchStore.removeLabel(index);
	}
</script>

<div class="space-y-6 rounded-lg border p-4" data-testid="batch-label-row-{index}">
	<!-- Header Row -->
	<div class="flex items-center justify-between">
		<h4 class="font-medium" data-testid="batch-label-number">Label #{labelNumber}</h4>
		<div class="flex gap-1">
			<Button
				onclick={handleDuplicate}
				variant="ghost"
				size="icon"
				class="h-8 w-8"
				title="Duplicate"
				data-testid="duplicate-label-button-{index}"
			>
				<CopyIcon class="h-4 w-4" />
			</Button>
			<Button
				onclick={handleDelete}
				variant="ghost"
				size="icon"
				class="h-8 w-8"
				title="Delete"
				data-testid="delete-label-button-{index}"
			>
				<XIcon class="h-4 w-4" />
			</Button>
		</div>
	</div>

	{#if isFastenerMode}
		<!-- Fastener Mode Fields -->
		<div class="space-y-6">
			<!-- Product Type and Measurement System in one row -->
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
				<div class="space-y-2">
					<label class="text-sm font-medium">{UI_TEXT.productType.label}</label>
					<ToggleGroup
						bind:value={labelMode}
						variant="outline"
						type="single"
						size="default"
						class="w-full"
					>
						<ToggleGroupItem value="fastener" class="flex-1"
							>{UI_TEXT.productType.fastener}</ToggleGroupItem
						>
						<ToggleGroupItem value="general" class="flex-1"
							>{UI_TEXT.productType.generalItem}</ToggleGroupItem
						>
					</ToggleGroup>
				</div>

				<div class="space-y-2">
					<label class="text-sm font-medium">{UI_TEXT.measurementSystem.label}</label>
					<ToggleGroup
						bind:value={measurementSystem}
						variant="outline"
						type="single"
						size="default"
						class="w-full"
					>
						<ToggleGroupItem value="metric" class="flex-1"
							>{UI_TEXT.measurementSystem.metric}</ToggleGroupItem
						>
						<ToggleGroupItem value="imperial" class="flex-1"
							>{UI_TEXT.measurementSystem.imperial}</ToggleGroupItem
						>
					</ToggleGroup>
				</div>
			</div>

			<!-- ISO/DIN Standard and Note in one row -->
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
				<div class="space-y-2">
					<label class="text-sm font-medium">{UI_TEXT.fields.standard}</label>
					<Popover.Root bind:open={standardsOpen}>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									variant="outline"
									role="combobox"
									aria-expanded={standardsOpen}
									class="w-full justify-between font-normal"
								>
									{selectedStandard
										? formatDesignations(selectedStandard)
										: UI_TEXT.placeholders.selectStandard}
									<ChevronsUpDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content class="w-[400px] p-0">
							<StandardSearch
								standards={standardsWithImages}
								onSelect={(id) => {
									standardId = id;
									updateLabel();
									closeStandards();
								}}
							/>
						</Popover.Content>
					</Popover.Root>
				</div>

				<div class="space-y-2">
					<label for="note-{index}" class="text-sm font-medium"
						>{UI_TEXT.fields.note}
						<span class="text-muted-foreground">{UI_TEXT.labels.optional}</span></label
					>
					<Input
						id="note-{index}"
						bind:value={note}
						placeholder={UI_TEXT.placeholders.note}
						class="w-full"
						onblur={updateLabel}
					/>
				</div>
			</div>

			<!-- Thread Size, Thread Pitch, Length in one row -->
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
				<div class="space-y-2">
					<label for="thread-size-{index}" class="text-sm font-medium"
						>{UI_TEXT.fields.threadSize}</label
					>
					<Select bind:value={threadSize} type="single">
						<SelectTrigger id="thread-size-{index}" class="w-full">
							{threadSize || UI_TEXT.placeholders.selectSize}
						</SelectTrigger>
						<SelectContent>
							{#each availableThreadSizes as size (size)}
								<SelectItem value={size}>{size}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<div class="space-y-2">
					<label for="pitch-{index}" class="text-sm font-medium"
						>{UI_TEXT.fields.threadPitch}
						<span class="text-muted-foreground">{UI_TEXT.labels.optional}</span></label
					>
					<Select bind:value={pitch} type="single">
						<SelectTrigger id="pitch-{index}" class="w-full">
							{pitch
								? availablePitchOptions.find((p) => p.value === pitch)?.label
								: UI_TEXT.placeholders.selectPitch}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value=""
								>{measurementSystem === 'imperial'
									? UI_TEXT.placeholders.standardPitchImperial
									: UI_TEXT.placeholders.standardPitchMetric}</SelectItem
							>
							{#each availablePitchOptions as pitchOption (pitchOption.value)}
								<SelectItem value={pitchOption.value}>{pitchOption.label}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<div class="space-y-2">
					<label for="length-{index}" class="text-sm font-medium"
						>{UI_TEXT.fields.length} ({measurementSystem === 'metric' ? 'mm' : 'in'})</label
					>
					<Input
						id="length-{index}"
						bind:value={length}
						placeholder={measurementSystem === 'metric'
							? UI_TEXT.placeholders.lengthMetric
							: UI_TEXT.placeholders.lengthImperial}
						disabled={lengthDisabled}
						onblur={updateLabel}
					/>
				</div>
			</div>
		</div>
	{:else}
		<!-- General Mode Fields -->
		<div class="space-y-6">
			<!-- Product Type and Measurement System (disabled in general mode) -->
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
				<div class="space-y-2">
					<label class="text-sm font-medium">{UI_TEXT.productType.label}</label>
					<ToggleGroup
						bind:value={labelMode}
						variant="outline"
						type="single"
						size="default"
						class="w-full"
					>
						<ToggleGroupItem value="fastener" class="flex-1"
							>{UI_TEXT.productType.fastener}</ToggleGroupItem
						>
						<ToggleGroupItem value="general" class="flex-1"
							>{UI_TEXT.productType.generalItem}</ToggleGroupItem
						>
					</ToggleGroup>
				</div>

				<div class="space-y-2">
					<label class="text-sm font-medium">{UI_TEXT.measurementSystem.label}</label>
					<ToggleGroup
						bind:value={measurementSystem}
						variant="outline"
						type="single"
						size="default"
						class="pointer-events-none w-full opacity-50"
					>
						<ToggleGroupItem value="metric" class="flex-1"
							>{UI_TEXT.measurementSystem.metric}</ToggleGroupItem
						>
						<ToggleGroupItem value="imperial" class="flex-1"
							>{UI_TEXT.measurementSystem.imperial}</ToggleGroupItem
						>
					</ToggleGroup>
				</div>
			</div>

			<!-- Primary and Secondary Text in one row -->
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
				<div class="space-y-2">
					<label for="primary-{index}" class="text-sm font-medium"
						>{UI_TEXT.fields.primaryText}</label
					>
					<Input
						id="primary-{index}"
						bind:value={primaryText}
						placeholder={UI_TEXT.placeholders.primaryText}
						onblur={updateLabel}
					/>
				</div>

				<div class="space-y-2">
					<label for="secondary-{index}" class="text-sm font-medium"
						>{UI_TEXT.fields.secondaryText}
						<span class="text-muted-foreground">{UI_TEXT.labels.optional}</span></label
					>
					<Input
						id="secondary-{index}"
						bind:value={secondaryText}
						placeholder={UI_TEXT.placeholders.secondaryText}
						onblur={updateLabel}
					/>
				</div>
			</div>

			<!-- Optional Note -->
			<div class="space-y-2">
				<label for="note-general-{index}" class="text-sm font-medium"
					>{UI_TEXT.fields.note}
					<span class="text-muted-foreground">{UI_TEXT.labels.optional}</span></label
				>
				<Input
					id="note-general-{index}"
					bind:value={note}
					placeholder={UI_TEXT.placeholders.additionalInfo}
					class="w-full"
					onblur={updateLabel}
				/>
			</div>
		</div>
	{/if}

	<!-- QR Code URL (common for both modes) -->
	<div class="space-y-2">
		<label for="qr-code-url-{index}" class="text-sm font-medium"
			>{UI_TEXT.fields.qrCode}
			<span class="text-muted-foreground">{UI_TEXT.labels.optional}</span></label
		>
		<Input
			id="qr-code-url-{index}"
			bind:value={qrCode}
			placeholder={UI_TEXT.placeholders.qrCode}
			class="w-full"
			disabled={qrDisabled}
			onblur={updateLabel}
		/>
	</div>

	<!-- Label Options Section -->
	<div class="space-y-4 border-t pt-4">
		<h4 class="font-medium">{UI_TEXT.cards.labelOptions}</h4>

		<!-- Toggle Switches in One Row -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#if isFastenerMode}
				<!-- Show Standard Code -->
				<div class="flex flex-col space-y-2">
					<div class="flex items-center justify-between">
						<div class="text-sm font-medium">{UI_TEXT.settings.standardReference.title}</div>
						<Switch bind:checked={showReference} disabled={!standardId} />
					</div>
					<div class="text-xs text-muted-foreground">
						{UI_TEXT.settings.standardReference.description}
					</div>
				</div>

				<!-- Product Icon -->
				<div class="flex flex-col space-y-2">
					<div class="flex items-center justify-between">
						<div class="text-sm font-medium">{UI_TEXT.settings.hardwareIcon.title}</div>
						<Switch
							bind:checked={showImage}
							disabled={!standardId}
							data-testid="hardware-image-switch-{index}"
						/>
					</div>
					<div class="text-xs text-muted-foreground">
						{UI_TEXT.settings.hardwareIcon.description}
					</div>
				</div>
			{/if}

			<!-- QR Code -->
			<div class="flex flex-col space-y-2">
				<div class="flex items-center justify-between">
					<div class="text-sm font-medium">{UI_TEXT.settings.qrCode.title}</div>
					<Switch
						bind:checked={showQRCode}
						disabled={qrDisabled}
						data-testid="qr-code-switch-{index}"
					/>
				</div>
				<div class="text-xs text-muted-foreground">
					{qrDisabled ? UI_TEXT.settings.qrCode.disabled9mm : UI_TEXT.settings.qrCode.description}
				</div>
			</div>
		</div>

		<!-- Label Width -->
		<div>
			<div class="mb-2 flex items-center justify-between">
				<span class="font-medium">{UI_TEXT.settings.dimensions.labelWidth}</span>
				<span class="text-sm font-medium">{width}mm</span>
			</div>
			<Slider
				bind:value={width}
				type="single"
				min={35}
				max={100}
				step={1}
				class="w-full"
				data-testid="width-slider-{index}"
			/>
		</div>
	</div>
</div>
