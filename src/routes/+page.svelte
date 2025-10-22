<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Switch } from '$lib/components/ui/switch';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { untrack } from 'svelte';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Slider } from '$lib/components/ui/slider';
	import * as Popover from '$lib/components/ui/popover';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button } from '$lib/components/ui/button';
	import StandardSearch from '$lib/components/shared/standard-search.svelte';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import InfoIcon from '@lucide/svelte/icons/info';
	import CoffeeIcon from '@lucide/svelte/icons/coffee';
	import SendIcon from '@lucide/svelte/icons/send';
	import {
		standards,
		formatDesignations,
		getStandardById,
		shouldDisableLength,
		shouldDisablePitch
	} from '$lib/data/standards';
	import { getPitchOptions } from '$lib/data/thread-pitch';
	import LabelPreview from '$lib/components/label/label-preview.svelte';
	import {
		formatPrimaryText,
		formatSecondaryText,
		appendOptionalNote
	} from '$lib/utils/label-formatter';
	import { exportCanvasLabelAsPNG } from '$lib/utils/label-exporter';
	import { validateLength, type ValidationResult } from '$lib/utils/input-validator';
	import BatchModePanel from '$lib/components/batch/batch-mode-panel.svelte';
	import { UI_TEXT } from '$lib/constants/ui-text';

	const DEBOUNCE_DELAY_MS = 300;
	import { debounce } from '$lib/utils/debounce';

	let showStandard = $state(true);
	let showHardwareImage = $state(true);
	let showQRCode = $state(false);

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

	// Thread size options
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

	let availableThreadSizes = $derived(
		measurementSystem === 'metric' ? metricThreadSizes : imperialThreadSizes
	);

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

	const standardsWithImages = $derived(standards.filter((s) => s.image));

	const selectedStandard = $derived(getStandardById(selectedStandardId ?? ''));

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

	// Reset Standard Reference and Hardware Image when switching to General Item mode
	$effect(() => {
		if (labelMode === 'general') {
			untrack(() => {
				if (showStandard) {
					showStandard = false;
				}
				if (showHardwareImage) {
					showHardwareImage = false;
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

		try {
			await exportCanvasLabelAsPNG({
				labelWidth: Number(labelWidth),
				labelHeight: Number(labelHeight),
				primaryText: labelPrimaryText,
				secondaryText: fullSecondaryText,
				standard: selectedStandard,
				showStandard,
				showHardwareImage,
				showQRCode,
				qrCodeUrl
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
	class="relative h-[280px] overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-sky-800"
>
	<div class="absolute inset-0 bg-black/10"></div>
	<div class="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-white/5"></div>
	<div class="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-white/5"></div>

	<div class="relative z-10 flex h-full items-center px-4 sm:px-6 lg:px-8">
		<div class="mx-auto w-full max-w-7xl">
			<div class="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-3">
				<div class="lg:col-span-2">
					<h1 class="mb-4 text-4xl font-bold tracking-tight text-white lg:text-5xl">
						Gridfinity Label Generator
					</h1>
					<p class="mb-6 text-lg leading-relaxed font-light text-sky-100 lg:text-xl">
						Print-Ready Labels for Your Gridfinity System
					</p>
					<div class="flex flex-wrap items-center gap-4 text-sky-100">
						<div class="flex items-center gap-2">
							<svg
								class="h-5 w-5 text-green-400"
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
							<span class="text-sm font-medium">Easy Configuration</span>
						</div>
						<div class="flex items-center gap-2">
							<svg
								class="h-5 w-5 text-green-400"
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
							<span class="text-sm font-medium">Batch Processing</span>
						</div>
						<div class="flex items-center gap-2">
							<svg
								class="h-5 w-5 text-green-400"
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
							<span class="text-sm font-medium">Print Ready</span>
						</div>
					</div>
				</div>

				<div class="flex flex-col gap-3">
					<a
						href="https://www.buymeacoffee.com/kamilpajak"
						target="_blank"
						class="inline-flex transform cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-medium text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-600 hover:shadow-xl"
					>
						<CoffeeIcon class="h-5 w-5" />
						Buy me a coffee
					</a>
					<button
						onclick={provideFeedback}
						class="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-medium text-white backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-white/20"
					>
						<SendIcon class="h-5 w-5" />
						Feedback
					</button>
				</div>
			</div>
		</div>
	</div>
</section>

<div class="container mx-auto -mt-8 px-4 pb-8">
	<!-- Tabs Component -->
	<Tabs.Root value="single" class="relative z-20 mx-auto w-full max-w-7xl">
		<div class="mb-6 rounded-2xl border border-slate-200/50 bg-white p-8 shadow-xl">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-2xl font-bold text-slate-800">Label Creator</h2>
					<p class="mt-1 text-slate-500">Configure and generate your hardware labels.</p>
				</div>
				<Tabs.List class="flex rounded-lg bg-slate-100 p-1">
					<Tabs.Trigger
						value="single"
						class="rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500"
						>Single Label</Tabs.Trigger
					>
					<Tabs.Trigger
						value="batch"
						class="rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500"
						>Batch Mode</Tabs.Trigger
					>
				</Tabs.List>
			</div>
		</div>

		<Tabs.Content value="single">
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div class="space-y-6 lg:col-span-2">
					<Card.Root class="border-slate-200/50 shadow-xl">
						<Card.Header class="flex flex-row items-start justify-between space-y-0">
							<div>
								<Card.Title>Product Information</Card.Title>
								<Card.Description class="mt-1.5"
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
										<ToggleGroupItem value="fastener" class="flex-1" data-testid="mode-fastener"
											>{UI_TEXT.productType.fastener}</ToggleGroupItem
										>
										<ToggleGroupItem value="general" class="flex-1" data-testid="mode-general"
											>{UI_TEXT.productType.generalItem}</ToggleGroupItem
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
										<ToggleGroupItem value="metric" class="flex-1" data-testid="metric-button"
											>{UI_TEXT.measurementSystem.metric}</ToggleGroupItem
										>
										<ToggleGroupItem value="imperial" class="flex-1" data-testid="imperial-button"
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
											<Popover.Content class="w-[400px] p-0">
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
									<div class="space-y-2">
										<label for="optional-note-general" class="text-sm font-medium"
											>{UI_TEXT.fields.note}
											<span class="text-muted-foreground">{UI_TEXT.labels.optional}</span></label
										>
										<Input
											id="optional-note-general"
											bind:value={optionalNote}
											placeholder={UI_TEXT.placeholders.additionalInfo}
											class="w-full"
											data-testid="optional-note-input"
										/>
									</div>
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
					<Card.Root class="border-slate-200/50 shadow-xl">
						<Card.Header>
							<Card.Title>{UI_TEXT.cards.labelPreview}</Card.Title>
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

				<div>
					<Card.Root class="border-slate-200/50 shadow-xl">
						<Card.Header>
							<Card.Title>{UI_TEXT.cards.labelSettings}</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-4">
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
										bind:checked={showStandard}
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
												{UI_TEXT.settings.hardwareIcon.description}<br />{UI_TEXT.settings
													.hardwareIcon.exclusiveWithQR}
											{:else}
												{UI_TEXT.settings.hardwareIcon.description}
											{/if}
										</div>
									</div>
									<Switch
										bind:checked={showHardwareImage}
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
										bind:checked={showQRCode}
										disabled={qrCodeDisabled}
										data-testid="qr-code-switch"
									/>
								</div>
							</Tooltip.Provider>

							<div class="mt-4 border-t pt-4">
								<h4 class="mb-3 font-medium">{UI_TEXT.settings.dimensions.title}</h4>

								<div class="space-y-3">
									<div>
										<div class="mb-2 text-sm text-muted-foreground">
											{UI_TEXT.settings.dimensions.labelHeight}
										</div>
										<ToggleGroup
											value={labelHeight}
											onValueChange={handleLabelHeightChange}
											variant="outline"
											type="single"
											class="w-full"
											data-testid="label-height-toggle"
										>
											<ToggleGroupItem value="9" class="flex-1">9mm</ToggleGroupItem>
											<ToggleGroupItem value="12" class="flex-1">12mm</ToggleGroupItem>
										</ToggleGroup>
									</div>

									<div>
										<div class="mb-2 flex items-center justify-between">
											<span class="text-sm text-muted-foreground"
												>{UI_TEXT.settings.dimensions.labelWidth}</span
											>
											<span class="text-sm font-medium">{labelWidth}mm</span>
										</div>
										<Slider
											bind:value={labelWidth}
											type="single"
											min={35}
											max={100}
											step={1}
											class="w-full"
										/>
									</div>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			</div>
		</Tabs.Content>

		<Tabs.Content value="batch">
			<BatchModePanel />
		</Tabs.Content>
	</Tabs.Root>
</div>
