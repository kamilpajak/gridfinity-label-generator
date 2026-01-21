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
	import ImageUploader from '$lib/components/shared/image-uploader.svelte';
	import {
		standards,
		formatDesignations,
		getStandardById,
		HardwareType,
		shouldDisableLength,
		shouldDisablePitch
	} from '$lib/data/standards';
	import { getPitchOptions, getThreadSizes } from '$lib/data/thread-pitch';
	import { parseFraction } from '$lib/utils/fraction-parser';
	import type {
		BatchLabelConfig,
		FastenerLabelConfig,
		GeneralLabelConfig,
		CustomImage
	} from '$lib/types/batch';
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

	// Width threshold (in mm) below which Hardware Icon and QR Code are mutually exclusive
	const NARROW_LABEL_WIDTH_THRESHOLD = 50;

	// Standards with images
	const standardsWithImages = $derived(standards.filter((s) => s.image));

	// Local state for controlled inputs
	let labelMode = $state(label.mode);
	let measurementSystem = $state<'metric' | 'imperial'>(
		isFastenerMode ? (label as FastenerLabelConfig).measurementSystem : 'metric'
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
	let showQRCode = $state(label.showQRCode ?? false);

	// Custom image state (general mode only)
	let customImage = $state<CustomImage | undefined>(
		!isFastenerMode ? (label as GeneralLabelConfig).customImage : undefined
	);
	let showCustomImage = $state(
		!isFastenerMode ? ((label as GeneralLabelConfig).showCustomImage ?? true) : false
	);

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
		showQRCode = label.showQRCode ?? false;
		customImage = !isFastenerMode ? (label as GeneralLabelConfig).customImage : undefined;
		showCustomImage = !isFastenerMode
			? ((label as GeneralLabelConfig).showCustomImage ?? true)
			: false;
	});

	const selectedStandard = $derived(getStandardById(standardId));

	// Thread sizes - determined by measurement system, hardware type, and standard
	// Wood screws use plain diameters, sheet metal self-tapping use ST-series
	const availableThreadSizes = $derived(
		getThreadSizes(measurementSystem, selectedStandard?.hardwareType, selectedStandard?.id)
	);

	// Reset thread size when hardware type changes (e.g., switching to/from self-tapping)
	$effect(() => {
		const hwType = selectedStandard?.hardwareType;
		if (hwType !== undefined && threadSize && !availableThreadSizes.includes(threadSize)) {
			threadSize = '';
			pitch = '';
		}
	});

	// Disable hardware-related options for 9mm labels or in general item mode
	const hardwareImageDisabled = $derived(tapeHeight === 9 || labelMode === 'general');
	const standardReferenceDisabled = $derived(labelMode === 'general');

	// Disable QR code for 9mm tape
	const qrCodeDisabled = $derived(qrDisabled);

	// Reset QR Code when switching to 9mm
	$effect(() => {
		if (tapeHeight === 9) {
			untrack(() => {
				if (showQRCode) {
					showQRCode = false;
				}
				if (showImage) {
					showImage = false;
				}
			});
		}
	});

	// Reset hardware-related switches when switching to General Item mode
	$effect(() => {
		if (labelMode === 'general') {
			untrack(() => {
				if (showReference) {
					showReference = false;
				}
				if (showImage) {
					showImage = false;
				}
			});
		}
	});

	// Mutual exclusion for Hardware Icon and QR Code on narrow labels (<50mm)
	// Track previous values to detect which one changed
	let prevShowImage = $state(showImage);
	let prevShowQRCode = $state(showQRCode);
	let prevWidth = $state(width);
	let mutualExclusionInitialized = $state(false);

	$effect(() => {
		// Apply mutual exclusion when width < NARROW_LABEL_WIDTH_THRESHOLD
		// Note: We check the 'checked' state (showImage/showQRCode) regardless of disabled state
		// because we want to prevent both from being checked simultaneously even if one is disabled
		if (width < NARROW_LABEL_WIDTH_THRESHOLD) {
			// BUGFIX: On first run, if both switches are checked, uncheck QR Code
			// This handles the initial state where both default to true
			if (!mutualExclusionInitialized && showImage && showQRCode) {
				untrack(() => {
					showQRCode = false;
					mutualExclusionInitialized = true;
				});
			}
			// Only apply dynamic mutual exclusion if neither switch is disabled
			else if (!hardwareImageDisabled && !qrCodeDisabled) {
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
				// Check if width was just reduced below threshold while both were enabled
				else if (
					prevWidth >= NARROW_LABEL_WIDTH_THRESHOLD &&
					width < NARROW_LABEL_WIDTH_THRESHOLD &&
					showImage &&
					showQRCode
				) {
					// Prefer keeping Hardware Icon, disable QR Code
					untrack(() => {
						showQRCode = false;
					});
				} else if (!mutualExclusionInitialized) {
					// Mark as initialized even if both weren't enabled
					mutualExclusionInitialized = true;
				}
			} else if (!mutualExclusionInitialized) {
				// Mark as initialized if one or both switches are disabled
				mutualExclusionInitialized = true;
			}
		} else if (!mutualExclusionInitialized) {
			// Mark as initialized if width >= threshold
			mutualExclusionInitialized = true;
		}

		// Update previous values for next change detection
		prevShowImage = showImage;
		prevShowQRCode = showQRCode;
		prevWidth = width;
	});

	// Disable length and pitch inputs based on hardware type
	const lengthDisabled = $derived(shouldDisableLength(selectedStandard?.hardwareType));
	const pitchDisabled = $derived(shouldDisablePitch(selectedStandard?.hardwareType));

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
				length: parseFraction(length),
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
				showQRCode,
				customImage,
				showCustomImage
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
			showQRCode,
			customImage,
			showCustomImage
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
	let previousThreadSize = $state(threadSize);
	$effect(() => {
		if (threadSize !== previousThreadSize) {
			pitch = '';
			previousThreadSize = threadSize;
		}
	});

	// Clear length and thread fields when changing to washer/nut (which don't have threads or length)
	let previousStandardId = $state(standardId);
	$effect(() => {
		// Only clear if standard actually changed (not just initial load)
		if (standardId !== previousStandardId) {
			const newStandard = getStandardById(standardId);
			if (
				newStandard &&
				(newStandard.hardwareType === HardwareType.NUT ||
					newStandard.hardwareType === HardwareType.WASHER)
			) {
				// Clear all thread-related fields and length for washers/nuts
				threadSize = '';
				pitch = '';
				threadType = '';
				length = '';
			}
			previousStandardId = standardId;
		}
	});

	function handleDuplicate() {
		batchStore.duplicateLabel(index);
	}

	function handleDelete() {
		batchStore.removeLabel(index);
	}
</script>

{#snippet mutedPlaceholder(text: string)}
	<span class="text-muted-foreground">{text}</span>
{/snippet}

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
						data-testid="label-mode-toggle-{index}"
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
									data-testid="batch-hardware-select-{index}"
								>
									{#if selectedStandard}
										{formatDesignations(selectedStandard)}
									{:else}
										{@render mutedPlaceholder(UI_TEXT.placeholders.selectStandard)}
									{/if}
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
						<SelectTrigger
							id="thread-size-{index}"
							class="w-full"
							data-testid="batch-thread-size-select-{index}"
						>
							{#if threadSize}
								{threadSize}
							{:else}
								{@render mutedPlaceholder(UI_TEXT.placeholders.selectSize)}
							{/if}
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
						<SelectTrigger
							id="pitch-{index}"
							class="w-full"
							data-testid="batch-pitch-select-{index}"
							disabled={pitchDisabled}
						>
							{#if pitch}
								{availablePitchOptions.find((p) => p.value === pitch)?.label}
							{:else}
								{@render mutedPlaceholder(UI_TEXT.placeholders.selectPitch)}
							{/if}
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
						data-testid="label-mode-toggle-{index}"
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
						data-testid="primary-text-input-{index}"
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

			<!-- Custom Image (12mm only) -->
			{#if tapeHeight === 12}
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<label class="text-sm font-medium">
							Custom Image
							<span class="text-muted-foreground">{UI_TEXT.labels.optional}</span>
						</label>
						{#if customImage}
							<div class="flex items-center gap-2">
								<span class="text-sm text-muted-foreground">Show on label</span>
								<Switch bind:checked={showCustomImage} />
							</div>
						{/if}
					</div>
					<ImageUploader
						bind:value={customImage}
						disabled={false}
						testId="custom-image-uploader-{index}"
					/>
				</div>
			{/if}
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
			disabled={!showQRCode || qrCodeDisabled}
			onblur={updateLabel}
		/>
	</div>

	<!-- Label Options Section -->
	<div class="space-y-4 border-t pt-4">
		<h4 class="font-medium">{UI_TEXT.cards.labelOptions}</h4>

		{#if isFastenerMode}
			<!-- Fastener Mode: Toggle Switches in One Row -->
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<!-- Show Standard Code -->
				<div class="flex flex-col space-y-2">
					<div class="flex items-center justify-between">
						<div class="text-sm font-medium">{UI_TEXT.settings.standardReference.title}</div>
						<Switch
							bind:checked={showReference}
							disabled={standardReferenceDisabled}
							data-testid="standard-reference-switch-{index}"
						/>
					</div>
					<div class="text-xs text-muted-foreground">
						{standardReferenceDisabled
							? UI_TEXT.settings.standardReference.disabledGeneral
							: UI_TEXT.settings.standardReference.description}
					</div>
				</div>

				<!-- Product Icon -->
				<div class="flex flex-col space-y-2">
					<div class="flex items-center justify-between">
						<div class="text-sm font-medium">{UI_TEXT.settings.hardwareIcon.title}</div>
						<Switch
							bind:checked={showImage}
							disabled={hardwareImageDisabled}
							data-testid="hardware-image-switch-{index}"
						/>
					</div>
					<div class="text-xs text-muted-foreground">
						{#if hardwareImageDisabled}
							{tapeHeight === 9
								? UI_TEXT.settings.hardwareIcon.disabled9mm
								: UI_TEXT.settings.hardwareIcon.disabledGeneral}
						{:else}
							{UI_TEXT.settings.hardwareIcon.description}
						{/if}
					</div>
				</div>

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
		{:else}
			<!-- General Mode: QR Code toggle and Label Width in same row -->
			<div class="flex flex-col gap-6 sm:flex-row sm:items-start">
				<!-- QR Code (fixed width) -->
				<div class="flex flex-col space-y-2 sm:shrink-0">
					<div class="flex items-center justify-between gap-4">
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

				<!-- Label Width (takes remaining space) -->
				<div class="min-w-0 flex-1">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm font-medium">{UI_TEXT.settings.dimensions.labelWidth}</span>
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
		{/if}
	</div>
</div>
