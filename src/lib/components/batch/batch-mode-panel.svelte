<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { batchStore } from '$lib/stores/batch-store';
	import { exportBatchTapeAsPNG } from '$lib/utils/batch-exporter';
	import BatchControls from './batch-controls.svelte';
	import BatchLabelList from './batch-label-list.svelte';
	import BatchPreview from './batch-preview.svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';

	let batchState = $derived($batchStore);
	let canExport = $derived(batchState.labels.length > 0);

	let isExporting = $state(false);
	let exportStatus = $state('');

	async function handleExport() {
		if (!canExport) return;

		isExporting = true;
		exportStatus = '';

		try {
			await exportBatchTapeAsPNG({
				batch: batchState,
				dpi: 300
			});
			exportStatus = `✓ Exported ${batchState.labels.length} labels successfully`;
			setTimeout(() => {
				exportStatus = '';
			}, 3000);
		} catch (error) {
			console.error('Export failed:', error);
			exportStatus = '✗ Export failed';
			setTimeout(() => {
				exportStatus = '';
			}, 3000);
		} finally {
			isExporting = false;
		}
	}
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
	<!-- Left Column: Controls and Label List -->
	<div class="space-y-6 lg:col-span-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Batch Configuration</Card.Title>
				<Card.Description>Configure tape height and add multiple labels</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-6">
				<BatchControls />
				<div class="border-t pt-6">
					<h3 class="mb-4 text-sm font-medium">Labels</h3>
					<BatchLabelList />
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Right Column: Preview and Export -->
	<div class="space-y-6">
		<Card.Root>
			<Card.Header>
				<Card.Title>Preview & Export</Card.Title>
				<Card.Description>Review your tape before exporting</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<BatchPreview />

				<div class="border-t pt-4">
					<Button
						onclick={handleExport}
						disabled={!canExport || isExporting}
						class="w-full gap-2"
						variant="default"
					>
						<DownloadIcon class="h-4 w-4" />
						{#if isExporting}
							Exporting...
						{:else}
							Export Batch ({batchState.labels.length}
							{batchState.labels.length === 1 ? 'label' : 'labels'})
						{/if}
					</Button>

					{#if exportStatus}
						<p
							class="mt-2 text-center text-sm {exportStatus.startsWith('✓')
								? 'text-green-600'
								: 'text-destructive'}"
						>
							{exportStatus}
						</p>
					{/if}

					{#if !canExport}
						<p class="mt-2 text-center text-xs text-muted-foreground">
							Add at least one label to export
						</p>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
