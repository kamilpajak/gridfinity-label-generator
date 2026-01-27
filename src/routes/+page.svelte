<script lang="ts">
	import * as Card from '$lib/components/ui/card';
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
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import WhatsNewModal from '$lib/components/whats-new/whats-new-modal.svelte';
	import WhatsNewButton from '$lib/components/whats-new/whats-new-button.svelte';
	import RecommendedProducts from '$lib/components/affiliate/recommended-products.svelte';

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
	import ImageUploader from '$lib/components/shared/image-uploader.svelte';
	import type { CustomImage } from '$lib/types/batch';
	import { UI_TEXT } from '$lib/constants/ui-text';

	const DEBOUNCE_DELAY_MS = 300;
	import { debounce } from '$lib/utils/debounce';

	let showStandard = $state(true);
	let showHardwareImage = $state(true);
	let showQRCode = $state(false);
	let whatsNewModalOpen = $state(false);

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
</script>

{#snippet mutedPlaceholder(text: string)}
	<span class="text-muted-foreground">{text}</span>
{/snippet}

<svelte:head>
	<title>Gridfinity Label Generator</title>
	<meta name="description" content="Print-Ready Labels for Your Gridfinity System" />
</svelte:head>

<!-- Hero Section -->
<section
	class="relative bg-gradient-to-r from-[#005c97] to-[#0c4a6e] px-4 py-6 text-white lg:px-8 lg:pt-12 lg:pb-24"
>
	<div class="pointer-events-none absolute inset-0 bg-black/10"></div>
	<div class="absolute -top-32 -right-32 hidden h-64 w-64 rounded-full bg-white/5 lg:block"></div>
	<div class="absolute -bottom-24 -left-24 hidden h-48 w-48 rounded-full bg-white/5 lg:block"></div>

	<div class="relative z-10 mx-auto max-w-7xl">
		<div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-start lg:gap-8">
			<div class="text-center lg:text-left">
				<h1 class="mb-1 text-2xl font-bold tracking-tight lg:mb-4 lg:text-5xl">
					Gridfinity Label Generator
				</h1>
				<p class="text-sm leading-relaxed font-light text-blue-100 lg:mb-6 lg:text-xl">
					Print-Ready Labels for Your Gridfinity System
				</p>
				<div
					class="hidden flex-wrap items-center justify-center gap-6 text-sm font-medium lg:flex lg:justify-start"
				>
					<div class="flex items-center gap-2">
						<svg
							class="h-5 w-5 text-emerald-400"
							fill="currentColor"
							viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
						<span>Easy Configuration</span>
					</div>
					<div class="flex items-center gap-2">
						<svg
							class="h-5 w-5 text-emerald-400"
							fill="currentColor"
							viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
						<span>Batch Processing</span>
					</div>
					<div class="flex items-center gap-2">
						<svg
							class="h-5 w-5 text-emerald-400"
							fill="currentColor"
							viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
						<span>Print Ready</span>
					</div>
				</div>
			</div>

			<div class="flex gap-2 lg:flex-col lg:gap-3">
				<WhatsNewButton onclick={() => (whatsNewModalOpen = true)} />
				<a
					href="https://www.buymeacoffee.com/kamilpajak"
					target="_blank"
					class="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-medium shadow-lg transition-colors hover:bg-amber-600 lg:flex-none lg:px-6 lg:py-3 lg:text-base"
				>
					<CoffeeIcon class="h-4 w-4 lg:h-5 lg:w-5" />
					<span class="sm:hidden">Support</span>
					<span class="hidden sm:inline">Buy me a Coffee</span>
				</a>
				<button
					onclick={provideFeedback}
					class="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-medium backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-white/20 lg:flex-none lg:px-6 lg:py-3 lg:text-base"
				>
					<SendIcon class="h-4 w-4 lg:h-5 lg:w-5" />
					Feedback
				</button>
			</div>
		</div>
	</div>
</section>

<div class="mx-auto max-w-7xl px-4 py-4 lg:-mt-16 lg:px-6 lg:pt-0 lg:pb-8">
	<!-- Tabs Component -->
	<Tabs.Root value="single" class="relative z-20 mx-auto w-full max-w-7xl">
		<div class="mb-4 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm lg:mb-6 lg:p-5">
			<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-0">
				<div class="text-center lg:text-left">
					<h2 class="text-lg font-bold text-slate-800 lg:text-xl">Label Creator</h2>
					<p class="mt-0.5 text-sm text-slate-500">Configure and generate your hardware labels.</p>
				</div>
				<Tabs.List class="flex w-full rounded-lg bg-slate-100 p-1 lg:w-auto">
					<Tabs.Trigger
						value="single"
						class="min-h-[44px] flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 lg:flex-none"
						>Single Label</Tabs.Trigger
					>
					<Tabs.Trigger
						value="batch"
						class="min-h-[44px] flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 lg:flex-none"
						>Batch Mode</Tabs.Trigger
					>
				</Tabs.List>
			</div>
		</div>

		<Tabs.Content value="single">
			<div class="grid grid-cols-12 gap-4 lg:gap-6">
				<div class="col-span-12 space-y-4 lg:col-span-8 lg:space-y-6">
					<Card.Root class="border-slate-200/50 shadow-xl">
						<Card.Header class="flex flex-row items-start justify-between space-y-0">
							<div>
								<Card.Title class="text-lg font-bold text-slate-800">Product Information</Card.Title
								>
								<Card.Description class="mt-1.5 hidden lg:block"
									>Configure your hardware label details</Card.Description
								>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onclick={clearForm}
								class="gap-2 text-muted-foreground hover:text-foreground"
								data-testid="clear-button"
							>
								<RotateCcwIcon class="h-4 w-4" />
								{UI_TEXT.buttons.clear}
							</Button>
						</Card.Header>
						<Card.Content class="space-y-6">
							<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
								<div class="space-y-2">
									<label class="text-sm font-medium">{UI_TEXT.productType.label}</label>
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
									<label class="text-sm font-medium">{UI_TEXT.measurementSystem.label}</label>
									<ToggleGroup
										value={measurementSystem}
										onValueChange={handleMeasurementSystemChange}
										variant="outline"
										type="single"
										size="default"
										class="w-full {measurementSystemDisabled
											? 'pointer-events-none opacity-50'
											: ''}"
									>
										<ToggleGroupItem
											value="metric"
											class="min-h-[44px] flex-1"
											data-testid="metric-button"
											>{UI_TEXT.measurementSystem.metric}</ToggleGroupItem
										>
										<ToggleGroupItem
											value="imperial"
											class="min-h-[44px] flex-1"
											data-testid="imperial-button"
											>{UI_TEXT.measurementSystem.imperial}</ToggleGroupItem
										>
									</ToggleGroup>
								</div>
							</div>

							{#if labelMode === 'fastener'}
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
											<Popover.Content class="w-[min(400px,calc(100vw-2rem))] p-0">
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
										<label for="optional-note" class="text-sm font-medium"
											>{UI_TEXT.fields.note}
											<span class="text-muted-foreground">{UI_TEXT.labels.optional}</span></label
										>
										<Input
											id="optional-note"
											bind:value={optionalNote}
											placeholder={UI_TEXT.placeholders.note}
											class="w-full"
											data-testid="optional-note-input"
										/>
									</div>
								</div>

								<div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
									<div class="space-y-2">
										<label for="thread-size" class="text-sm font-medium"
											>{UI_TEXT.fields.threadSize}</label
										>
										<Select bind:value={threadSize} type="single">
											<SelectTrigger
												id="thread-size"
												class="w-full"
												data-testid="thread-size-select"
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
										<label for="pitch" class="text-sm font-medium"
											>{UI_TEXT.fields.threadPitch}
											<span class="text-muted-foreground">{UI_TEXT.labels.optional}</span></label
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
									<div class="space-y-2">
										<label for="length" class="text-sm font-medium"
											>{UI_TEXT.fields.length} ({measurementSystem === 'metric'
												? 'mm'
												: 'in'})</label
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
								<div class="space-y-6">
									<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
										<div class="space-y-2">
											<label for="primary-text" class="text-sm font-medium"
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
											<label for="secondary-text" class="text-sm font-medium"
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
									</div>

									<!-- Custom Image (12mm only) -->
									{#if labelHeight === '12'}
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
												testId="custom-image-uploader-single"
											/>
										</div>
									{/if}
								</div>
							{/if}

							<div class="space-y-2">
								<label for="qr-code-url" class="text-sm font-medium"
									>{UI_TEXT.fields.qrCode}
									<span class="text-muted-foreground">{UI_TEXT.labels.optional}</span></label
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
						</Card.Content>
					</Card.Root>

					<!-- Label Preview Card -->
					<Card.Root class="gap-4 border-slate-200/50 py-4 shadow-xl">
						<Card.Header>
							<Card.Title class="text-lg font-bold text-slate-800"
								>{UI_TEXT.cards.labelPreview}</Card.Title
							>
						</Card.Header>
						<Card.Content>
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
							<div class="mt-4 flex justify-center">
								<Button
									onclick={downloadLabelAsPNG}
									variant="default"
									class="gap-2"
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
									<DownloadIcon class="h-4 w-4" />
									{UI_TEXT.buttons.downloadPNG}
								</Button>
							</div>
						</Card.Content>
					</Card.Root>
				</div>

				<div class="col-span-12 space-y-4 lg:col-span-4 lg:space-y-6">
					<!-- Mobile: simple div with collapsible -->
					<div class="rounded-xl border border-slate-200/60 bg-white shadow-sm lg:hidden">
						<button
							onclick={() => (settingsExpanded = !settingsExpanded)}
							class="flex w-full items-center justify-between p-4 text-left"
						>
							<span class="text-lg font-bold text-slate-800">{UI_TEXT.cards.labelSettings}</span>
							<ChevronDownIcon
								class="h-5 w-5 text-slate-400 transition-transform duration-200 {settingsExpanded
									? 'rotate-180'
									: ''}"
							/>
						</button>
						{#if settingsExpanded}
							<div transition:slide={{ duration: 200 }} class="px-4 pb-4">
								<LabelSettingsContent
									{showStandard}
									{showHardwareImage}
									{showQRCode}
									{labelHeight}
									{labelWidth}
									{standardReferenceDisabled}
									{hardwareImageDisabled}
									{qrCodeDisabled}
									onShowStandardChange={(v) => (showStandard = v)}
									onShowHardwareImageChange={(v) => (showHardwareImage = v)}
									onShowQRCodeChange={(v) => (showQRCode = v)}
									onLabelHeightChange={handleLabelHeightChange}
									onLabelWidthChange={(v) => (labelWidth = v)}
								/>
							</div>
						{/if}
					</div>
					<!-- Desktop: Card -->
					<Card.Root class="hidden border-slate-200/50 shadow-xl lg:block">
						<Card.Header>
							<Card.Title class="text-lg font-bold text-slate-800"
								>{UI_TEXT.cards.labelSettings}</Card.Title
							>
						</Card.Header>
						<Card.Content>
							<LabelSettingsContent
								{showStandard}
								{showHardwareImage}
								{showQRCode}
								{labelHeight}
								{labelWidth}
								{standardReferenceDisabled}
								{hardwareImageDisabled}
								{qrCodeDisabled}
								onShowStandardChange={(v) => (showStandard = v)}
								onShowHardwareImageChange={(v) => (showHardwareImage = v)}
								onShowQRCodeChange={(v) => (showQRCode = v)}
								onLabelHeightChange={handleLabelHeightChange}
								onLabelWidthChange={(v) => (labelWidth = v)}
							/>
						</Card.Content>
					</Card.Root>

					<RecommendedProducts />
				</div>
			</div>
		</Tabs.Content>

		<Tabs.Content value="batch">
			<BatchModePanel />
		</Tabs.Content>
	</Tabs.Root>
</div>

<WhatsNewModal
	bind:open={whatsNewModalOpen}
	onClose={() => (whatsNewModalOpen = false)}
	changelog={data.changelog}
/>
