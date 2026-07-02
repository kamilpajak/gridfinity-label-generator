<script lang="ts">
	import { batchStore } from '$lib/stores/batch-store';
	import BatchLabelRow from './batch-label-row.svelte';
	import { tick } from 'svelte';
	import ListIcon from '@lucide/svelte/icons/list';

	const batchState = $derived($batchStore);
	const labels = $derived(batchState.labels);
	const tapeHeight = $derived(batchState.height);

	let containerRef: HTMLDivElement | undefined = $state();

	// Auto-scroll to new label when labels array grows
	let previousLabelCount = $state(0);
	$effect(() => {
		const currentCount = labels.length;
		if (currentCount > previousLabelCount && currentCount > 0) {
			// New label was added - scroll to bottom
			tick().then(() => {
				if (containerRef) {
					containerRef.scrollTo({
						top: containerRef.scrollHeight,
						behavior: 'smooth'
					});
				}
			});
		}
		previousLabelCount = currentCount;
	});
</script>

{#if labels.length === 0}
	<div
		class="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/50 p-8 text-center backdrop-blur"
	>
		<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
			<ListIcon class="h-7 w-7 text-slate-600" />
		</div>
		<p class="text-lg font-bold text-slate-300">No labels in batch</p>
		<p class="mt-2 text-sm text-slate-500">
			Configure a label in the sidebar and click "Add Label"
		</p>
	</div>
{:else}
	<div class="max-h-[600px] space-y-4 overflow-y-auto" bind:this={containerRef}>
		{#each labels as label, index (index)}
			<BatchLabelRow {label} {index} {tapeHeight} />
		{/each}
	</div>
{/if}
