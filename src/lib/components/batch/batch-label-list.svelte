<script lang="ts">
	import { batchStore } from '$lib/stores/batch-store';
	import BatchLabelRow from './batch-label-row.svelte';

	const state = $derived($batchStore);
	const labels = $derived(state.labels);
	const tapeHeight = $derived(state.height);
</script>

{#if labels.length === 0}
	<div class="rounded-lg border border-dashed p-8 text-center">
		<p class="text-muted-foreground">No labels yet. Click "Add Label" to get started.</p>
	</div>
{:else}
	<div class="max-h-[600px] space-y-4 overflow-y-auto">
		{#each labels as label, index (index)}
			<BatchLabelRow {label} {index} {tapeHeight} />
		{/each}
	</div>
{/if}
