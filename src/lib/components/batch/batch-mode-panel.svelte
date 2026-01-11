<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { batchStore } from '$lib/stores/batch-store';
	import { exportBatchTapeAsPNG } from '$lib/utils/batch-exporter';
	import BatchControls from './batch-controls.svelte';
	import BatchLabelList from './batch-label-list.svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import RecommendedProducts from '$lib/components/affiliate/recommended-products.svelte';

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
				batch: batchState
				// DPI defaults to 360 from batch-exporter.ts
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
	<!-- Left Column: Label List -->
	<div class="lg:col-span-2">
		<Card.Root class="border-slate-200/50 shadow-xl">
			<Card.Header>
				<Card.Title>Labels</Card.Title>
				<Card.Description>Manage your label collection</Card.Description>
			</Card.Header>
			<Card.Content>
				<BatchLabelList />
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Right Column: Batch Settings and Export -->
	<div class="space-y-6">
		<Card.Root class="border-slate-200/50 shadow-xl">
			<Card.Header>
				<Card.Title>Batch Settings</Card.Title>
				<Card.Description>Configure tape and manage batch</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<BatchControls />
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-slate-200/50 shadow-xl">
			<Card.Header>
				<Card.Title>Export</Card.Title>
				<Card.Description>Export your labels as PNG</Card.Description>
			</Card.Header>
			<Card.Content>
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
			</Card.Content>
		</Card.Root>

		<RecommendedProducts />
	</div>
</div>
