<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Slider } from '$lib/components/ui/slider';
	import { Switch } from '$lib/components/ui/switch';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import { batchStore } from '$lib/stores/batch-store';
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
	let length = $state(isFastenerMode ? (label as FastenerLabelConfig).length.toString() : '');
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

	const selectedStandard = $derived(getStandardById(standardId));

	// Disable length input for nuts and washers (they don't have length specification)
	const lengthDisabled = $derived(
		selectedStandard?.hardwareType === HardwareType.NUT ||
			selectedStandard?.hardwareType === HardwareType.WASHER
	);

	// Dynamic placeholder based on hardware type and measurement system
	const lengthPlaceholder = $derived(
		lengthDisabled
			? 'N/A for this hardware type'
			: measurementSystem === 'metric'
				? 'Length in mm (e.g., 10, 25)'
				: 'Length in inches (e.g., 1/4, 3/8)'
	);

	function closeStandards() {
		standardsOpen = false;
	}

	// Derived state for pitch selector visibility
	const showPitchSelector = $derived(labelMode === 'fastener');

	const availablePitchOptions = $derived(
		threadSize ? getPitchOptions(threadSize, measurementSystem) : []
	);

	// Update store when any field changes
	function updateLabel() {
		let updatedLabel: BatchLabelConfig;

		if (labelMode === 'fastener') {
			updatedLabel = {
				mode: 'fastener',
				measurementSystem,
				threadSize,
				pitch: pitch || undefined,
				length: parseFloat(length) || 0,
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

<div class="space-y-3 rounded-lg border p-4">
	<!-- Header Row -->
	<div class="flex items-center justify-between">
		<h4 class="font-medium">Label #{labelNumber}</h4>
		<div class="flex gap-1">
			<Button
				onclick={handleDuplicate}
				variant="ghost"
				size="icon"
				class="h-8 w-8"
				title="Duplicate"
			>
				<CopyIcon class="h-4 w-4" />
			</Button>
			<Button onclick={handleDelete} variant="ghost" size="icon" class="h-8 w-8" title="Delete">
				<XIcon class="h-4 w-4" />
			</Button>
		</div>
	</div>

	<!-- Mode Selector -->
	<div class="flex items-center gap-4">
		<span class="text-sm font-medium">Mode:</span>
		<Select bind:value={labelMode} type="single">
			<SelectTrigger class="w-[180px]">
				{labelMode === 'fastener' ? 'Fastener' : 'General Item'}
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="fastener">Fastener</SelectItem>
				<SelectItem value="general">General Item</SelectItem>
			</SelectContent>
		</Select>
	</div>

	{#if isFastenerMode}
		<!-- Fastener Mode Fields -->
		<div class="space-y-3">
			<!-- Measurement System -->
			<div class="flex items-center gap-4">
				<span class="text-sm font-medium">System:</span>
				<ToggleGroup
					bind:value={measurementSystem}
					variant="outline"
					type="single"
					class="w-[200px]"
				>
					<ToggleGroupItem value="metric" class="flex-1">Metric</ToggleGroupItem>
					<ToggleGroupItem value="imperial" class="flex-1">Imperial</ToggleGroupItem>
				</ToggleGroup>
			</div>

			<!-- Thread, Length, Width -->
			<div class="grid grid-cols-3 gap-3">
				<div>
					<label class="mb-1.5 block text-sm font-medium">Thread</label>
					<Select bind:value={threadSize} type="single">
						<SelectTrigger class="w-full">
							{threadSize || 'Select'}
						</SelectTrigger>
						<SelectContent>
							{#each availableThreadSizes as size (size)}
								<SelectItem value={size}>{size}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<div>
					<label class="mb-1.5 block text-sm font-medium">Length</label>
					<Input
						bind:value={length}
						placeholder={lengthPlaceholder}
						type="number"
						disabled={lengthDisabled}
						onblur={updateLabel}
					/>
				</div>

				<div>
					<label class="mb-1.5 block text-sm font-medium">Width: {width}mm</label>
					<Slider bind:value={width} type="single" min={30} max={80} step={1} class="w-full" />
				</div>
			</div>

			<!-- Thread Pitch (Optional - Imperial only) -->
			{#if showPitchSelector}
				<div>
					<label class="mb-1.5 block text-sm font-medium">Thread Pitch (Optional)</label>
					<Select bind:value={pitch} type="single">
						<SelectTrigger class="w-full">
							{pitch
								? availablePitchOptions.find((p) => p.value === pitch)?.label
								: measurementSystem === 'imperial'
									? 'Standard/Coarse'
									: 'Standard pitch'}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value=""
								>{measurementSystem === 'imperial'
									? 'Standard/Coarse'
									: 'Standard pitch'}</SelectItem
							>
							{#each availablePitchOptions as pitchOption (pitchOption.value)}
								<SelectItem value={pitchOption.value}>{pitchOption.label}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
					<p class="mt-1 text-xs text-muted-foreground">Leave empty for standard thread pitch</p>
				</div>
			{/if}

			<!-- Standard -->
			<div>
				<label class="mb-1.5 block text-sm font-medium">ISO/DIN Standard</label>
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
								{selectedStandard ? formatDesignations(selectedStandard) : 'Select standard'}
								<ChevronsUpDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content class="w-[400px] p-0">
						<Command.Root>
							<Command.Input placeholder="Search standards..." />
							<Command.Empty>No standard found.</Command.Empty>
							<Command.Group class="max-h-[300px] overflow-y-auto">
								{#each standardsWithImages as standard (standard.id)}
									<Command.Item
										value={standard.id}
										onSelect={() => {
											standardId = standard.id;
											updateLabel();
											closeStandards();
										}}
										class="flex items-center justify-between"
									>
										<div class="flex flex-1 flex-col">
											<span>{formatDesignations(standard)}</span>
											<span class="text-xs text-muted-foreground">{standard.description}</span>
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
		</div>
	{:else}
		<!-- General Mode Fields -->
		<div class="space-y-3">
			<!-- Primary, Secondary, Width -->
			<div class="grid grid-cols-2 gap-3">
				<div class="col-span-2">
					<label class="mb-1.5 block text-sm font-medium">Primary Text</label>
					<Input bind:value={primaryText} placeholder="e.g., Resistors 10kΩ" onblur={updateLabel} />
				</div>

				<div>
					<label class="mb-1.5 block text-sm font-medium">Secondary Text</label>
					<Input bind:value={secondaryText} placeholder="e.g., 1/4W ±5%" onblur={updateLabel} />
				</div>

				<div>
					<label class="mb-1.5 block text-sm font-medium">Width: {width}mm</label>
					<Slider bind:value={width} type="single" min={30} max={80} step={1} class="w-full" />
				</div>
			</div>
		</div>
	{/if}

	<!-- Common Fields (Note + QR Code) -->
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label class="mb-1.5 block text-sm font-medium">Optional Note</label>
			<Input bind:value={note} placeholder="Additional info" onblur={updateLabel} />
		</div>

		<div>
			<label class="mb-1.5 block text-sm font-medium">QR Code</label>
			<Input
				bind:value={qrCode}
				placeholder="URL or text"
				disabled={qrDisabled}
				onblur={updateLabel}
			/>
			{#if qrDisabled}
				<p class="mt-1 text-xs text-muted-foreground">Not available for 9mm tape</p>
			{/if}
		</div>
	</div>

	<!-- Toggle Switches -->
	<div class="border-t pt-3">
		<h5 class="mb-3 text-sm font-medium">Display Options</h5>
		<div class="space-y-3">
			{#if isFastenerMode}
				<!-- Hardware Image Toggle -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<div class="text-sm font-medium">Hardware Image</div>
						<div class="text-xs text-muted-foreground">
							{!standardId ? 'Select a standard to enable' : 'Show fastener type icon'}
						</div>
					</div>
					<Switch bind:checked={showImage} disabled={!standardId} />
				</div>

				<!-- Standard Reference Toggle -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<div class="text-sm font-medium">Standard Reference</div>
						<div class="text-xs text-muted-foreground">
							{!standardId ? 'Select a standard to enable' : 'Display standard designation'}
						</div>
					</div>
					<Switch bind:checked={showReference} disabled={!standardId} />
				</div>
			{/if}

			<!-- QR Code Toggle (both modes) -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<div class="text-sm font-medium">QR Code</div>
					<div class="text-xs text-muted-foreground">
						{qrDisabled ? 'Not available for 9mm labels' : 'Add scannable code'}
					</div>
				</div>
				<Switch bind:checked={showQRCode} disabled={qrDisabled} />
			</div>
		</div>
	</div>
</div>
