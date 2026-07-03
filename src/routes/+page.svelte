<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs';
	import { Switch } from '$lib/components/ui/switch';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import StandardSearch from '$lib/components/shared/standard-search.svelte';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import CoffeeIcon from '@lucide/svelte/icons/coffee';
	import SendIcon from '@lucide/svelte/icons/send';
	import GithubIcon from '@lucide/svelte/icons/github';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import WhatsNewModal from '$lib/components/whats-new/whats-new-modal.svelte';
	import WhatsNewButton from '$lib/components/whats-new/whats-new-button.svelte';
	import RecommendedProducts from '$lib/components/affiliate/recommended-products.svelte';
	import PrivacyPolicyModal from '$lib/components/legal/privacy-policy-modal.svelte';

	let { data } = $props();
	import {
		standards,
		formatDesignations,
		getStandardById,
		shouldDisableLength,
		shouldDisablePitch
	} from '$lib/data/standards';
	import { getPitchOptions, getThreadSizes } from '$lib/data/thread-pitch';
	import LabelPreview from '$lib/components/label/label-preview.svelte';
	import LabelSettingsContent from '$lib/components/label/label-settings-content.svelte';
	import {
		formatPrimaryText,
		formatSecondaryText,
		appendOptionalNote
	} from '$lib/utils/label-formatter';
	import { exportCanvasLabelAsPNG } from '$lib/utils/label-exporter';
	import { validateLength, type ValidationResult } from '$lib/utils/input-validator';
	import BatchModePanel from '$lib/components/batch/batch-mode-panel.svelte';
	import { batchStore } from '$lib/stores/batch-store';
	import { formStateToBatchConfig } from '$lib/utils/batch-config';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ImageUploader from '$lib/components/shared/image-uploader.svelte';
	import type { CustomImage } from '$lib/types/batch';
	import { UI_TEXT } from '$lib/constants/ui-text';

	const DEBOUNCE_DELAY_MS = 300;
	import { debounce } from '$lib/utils/debounce';

	let showStandard = $state(true);
	let showHardwareImage = $state(true);
	let showQRCode = $state(false);
	let whatsNewModalOpen = $state(false);
	let privacyModalOpen = $state(false);

	// Single vs. Batch mode (drives the sidebar toggle + main content pane)
	let mode = $state('single');

	let labelMode = $state('fastener');
	let measurementSystem: 'metric' | 'imperial' = $state('metric');
	let threadSize = $state('');
	let pitch = $state('');
	let threadType = $state(''); // UNC/UNF for imperial, standard/fine for metric
	let length = $state('');
	let primaryText = $state('');
	let secondaryText = $state('');
	let optionalNote = $state('');
	let qrCodeUrl = $state('');

	// Custom image state (general mode only)
	let customImage = $state<CustomImage | undefined>(undefined);
	let showCustomImage = $state(true);

	let measurementSystemDisabled = $derived(labelMode !== 'fastener');

	// Validation state
	let lengthTouched = $state(false);
	let lengthValidationResult: ValidationResult = $state({ isValid: true });

	// Debounced validation functions
	const debouncedValidateLength = debounce((value: string, system: 'metric' | 'imperial') => {
		lengthValidationResult = validateLength(value, system);
	}, DEBOUNCE_DELAY_MS);

	// Validation effects
	$effect(() => {
		if (labelMode === 'fastener' && !lengthDisabled && length) {
			debouncedValidateLength(length, measurementSystem);
		} else {
			lengthValidationResult = { isValid: true };
		}
	});

	// Derived states for error visibility
	const showLengthError = $derived(lengthTouched && !lengthValidationResult.isValid);

	// Handlers to prevent deselection in ToggleGroup
	function handleLabelModeChange(value: string | undefined) {
		// Only update if value is truthy (prevents deselection)
		if (value) {
			labelMode = value;
		}
	}

	function handleMeasurementSystemChange(value: string | undefined) {
		// Only update if value is truthy (prevents deselection)
		if (value) {
			measurementSystem = value as 'metric' | 'imperial';
		}
	}

	function handleLabelHeightChange(value: string | undefined) {
		// Only update if value is truthy (prevents deselection)
		if (value) {
			labelHeight = value;
		}
	}

	// Reset thread size and pitch when measurement system changes
	$effect(() => {
		// Track measurementSystem dependency to reset threadSize when it changes
		if (measurementSystem || !measurementSystem) {
			threadSize = '';
			pitch = '';
		}
	});

	// Reset pitch when thread size changes
	$effect(() => {
		if (threadSize) {
			pitch = '';
		}
	});

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

	let labelHeight = $state('12');
	let labelWidth = $state(35);

	let standardsOpen = $state(false);
	let selectedStandardId = $state('');
	let settingsExpanded = $state(false);

	const standardsWithImages = $derived(standards.filter((s) => s.image));

	const selectedStandard = $derived(getStandardById(selectedStandardId ?? ''));

	// Thread sizes - determined by measurement system, hardware type, and standard
	// Wood screws use plain diameters, sheet metal self-tapping use ST-series
	const availableThreadSizes = $derived(
		getThreadSizes(
			measurementSystem as 'metric' | 'imperial',
			selectedStandard?.hardwareType,
			selectedStandard?.id
		)
	);

	// Reset thread size when hardware type changes (e.g., switching to/from self-tapping)
	// because available sizes are different (M-series vs ST-series)
	$effect(() => {
		const hwType = selectedStandard?.hardwareType;
		// Track hardware type - reset if current size is not in available list
		if (hwType !== undefined && threadSize && !availableThreadSizes.includes(threadSize)) {
			threadSize = '';
			pitch = '';
		}
	});

	// Disable length and pitch inputs based on hardware type
	const lengthDisabled = $derived(shouldDisableLength(selectedStandard?.hardwareType));
	const pitchDisabled = $derived(shouldDisablePitch(selectedStandard?.hardwareType));

	// Dynamic placeholder based on hardware type and measurement system
	let lengthPlaceholder = $derived(
		lengthDisabled
			? UI_TEXT.placeholders.lengthNA
			: measurementSystem === 'metric'
				? UI_TEXT.placeholders.lengthMetric
				: UI_TEXT.placeholders.lengthImperial
	);

	// Fastener completeness validation
	const isFastenerComplete = $derived(() => {
		if (labelMode !== 'fastener') return true;

		// Required: Standard and Thread Size
		if (!selectedStandardId || !threadSize) return false;

		// Required: Length for screws and bolts (unless disabled by hardware type)
		if (!lengthDisabled && !length) return false;

		return true;
	});

	// Form validity
	const isFormValid = $derived(lengthValidationResult.isValid && isFastenerComplete());

	function closeStandardsAndFocusTrigger() {
		standardsOpen = false;
	}

	// Derived values for label preview
	const labelPrimaryText = $derived(
		formatPrimaryText(
			labelMode,
			threadSize,
			// Only use length if it's not disabled AND it's valid
			lengthDisabled || !lengthValidationResult.isValid ? '' : length,
			primaryText,
			pitch || undefined,
			threadType || undefined,
			selectedStandard?.hardwareType
		)
	);

	const labelSecondaryText = $derived(formatSecondaryText(labelMode, secondaryText));

	// Disable QR Code for 9mm labels
	const qrCodeDisabled = $derived(labelHeight === '9');

	// Disable hardware-related options for 9mm labels or in general item mode
	const hardwareImageDisabled = $derived(labelHeight === '9' || labelMode === 'general');
	const standardReferenceDisabled = $derived(labelMode === 'general');

	// Show warning when both Hardware Icon and QR Code are enabled on narrow labels
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const showNarrowLabelWarning = $derived(
		labelWidth < 50 && showHardwareImage && showQRCode && !hardwareImageDisabled && !qrCodeDisabled
	);

	// Reset QR Code and Hardware Image when switching to 9mm
	$effect(() => {
		if (labelHeight === '9') {
			untrack(() => {
				if (showQRCode) {
					showQRCode = false;
				}
				if (showHardwareImage) {
					showHardwareImage = false;
				}
			});
		}
	});

	// Reset Standard Reference and Hardware Image based on mode
	$effect(() => {
		if (labelMode === 'general') {
			// General Item mode: disable hardware-related options
			untrack(() => {
				if (showStandard) {
					showStandard = false;
				}
				if (showHardwareImage) {
					showHardwareImage = false;
				}
			});
		} else if (labelMode === 'fastener') {
			// Fastener mode: restore default values (both enabled)
			// But respect 9mm constraint - hardware image not supported on 9mm labels
			untrack(() => {
				if (!showStandard) {
					showStandard = true;
				}
				if (!showHardwareImage && labelHeight !== '9') {
					showHardwareImage = true;
				}
			});
		}
	});

	// Mutual exclusion for Hardware Icon and QR Code on narrow labels
	// Track previous values to detect which one changed
	let prevShowHardwareImage = $state(showHardwareImage);
	let prevShowQRCode = $state(showQRCode);
	let prevLabelWidth = $state(labelWidth);

	$effect(() => {
		// Only apply mutual exclusion when width < 50mm and both are not disabled
		if (labelWidth < 50 && !hardwareImageDisabled && !qrCodeDisabled) {
			// Check if Hardware Icon was just enabled
			if (showHardwareImage && !prevShowHardwareImage && showQRCode) {
				untrack(() => {
					showQRCode = false;
				});
			}
			// Check if QR Code was just enabled
			else if (showQRCode && !prevShowQRCode && showHardwareImage) {
				untrack(() => {
					showHardwareImage = false;
				});
			}
			// Check if width just dropped below 50mm and both are enabled
			else if (prevLabelWidth >= 50 && showHardwareImage && showQRCode) {
				// Disable QR Code by default when width drops below 50mm
				untrack(() => {
					showQRCode = false;
				});
			}
		}

		// Update previous values
		prevShowHardwareImage = showHardwareImage;
		prevShowQRCode = showQRCode;
		prevLabelWidth = labelWidth;
	});

	// Canvas reference for export
	let canvasRef: HTMLCanvasElement | undefined = $state();

	// Check if we have any content to export
	const hasContent = $derived(
		labelPrimaryText?.trim() ||
			labelSecondaryText?.trim() ||
			optionalNote?.trim() ||
			(showStandard && selectedStandard) ||
			(showQRCode && qrCodeUrl?.trim())
	);

	// Download label as PNG
	async function downloadLabelAsPNG() {
		if (!hasContent) return;
		console.log('downloadLabelAsPNG called');

		// Prepare base secondary text (from labelSecondaryText or standard designation)
		const baseSecondaryText =
			labelSecondaryText ||
			(showStandard && selectedStandard
				? (() => {
						// Use only the primary designation for the label
						const primaryDesignation = selectedStandard.designations.find(
							(d) => d.system === selectedStandard.primarySystem
						);
						if (primaryDesignation) {
							return `${primaryDesignation.system} ${primaryDesignation.code}`;
						}
						// Fallback to first designation if primary not found
						return selectedStandard.designations.length > 0
							? `${selectedStandard.designations[0].system} ${selectedStandard.designations[0].code}`
							: '';
					})()
				: '');

		// Append optional note to base text
		const fullSecondaryText = appendOptionalNote(baseSecondaryText, optionalNote);

		console.log('Calling exportCanvasLabelAsPNG with:', {
			labelWidth: Number(labelWidth),
			labelHeight: Number(labelHeight),
			primaryText: labelPrimaryText,
			secondaryText: fullSecondaryText
		});

		// Determine effective showHardwareImage for export
		// In general mode, use custom image; in fastener mode, use hardware image
		const isGeneralItemMode = labelMode === 'general';
		const effectiveShowHardwareImage = isGeneralItemMode
			? showCustomImage && !!customImage
			: showHardwareImage;

		try {
			await exportCanvasLabelAsPNG({
				labelWidth: Number(labelWidth),
				labelHeight: Number(labelHeight),
				primaryText: labelPrimaryText,
				secondaryText: fullSecondaryText,
				standard: selectedStandard,
				showStandard: isGeneralItemMode ? false : showStandard,
				showHardwareImage: effectiveShowHardwareImage,
				showQRCode,
				qrCodeUrl,
				// New params for descriptive filenames
				labelMode: labelMode as 'fastener' | 'general',
				threadSize,
				length,
				// Custom image for general mode
				customImageSrc: isGeneralItemMode && showCustomImage ? customImage?.data : undefined,
				customImageAspectRatio:
					isGeneralItemMode && showCustomImage ? customImage?.aspectRatio : undefined
			});
			console.log('Export completed successfully');
		} catch (error) {
			console.error('Failed to export label:', error);
		}
	}

	// Provide feedback function
	function provideFeedback() {
		window.open(
			'https://docs.google.com/forms/d/e/1FAIpQLSegG3P2FED1dOJ1P5Pjv68R4bAq1IFFoc-2U-5_Gt-7IoSDvQ/viewform?usp=dialog',
			'_blank'
		);
	}

	// Clear all form fields
	function clearForm() {
		labelMode = 'fastener';
		measurementSystem = 'metric';
		threadSize = '';
		pitch = '';
		length = '';
		primaryText = '';
		secondaryText = '';
		optionalNote = '';
		qrCodeUrl = '';
		selectedStandardId = '';
		lengthTouched = false;
		customImage = undefined;
		showCustomImage = true;
	}

	// ---- Batch mode ----
	const batchState = $derived($batchStore);
	const canAddLabel = $derived(batchState.labels.length < batchState.maxLabels);

	// In batch mode the tape height is global (batchStore); mirror it into the
	// page's labelHeight so the shared form logic and the draft preview react to
	// it. The batch tape-height toggle only calls batchStore.setHeight.
	$effect(() => {
		if (mode === 'batch') {
			const h = String(batchState.height);
			untrack(() => {
				if (labelHeight !== h) {
					labelHeight = h;
				}
			});
		}
	});

	function handleBatchHeightChange(value: string | undefined) {
		if (value) {
			batchStore.setHeight(value === '9' ? 9 : 12);
		}
	}

	// Snapshot the current shared-form configuration into the batch.
	function handleAddCurrentLabel() {
		if (!canAddLabel) return;
		const config = formStateToBatchConfig({
			labelMode,
			measurementSystem,
			threadSize,
			pitch,
			threadType,
			length,
			primaryText,
			secondaryText,
			optionalNote,
			qrCodeUrl,
			selectedStandardId,
			showStandard,
			showHardwareImage,
			showQRCode,
			labelWidth,
			customImage,
			showCustomImage
		});
		batchStore.addLabel(config);
	}
</script>

{#snippet mutedPlaceholder(text: string)}
	<span class="text-muted-foreground">{text}</span>
{/snippet}

{#snippet requiredMark()}
	<span class="ml-0.5 text-destructive" title="Required" aria-label="required">*</span>
{/snippet}

<svelte:head>
	<title>Gridfinity Label Generator</title>
	<meta name="description" content="Print-Ready Labels for Your Gridfinity System" />
</svelte:head>

<!-- Dark two-pane workshop layout: sidebar (controls) + main (preview / batch) -->
<Tabs.Root
	bind:value={mode}
	class="flex min-h-screen flex-col gap-0 bg-slate-950 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:42px_42px] text-slate-200 selection:bg-cyan-500/30 lg:flex-row"
>
	<!-- LEFT SIDEBAR -->
	<aside
		class="custom-scrollbar order-1 w-full border-b border-slate-800/80 bg-slate-900/95 shadow-2xl backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:max-w-[340px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0"
	>
		<!-- Header block -->
		<div class="relative overflow-hidden border-b border-slate-800 bg-slate-950 p-6">
			<div
				class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-cyan-900/25 via-slate-950 to-slate-950"
			></div>
			<div class="relative space-y-4">
				<div
					class="flex items-center gap-2 text-[10px] font-bold tracking-widest text-amber-500 uppercase"
				>
					<span class="h-px w-6 bg-amber-500"></span>
					Workshop-Grade Labels
				</div>
				<h1 class="text-[34px] leading-[0.9] font-black tracking-tighter text-white uppercase">
					Gridfinity <br />Label <br /><span class="text-cyan-400">Generator</span>
				</h1>
				<div>
					<WhatsNewButton onclick={() => (whatsNewModalOpen = true)} />
				</div>
			</div>
		</div>

		<div class="space-y-8 p-6">
			<!-- Mode toggle -->
			<Tabs.List
				class="flex h-auto w-full overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/50 p-1"
			>
				<Tabs.Trigger
					value="single"
					class="h-auto min-h-[44px] flex-1 rounded-lg px-4 py-2 text-xs font-bold text-slate-500 transition-all hover:text-slate-300 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-slate-600 dark:text-slate-500 dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white"
					>Single Label</Tabs.Trigger
				>
				<Tabs.Trigger
					value="batch"
					class="h-auto min-h-[44px] flex-1 rounded-lg px-4 py-2 text-xs font-bold text-slate-500 transition-all hover:text-slate-300 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-slate-600 dark:text-slate-500 dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white"
					>Batch Mode</Tabs.Trigger
				>
			</Tabs.List>

			<!-- Product Information (shared by single + batch) -->
			<div class="space-y-5">
				<div class="flex items-center justify-between">
					<h2 class="text-xs font-bold tracking-widest text-slate-400 uppercase">
						Product Information
					</h2>
					<Button
						variant="ghost"
						size="sm"
						onclick={clearForm}
						class="gap-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase hover:bg-slate-800 hover:text-slate-300"
						data-testid="clear-button"
					>
						<RotateCcwIcon class="h-3 w-3" />
						{UI_TEXT.buttons.clear}
					</Button>
				</div>

				<div class="space-y-5">
					<div class="space-y-2">
						<label class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
							>{UI_TEXT.productType.label}</label
						>
						<ToggleGroup
							value={labelMode}
							onValueChange={handleLabelModeChange}
							variant="outline"
							type="single"
							size="default"
							class="w-full"
							data-testid="label-mode-toggle"
						>
							<ToggleGroupItem
								value="fastener"
								class="min-h-[44px] flex-1"
								data-testid="mode-fastener">{UI_TEXT.productType.fastener}</ToggleGroupItem
							>
							<ToggleGroupItem
								value="general"
								class="min-h-[44px] flex-1"
								data-testid="mode-general">{UI_TEXT.productType.generalItem}</ToggleGroupItem
							>
						</ToggleGroup>
					</div>

					<div class="space-y-2">
						<label class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
							>{UI_TEXT.measurementSystem.label}</label
						>
						<ToggleGroup
							value={measurementSystem}
							onValueChange={handleMeasurementSystemChange}
							variant="outline"
							type="single"
							size="default"
							class="w-full {measurementSystemDisabled ? 'pointer-events-none opacity-50' : ''}"
						>
							<ToggleGroupItem
								value="metric"
								class="min-h-[44px] flex-1"
								data-testid="metric-button">{UI_TEXT.measurementSystem.metric}</ToggleGroupItem
							>
							<ToggleGroupItem
								value="imperial"
								class="min-h-[44px] flex-1"
								data-testid="imperial-button">{UI_TEXT.measurementSystem.imperial}</ToggleGroupItem
							>
						</ToggleGroup>
					</div>
				</div>

				{#if labelMode === 'fastener'}
					<div class="space-y-2">
						<label class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
							>{UI_TEXT.fields.standard}{@render requiredMark()}</label
						>
						<Popover.Root bind:open={standardsOpen}>
							<Popover.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="outline"
										role="combobox"
										aria-expanded={standardsOpen}
										class="w-full justify-between font-normal"
										data-testid="hardware-select"
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
							<!-- Width: max 400px on desktop, full viewport minus 1rem padding on each side on mobile -->
							<Popover.Content
								class="w-[min(400px,calc(100vw-2rem))] rounded-xl border-slate-700 p-0 shadow-2xl"
							>
								<StandardSearch
									standards={standardsWithImages}
									onSelect={(id) => {
										selectedStandardId = id;
										closeStandardsAndFocusTrigger();
									}}
								/>
							</Popover.Content>
						</Popover.Root>
					</div>

					<div class="space-y-2">
						<label
							for="optional-note"
							class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
							>{UI_TEXT.fields.note}</label
						>
						<Input
							id="optional-note"
							bind:value={optionalNote}
							placeholder={UI_TEXT.placeholders.note}
							class="w-full"
							data-testid="optional-note-input"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<label
								for="thread-size"
								class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
								>{UI_TEXT.fields.threadSize}{@render requiredMark()}</label
							>
							<Select bind:value={threadSize} type="single">
								<SelectTrigger id="thread-size" class="w-full" data-testid="thread-size-select">
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
							<label
								for="pitch"
								class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
								>{UI_TEXT.fields.threadPitch}</label
							>
							<Select bind:value={pitch} type="single">
								<SelectTrigger
									id="pitch"
									class="w-full"
									data-testid="pitch-select"
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
						<div class="col-span-2 space-y-2">
							<label
								for="length"
								class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
								>{UI_TEXT.fields.length} ({measurementSystem === 'metric'
									? 'mm'
									: 'in'}){#if !lengthDisabled}{@render requiredMark()}{/if}</label
							>
							<Input
								id="length"
								bind:value={length}
								placeholder={lengthPlaceholder}
								class="w-full {showLengthError ? 'border-destructive' : ''}"
								disabled={lengthDisabled}
								data-testid="length-input"
								onblur={() => (lengthTouched = true)}
								aria-invalid={showLengthError}
							/>
							{#if showLengthError}
								<p class="mt-1 text-sm text-destructive">
									{lengthValidationResult.message}
								</p>
							{/if}
						</div>
					</div>
				{:else}
					<div class="space-y-5">
						<div class="space-y-2">
							<label
								for="primary-text"
								class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
								>{UI_TEXT.fields.primaryText}</label
							>
							<Input
								id="primary-text"
								bind:value={primaryText}
								placeholder={UI_TEXT.placeholders.primaryText}
								class="w-full"
								data-testid="primary-text-input"
							/>
						</div>
						<div class="space-y-2">
							<label
								for="secondary-text"
								class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
								>{UI_TEXT.fields.secondaryText}</label
							>
							<Input
								id="secondary-text"
								bind:value={secondaryText}
								placeholder={UI_TEXT.placeholders.secondaryText}
								class="w-full"
								data-testid="secondary-text-input"
							/>
						</div>

						<!-- Custom Image (12mm only) -->
						{#if labelHeight === '12'}
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<label class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase">
										Custom Image
									</label>
									{#if customImage}
										<div class="flex items-center gap-2">
											<span class="text-xs text-slate-400">Show on label</span>
											<Switch bind:checked={showCustomImage} />
										</div>
									{/if}
								</div>
								<ImageUploader
									bind:value={customImage}
									disabled={false}
									testId="custom-image-uploader-single"
								/>
							</div>
						{/if}
					</div>
				{/if}

				<div class="space-y-2">
					<label
						for="qr-code-url"
						class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
						>{UI_TEXT.fields.qrCode}</label
					>
					<Input
						id="qr-code-url"
						bind:value={qrCodeUrl}
						placeholder={UI_TEXT.placeholders.qrCode}
						class="w-full"
						disabled={!showQRCode || qrCodeDisabled}
						data-testid="qr-code-url-input"
					/>
				</div>
			</div>

			<hr class="border-slate-800/60" />

			<!-- Label Settings: mobile collapsible -->
			<div class="lg:hidden">
				<button
					onclick={() => (settingsExpanded = !settingsExpanded)}
					class="flex w-full items-center justify-between text-left"
				>
					<span class="text-xs font-bold tracking-widest text-slate-400 uppercase"
						>{UI_TEXT.cards.labelSettings}</span
					>
					<ChevronDownIcon
						class="h-5 w-5 text-slate-500 transition-transform duration-200 {settingsExpanded
							? 'rotate-180'
							: ''}"
					/>
				</button>
				{#if settingsExpanded}
					<div transition:slide={{ duration: 200 }} class="pt-4">
						<LabelSettingsContent
							{showStandard}
							{showHardwareImage}
							{showQRCode}
							{labelHeight}
							{labelWidth}
							{standardReferenceDisabled}
							{hardwareImageDisabled}
							{qrCodeDisabled}
							hideHeight={mode === 'batch'}
							onShowStandardChange={(v) => (showStandard = v)}
							onShowHardwareImageChange={(v) => (showHardwareImage = v)}
							onShowQRCodeChange={(v) => (showQRCode = v)}
							onLabelHeightChange={handleLabelHeightChange}
							onLabelWidthChange={(v) => (labelWidth = v)}
						/>
					</div>
				{/if}
			</div>

			<!-- Label Settings: desktop inline -->
			<div class="hidden lg:block">
				<h2 class="mb-5 text-xs font-bold tracking-widest text-slate-400 uppercase">
					{UI_TEXT.cards.labelSettings}
				</h2>
				<LabelSettingsContent
					{showStandard}
					{showHardwareImage}
					{showQRCode}
					{labelHeight}
					{labelWidth}
					{standardReferenceDisabled}
					{hardwareImageDisabled}
					{qrCodeDisabled}
					hideHeight={mode === 'batch'}
					onShowStandardChange={(v) => (showStandard = v)}
					onShowHardwareImageChange={(v) => (showHardwareImage = v)}
					onShowQRCodeChange={(v) => (showQRCode = v)}
					onLabelHeightChange={handleLabelHeightChange}
					onLabelWidthChange={(v) => (labelWidth = v)}
				/>
			</div>
			<hr class="border-slate-800/60" />

			{#if mode === 'single'}
				<RecommendedProducts />
			{:else}
				<!-- Batch Settings -->
				<div class="space-y-5">
					<h2 class="text-xs font-bold tracking-widest text-slate-400 uppercase">Batch Settings</h2>

					<div class="space-y-2">
						<label class="block text-[11px] font-bold tracking-wide text-slate-400 uppercase"
							>Tape Height (Global)</label
						>
						<ToggleGroup
							value={String(batchState.height)}
							onValueChange={handleBatchHeightChange}
							variant="outline"
							type="single"
							class="w-full"
							data-testid="tape-height-toggle"
						>
							<ToggleGroupItem value="9" class="min-h-[44px] flex-1" data-testid="tape-height-9mm"
								>9mm</ToggleGroupItem
							>
							<ToggleGroupItem value="12" class="min-h-[44px] flex-1" data-testid="tape-height-12mm"
								>12mm</ToggleGroupItem
							>
						</ToggleGroup>
					</div>

					<div class="flex items-center justify-between text-sm">
						<span class="font-bold text-slate-300">Progress</span>
						<span class="font-mono text-xs text-cyan-400" data-testid="batch-progress-text"
							>{batchState.labels.length} / {batchState.maxLabels} labels</span
						>
					</div>

					<Button
						onclick={handleAddCurrentLabel}
						disabled={!canAddLabel}
						class="w-full gap-2 font-bold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40"
						data-testid="add-label-button"
					>
						<PlusIcon class="h-4 w-4" />
						Add Current Label
						{#if !canAddLabel}
							<span class="text-xs">(Max {batchState.maxLabels})</span>
						{/if}
					</Button>
				</div>
			{/if}
		</div>
	</aside>

	<!-- MAIN AREA -->
	<main
		class="custom-scrollbar order-2 flex flex-1 flex-col bg-gradient-to-br from-cyan-900/10 via-slate-950/50 to-indigo-900/10 lg:h-screen lg:overflow-y-auto"
	>
		<div class="flex flex-1 flex-col p-4 sm:p-8 lg:p-12">
			<Tabs.Content value="single" class="flex flex-1 flex-col items-center justify-center gap-8">
				{#if mode === 'single'}
					<LabelPreview
						primaryText={labelPrimaryText}
						secondaryText={labelSecondaryText}
						{optionalNote}
						standard={selectedStandard}
						{showStandard}
						{showHardwareImage}
						{showQRCode}
						{qrCodeUrl}
						labelHeight={parseInt(labelHeight)}
						{labelWidth}
						bind:canvasRef
						{customImage}
						{showCustomImage}
					/>
					<Button
						onclick={downloadLabelAsPNG}
						variant="default"
						size="lg"
						class="h-auto gap-2 rounded-xl px-8 py-4 text-sm font-bold shadow-lg shadow-cyan-500/25 transition-shadow hover:shadow-[0_0_30px_rgba(6,182,212,0.45)]"
						disabled={!hasContent || !isFormValid}
						title={!hasContent
							? UI_TEXT.errors.addTextToExport
							: !isFastenerComplete()
								? UI_TEXT.errors.fastenerIncomplete
								: !isFormValid
									? UI_TEXT.errors.fixValidation
									: UI_TEXT.errors.exportTitle}
						data-testid="export-button"
					>
						<DownloadIcon class="h-5 w-5" />
						{UI_TEXT.buttons.downloadPNG}
					</Button>
				{/if}
			</Tabs.Content>

			<Tabs.Content value="batch" class="flex-1">
				{#if mode === 'batch'}
					<div class="mx-auto w-full max-w-4xl space-y-12 py-4">
						<!-- Draft preview of the current sidebar configuration -->
						<div class="space-y-4">
							<h2 class="text-center text-sm font-bold tracking-widest text-slate-400 uppercase">
								Draft Label Preview
							</h2>
							<div
								class="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-8 backdrop-blur"
								data-testid="batch-draft-preview"
							>
								<LabelPreview
									primaryText={labelPrimaryText}
									secondaryText={labelSecondaryText}
									{optionalNote}
									standard={selectedStandard}
									{showStandard}
									{showHardwareImage}
									{showQRCode}
									{qrCodeUrl}
									labelHeight={parseInt(labelHeight)}
									{labelWidth}
									{customImage}
									{showCustomImage}
								/>
							</div>
						</div>

						<!-- Batch collection + export -->
						<BatchModePanel />
					</div>
				{/if}
			</Tabs.Content>

			<!-- Footer -->
			<footer
				class="mt-16 flex flex-col items-center gap-6 border-t border-slate-800/50 pt-8 pb-4 text-xs text-slate-500"
			>
				<div class="flex flex-wrap items-center justify-center gap-4">
					<a
						href="https://github.com/kamilpajak/gridfinity-label-generator"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="View source on GitHub"
						class="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 shadow-md transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200"
					>
						<GithubIcon class="h-4 w-4" />
						<span class="font-medium">GitHub</span>
					</a>
					<button
						onclick={provideFeedback}
						class="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 shadow-md transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200"
					>
						<SendIcon class="h-4 w-4" />
						<span class="font-medium">Feedback</span>
					</button>
					<a
						href="https://www.buymeacoffee.com/kamilpajak"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-2 rounded-full border border-amber-600/50 bg-slate-900 px-4 py-2 text-amber-500 shadow-md transition-all hover:border-amber-500 hover:bg-slate-800"
					>
						<CoffeeIcon class="h-4 w-4" />
						<span class="font-medium">Buy me a Coffee</span>
					</a>
				</div>

				<div
					class="flex flex-wrap items-center justify-center gap-3 rounded-full border border-slate-800 bg-slate-900 px-5 py-2.5 text-slate-400 shadow-sm"
				>
					<p>Made with <span class="text-red-500">&hearts;</span> for the Gridfinity community</p>
					<span class="hidden text-slate-700 sm:inline">&middot;</span>
					<button
						onclick={() => (privacyModalOpen = true)}
						class="transition-colors hover:text-slate-300">Privacy Policy</button
					>
				</div>
			</footer>
		</div>
	</main>
</Tabs.Root>

<WhatsNewModal
	bind:open={whatsNewModalOpen}
	onClose={() => (whatsNewModalOpen = false)}
	changelog={data.changelog}
/>

<PrivacyPolicyModal bind:open={privacyModalOpen} onClose={() => (privacyModalOpen = false)} />
