<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Switch } from '$lib/components/ui/switch';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Slider } from '$lib/components/ui/slider';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import { standards, formatDesignations, HardwareType } from '$lib/data/standards';
	import LabelPreview from '$lib/components/label/label-preview.svelte';
	import { formatPrimaryText, formatSecondaryText } from '$lib/utils/label-formatter';
	import { exportCanvasLabelAsPNG } from '$lib/utils/label-exporter';

	let showStandard = $state(true);
	let showHardwareImage = $state(true);
	let showQRCode = $state(false);

	let labelMode = $state('fastener');
	let measurementSystem = $state('metric');
	let threadSize = $state('');
	let length = $state('');
	let primaryText = $state('');
	let secondaryText = $state('');
	let optionalNote = $state('');
	let qrCodeUrl = $state('');

	let measurementSystemDisabled = $derived(labelMode !== 'fastener');

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

	// Store previous values
	let previousLabelMode = 'fastener';
	let previousMeasurementSystem = 'metric';
	let previousLabelHeight = '12';

	// Ensure exactly one value is always selected
	$effect(() => {
		if (!labelMode || labelMode === '') {
			labelMode = previousLabelMode;
		} else {
			previousLabelMode = labelMode;
		}
	});

	$effect(() => {
		if (!measurementSystem || measurementSystem === '') {
			measurementSystem = previousMeasurementSystem;
		} else {
			previousMeasurementSystem = measurementSystem;
		}
	});

	$effect(() => {
		if (!labelHeight || labelHeight === '') {
			labelHeight = previousLabelHeight;
		} else {
			previousLabelHeight = labelHeight;
		}
	});

	// Reset thread size when measurement system changes
	$effect(() => {
		// Track measurementSystem dependency to reset threadSize when it changes
		if (measurementSystem || !measurementSystem) {
			threadSize = '';
		}
	});

	const threadSizePlaceholder = 'Select thread size';

	let labelHeight = $state('12');
	let labelWidth = $state(35);

	let standardsOpen = $state(false);
	let selectedStandardId = $state('');

	const standardsWithImages = $derived(standards.filter((s) => s.image));

	const selectedStandard = $derived(standards.find((s) => s.id === selectedStandardId));

	// Disable length input for nuts and washers (they don't have length specification)
	const lengthDisabled = $derived(
		selectedStandard?.hardwareType === HardwareType.NUT ||
			selectedStandard?.hardwareType === HardwareType.WASHER
	);

	// Dynamic placeholder based on hardware type and measurement system
	let lengthPlaceholder = $derived(
		lengthDisabled
			? 'N/A for this hardware type'
			: measurementSystem === 'metric'
				? 'Length in mm (e.g., 10, 25)'
				: 'Length in inches (e.g., 1/4, 3/8)'
	);

	function closeStandardsAndFocusTrigger() {
		standardsOpen = false;
	}

	// Derived values for label preview
	const labelPrimaryText = $derived(
		formatPrimaryText(labelMode, threadSize, lengthDisabled ? '' : length, primaryText)
	);

	const labelSecondaryText = $derived(formatSecondaryText(labelMode, secondaryText));

	// Disable QR Code for 9mm labels
	const qrCodeDisabled = $derived(labelHeight === '9');

	// Disable hardware-related options for 9mm labels or in general item mode
	const hardwareImageDisabled = $derived(labelHeight === '9' || labelMode === 'general');
	const standardReferenceDisabled = $derived(labelMode === 'general');

	// Reset QR Code and Hardware Image when switching to 9mm
	$effect(() => {
		if (labelHeight === '9') {
			if (showQRCode) {
				showQRCode = false;
			}
			if (showHardwareImage) {
				showHardwareImage = false;
			}
		}
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

		// Prepare full secondary text including optional note
		const fullSecondaryText =
			(labelSecondaryText ||
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
					: '')) + (optionalNote ? ` ${optionalNote}` : '');

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
</script>

<svelte:head>
	<title>Gridfinity Label Generator</title>
	<meta name="description" content="Print-Ready Labels for Your Gridfinity System" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Hero Section -->
	<div class="mb-8 text-center">
		<h1 class="mb-2 text-4xl font-bold">Gridfinity Label Generator</h1>
		<p class="text-xl text-muted-foreground">Print-Ready Labels for Your Gridfinity System</p>
	</div>

	<!-- Tabs Component -->
	<Tabs.Root value="single" class="mx-auto w-full max-w-6xl">
		<Tabs.List class="grid w-full grid-cols-2">
			<Tabs.Trigger value="single">Single Label</Tabs.Trigger>
			<Tabs.Trigger value="batch">Batch Mode</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="single" class="mt-6">
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div class="lg:col-span-2 space-y-6">
					<Card.Root>
						<Card.Header>
							<Card.Title>Label Content</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="flex flex-col gap-4 sm:grid sm:grid-cols-2">
								<ToggleGroup
									bind:value={labelMode}
									variant="outline"
									type="single"
									size="default"
									class="w-full"
									data-testid="label-mode-toggle"
								>
									<ToggleGroupItem value="fastener" class="flex-1" data-testid="mode-fastener"
										>Fastener</ToggleGroupItem
									>
									<ToggleGroupItem value="general" class="flex-1" data-testid="mode-general"
										>General Item</ToggleGroupItem
									>
								</ToggleGroup>

								<ToggleGroup
									bind:value={measurementSystem}
									variant="outline"
									type="single"
									size="default"
									class="w-full {measurementSystemDisabled ? 'pointer-events-none opacity-50' : ''}"
								>
									<ToggleGroupItem value="metric" class="flex-1" data-testid="metric-button"
										>Metric</ToggleGroupItem
									>
									<ToggleGroupItem value="imperial" class="flex-1" data-testid="imperial-button"
										>Imperial</ToggleGroupItem
									>
								</ToggleGroup>
							</div>

							{#if labelMode === 'fastener'}
								<div class="mt-4 flex flex-col gap-4 sm:grid sm:grid-cols-2">
									<div>
										<Select bind:value={threadSize} type="single">
											<SelectTrigger
												id="thread-size"
												class="w-full"
												data-testid="thread-size-select"
											>
												{threadSize || threadSizePlaceholder}
											</SelectTrigger>
											<SelectContent>
												{#each availableThreadSizes as size (size)}
													<SelectItem value={size}>{size}</SelectItem>
												{/each}
											</SelectContent>
										</Select>
									</div>
									<div>
										<Input
											id="length"
											bind:value={length}
											placeholder={lengthPlaceholder}
											class="w-full"
											disabled={lengthDisabled}
											data-testid="length-input"
										/>
									</div>
								</div>
							{:else}
								<div class="mt-4 space-y-4">
									<Input
										bind:value={primaryText}
										placeholder="Primary text (e.g., Resistors 10kΩ)"
										class="w-full"
										data-testid="primary-text-input"
									/>
									<Input
										bind:value={secondaryText}
										placeholder="Secondary text (e.g., 1/4W ±5%)"
										class="w-full"
										data-testid="secondary-text-input"
									/>
								</div>
							{/if}

							{#if labelMode === 'fastener'}
								<div class="mt-4 space-y-4">
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
													{selectedStandard
														? formatDesignations(selectedStandard)
														: 'Select ISO/DIN standard'}
													<ChevronsUpDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
												</Button>
											{/snippet}
										</Popover.Trigger>
										<Popover.Content class="w-[400px] p-0">
											<Command.Root>
												<Command.Input
													placeholder="Search standards..."
													data-testid="hardware-search-input"
												/>
												<Command.Empty>No standard with image found.</Command.Empty>
												<Command.Group class="max-h-[300px] overflow-y-auto">
													{#each standardsWithImages as standard (standard.id)}
														<Command.Item
															value={standard.id}
															onSelect={() => {
																selectedStandardId = standard.id;
																closeStandardsAndFocusTrigger();
															}}
															class="flex items-center justify-between"
														>
															<div class="flex flex-1 flex-col">
																<span>{formatDesignations(standard)}</span>
																<span class="text-xs text-muted-foreground"
																	>{standard.description}</span
																>
															</div>
															<img
																src={standard.image}
																alt={formatDesignations(standard)}
																class="ml-3 h-10 w-10 flex-shrink-0 object-contain"
															/>
														</Command.Item>
													{/each}
												</Command.Group>
											</Command.Root>
										</Popover.Content>
									</Popover.Root>
								</div>
							{/if}

							<div class="mt-4">
								<Input
									bind:value={optionalNote}
									placeholder="Optional note"
									class="w-full"
									data-testid="optional-note-input"
								/>
							</div>

							<div class="mt-4">
								<Input
									bind:value={qrCodeUrl}
									placeholder="QR code (URL, part number, etc.)"
									class="w-full"
									disabled={!showQRCode}
									data-testid="qr-code-url-input"
								/>
							</div>
						</Card.Content>
					</Card.Root>
					
					<!-- Label Preview Card -->
					<Card.Root>
						<Card.Header>
							<Card.Title>Label Preview</Card.Title>
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
									disabled={!hasContent}
									title={!hasContent ? 'Add some text to enable export' : 'Export label as PNG'}
									data-testid="export-button"
								>
									<DownloadIcon class="h-4 w-4" />
									Download PNG
								</Button>
							</div>
						</Card.Content>
					</Card.Root>
				</div>

				<div>
					<Card.Root>
						<Card.Header>
							<Card.Title>Label Settings</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="flex items-center justify-between space-x-2">
								<div class="space-y-0.5">
									<div class="font-medium">Standard Reference</div>
									<div class="text-sm text-muted-foreground">
										{standardReferenceDisabled
											? 'Not available for General items'
											: 'Display standard designation'}
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
									<div class="font-medium">Hardware Image</div>
									<div class="text-sm text-muted-foreground">
										{hardwareImageDisabled
											? labelHeight === '9'
												? 'Not available for 9mm labels'
												: 'Not available for General items'
											: 'Show fastener type icon'}
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
									<div class="font-medium">QR Code</div>
									<div class="text-sm text-muted-foreground">
										{qrCodeDisabled ? 'Not available for 9mm labels' : 'Add scannable code'}
									</div>
								</div>
								<Switch
									bind:checked={showQRCode}
									disabled={qrCodeDisabled}
									data-testid="qr-code-switch"
								/>
							</div>

							<div class="mt-4 border-t pt-4">
								<h4 class="mb-3 font-medium">Dimensions</h4>

								<div class="space-y-3">
									<div>
										<div class="mb-2 text-sm text-muted-foreground">Height (label tape)</div>
										<ToggleGroup
											bind:value={labelHeight}
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
											<span class="text-sm text-muted-foreground">Width</span>
											<span class="text-sm font-medium">{labelWidth}mm</span>
										</div>
										<Slider
											bind:value={labelWidth}
											type="single"
											min={30}
											max={80}
											step={1}
											class="w-full"
										/>
									</div>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
					
					<!-- Support Card -->
					<Card.Root class="mt-6">
						<Card.Header>
							<Card.Title>Support</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-3">
							<a 
								href="https://www.buymeacoffee.com/kamilpajak" 
								target="_blank" 
								class="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
							>
								☕ Buy me a coffee
							</a>
							<Button 
								onclick={provideFeedback} 
								variant="outline" 
								class="w-full gap-2"
							>
								<MessageSquareIcon class="h-4 w-4" />
								Feedback
							</Button>
						</Card.Content>
					</Card.Root>
				</div>
			</div>
		</Tabs.Content>

		<Tabs.Content value="batch" class="mt-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Batch Mode</Card.Title>
					<Card.Description>Create multiple labels at once</Card.Description>
				</Card.Header>
				<Card.Content>
					<!-- Placeholder for Batch Mode content -->
					<p class="text-muted-foreground">Batch Mode configuration will go here</p>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
