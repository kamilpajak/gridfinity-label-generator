<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { batchStore } from '$lib/stores/batch-store';
	import type { TapeHeight, BatchLabelConfig } from '$lib/types/batch';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let batchState = $derived($batchStore);
	let labelCount = $derived(batchState.labels.length);
	let maxLabels = $derived(batchState.maxLabels);
	let progressPercent = $derived((labelCount / maxLabels) * 100);
	let canAddLabel = $derived(labelCount < maxLabels);

	// Need $state for two-way binding with ToggleGroup
	// eslint-disable-next-line svelte/prefer-writable-derived
	let tapeHeight = $state(batchState.height.toString());

	// Update store when height changes
	$effect(() => {
		const height = tapeHeight === '9' ? 9 : 12;
		if (height !== batchState.height) {
			batchStore.setHeight(height as TapeHeight);
		}
	});

	// Sync store to local state
	$effect(() => {
		tapeHeight = batchState.height.toString();
	});

	function handleAddLabel() {
		const defaultLabel: BatchLabelConfig = {
			mode: 'fastener',
			measurementSystem: 'metric',
			threadSize: '',
			length: 0,
			width: 35,
			note: '',
			qrCode: ''
		};
		batchStore.addLabel(defaultLabel);
	}
</script>

<div class="space-y-4">
	<!-- Tape Height Selector -->
	<div>
		<label class="mb-2 block text-sm font-medium">Tape Height</label>
		<ToggleGroup bind:value={tapeHeight} variant="outline" type="single" class="w-full">
			<ToggleGroupItem value="9" class="flex-1">9mm</ToggleGroupItem>
			<ToggleGroupItem value="12" class="flex-1">12mm</ToggleGroupItem>
		</ToggleGroup>
	</div>

	<!-- Progress Indicator -->
	<div>
		<div class="mb-2 flex items-center justify-between text-sm">
			<span class="font-medium">Progress</span>
			<span class="text-muted-foreground">{labelCount} / {maxLabels} labels</span>
		</div>
		<div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
			<div
				class="h-full bg-primary transition-all duration-300"
				style="width: {progressPercent}%"
			></div>
		</div>
	</div>

	<!-- Add Label Button -->
	<Button onclick={handleAddLabel} disabled={!canAddLabel} class="w-full gap-2">
		<PlusIcon class="h-4 w-4" />
		Add Label
		{#if !canAddLabel}
			<span class="text-xs">(Max {maxLabels} reached)</span>
		{/if}
	</Button>
</div>
