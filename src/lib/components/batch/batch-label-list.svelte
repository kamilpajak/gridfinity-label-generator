<script lang="ts">
	import { batchStore } from '$lib/stores/batch-store';
	import BatchLabelRow from './batch-label-row.svelte';
	import { tick } from 'svelte';

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
	<div class="rounded-lg border border-dashed p-8 text-center">
		<p class="text-muted-foreground">No labels yet. Click "Add Label" to get started.</p>
	</div>
{:else}
	<div class="max-h-[600px] space-y-4 overflow-y-auto" bind:this={containerRef}>
		{#each labels as label, index (index)}
			<BatchLabelRow {label} {index} {tapeHeight} />
		{/each}
	</div>
{/if}
