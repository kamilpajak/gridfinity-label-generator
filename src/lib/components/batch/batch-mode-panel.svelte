<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { batchStore } from '$lib/stores/batch-store';
	import { exportBatchTapeAsPNG } from '$lib/utils/batch-exporter';
	import BatchControls from './batch-controls.svelte';
	import BatchLabelList from './batch-label-list.svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';

	// Which slice of the batch UI to render: controls live in the sidebar,
	// the label collection lives in the main area (mirrors the single-mode split).
	let { view = 'main' }: { view?: 'sidebar' | 'main' } = $props();

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

{#if view === 'sidebar'}
	<div class="space-y-6">
		<!-- Batch Settings -->
		<div>
			<h2 class="mb-5 text-xs font-bold tracking-widest text-slate-400 uppercase">
				Batch Settings
			</h2>
			<BatchControls />
		</div>

		<hr class="border-slate-800/60" />

		<!-- Export -->
		<div class="space-y-3">
			<h3 class="text-[11px] font-bold tracking-wide text-slate-400 uppercase">Export</h3>
			<Button
				onclick={handleExport}
				disabled={!canExport || isExporting}
				class="w-full gap-2 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40"
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
					class="text-center text-sm {exportStatus.startsWith('✓')
						? 'text-emerald-400'
						: 'text-destructive'}"
				>
					{exportStatus}
				</p>
			{/if}

			{#if !canExport}
				<p class="text-center text-[10px] text-slate-500">Add at least one label to export</p>
			{/if}
		</div>
	</div>
{:else}
	<!-- Main: the label collection -->
	<div class="mx-auto flex w-full max-w-2xl flex-col">
		<div class="mb-6">
			<h2 class="text-2xl font-black tracking-tight text-white">Batch Labels</h2>
			<p class="mt-1 text-sm text-slate-400">
				Manage and preview your label collection before exporting.
			</p>
		</div>
		<BatchLabelList />
	</div>
{/if}
