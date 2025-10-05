<script lang="ts">
	import { batchStore } from '$lib/stores/batch-store';
	import { renderBatchTape } from '$lib/utils/batch-renderer';
	import { onMount } from 'svelte';

	let canvasRef: HTMLCanvasElement | undefined = $state();
	let batchState = $derived($batchStore);

	// Re-render when batch batchState changes
	// Access batchState.labels directly to track deep changes, not just length
	$effect(() => {
		// Access all reactive properties to track changes
		const labels = batchState.labels;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _height = batchState.height; // Access height for reactivity tracking

		if (canvasRef && labels.length > 0) {
			// Trigger on any change: labels array, height, or label contents
			renderPreview();
		}
	});

	async function renderPreview() {
		if (!canvasRef) return;

		try {
			await renderBatchTape({
				canvas: canvasRef,
				batch: batchState,
				dpi: 150, // Lower DPI for preview (faster rendering)
				showMargins: true // Show margins in preview
			});
		} catch (error) {
			console.error('Failed to render batch preview:', error);
		}
	}

	onMount(() => {
		if (batchState.labels.length > 0) {
			renderPreview();
		}
	});
</script>

<div class="mt-6">
	<h3 class="mb-2 text-sm font-medium">Preview</h3>
	{#if batchState.labels.length === 0}
		<div class="rounded-lg border border-dashed p-8 text-center">
			<p class="text-muted-foreground">Add labels to see preview</p>
		</div>
	{:else}
		<div class="rounded-lg border bg-muted/50 p-4">
			<div class="overflow-x-auto">
				<canvas
					bind:this={canvasRef}
					class="bg-white shadow-sm"
					style="image-rendering: crisp-edges; display: block;"
				></canvas>
			</div>
			<p class="mt-2 text-xs text-muted-foreground">
				Horizontal tape preview • {batchState.labels.length} label{batchState.labels.length !== 1
					? 's'
					: ''} • {batchState.height}mm tape
			</p>
		</div>
	{/if}
</div>
