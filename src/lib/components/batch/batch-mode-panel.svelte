<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { batchStore } from '$lib/stores/batch-store';
	import { exportBatchTapeAsPNG } from '$lib/utils/batch-exporter';
	import { exportBatchTapeAsLbx } from '$lib/utils/batch-lbx-exporter';
	import BatchLabelList from './batch-label-list.svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ListIcon from '@lucide/svelte/icons/list';

	let batchState = $derived($batchStore);
	let canExport = $derived(batchState.labels.length > 0);

	let isExporting = $state(false);
	let exportStatus = $state('');

	/** Run an export, showing a transient success/failure status. */
	async function runExport(label: string, exporter: () => Promise<void>) {
		if (!canExport || isExporting) return;

		isExporting = true;
		exportStatus = '';

		try {
			await exporter();
			exportStatus = `✓ Exported ${batchState.labels.length} labels as ${label}`;
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

	const handleExportPng = () => runExport('PNG', () => exportBatchTapeAsPNG({ batch: batchState }));
	const handleExportLbx = () =>
		runExport('.lbx', () => exportBatchTapeAsLbx({ batch: batchState }));
</script>

<div class="w-full">
	<div class="mb-6 border-t border-slate-800/80 pt-8">
		<h2 class="text-2xl font-black tracking-tight text-white">Batch Labels</h2>
		<p class="mt-1 text-sm text-slate-400">Manage your label collection before exporting.</p>
	</div>

	{#if batchState.labels.length === 0}
		<div
			class="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/50 p-8 text-center backdrop-blur"
			data-testid="batch-empty-state"
		>
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
				<ListIcon class="h-7 w-7 text-slate-600" />
			</div>
			<p class="text-lg font-bold text-slate-300">No labels in batch</p>
			<p class="mt-2 text-sm text-slate-500">
				Configure a label in the sidebar and click "Add Current Label"
			</p>
		</div>
	{:else}
		<div class="rounded-2xl border border-slate-800/50 bg-slate-900/30 p-4">
			<BatchLabelList />
		</div>

		<div class="mt-10 flex flex-col items-center gap-3 pb-8">
			<div class="flex flex-col gap-3 sm:flex-row">
				<Button
					onclick={handleExportPng}
					disabled={!canExport || isExporting}
					size="lg"
					class="h-auto gap-2 rounded-xl bg-cyan-500 px-6 py-4 text-sm font-bold text-slate-900 shadow-lg shadow-cyan-500/25 transition-shadow hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.45)]"
					data-testid="export-button"
				>
					<DownloadIcon class="h-5 w-5" />
					{#if isExporting}
						Exporting...
					{:else}
						Export PNG Strip
					{/if}
				</Button>
				<Button
					onclick={handleExportLbx}
					disabled={!canExport || isExporting}
					size="lg"
					class="h-auto gap-2 rounded-xl bg-violet-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-shadow hover:bg-violet-500 hover:shadow-[0_0_30px_rgba(139,92,246,0.45)]"
					data-testid="export-lbx-button"
				>
					<DownloadIcon class="h-5 w-5" />
					Export .lbx
				</Button>
			</div>

			<p class="max-w-md text-center text-sm text-slate-500">
				PNG export creates a single continuous image containing all labels side-by-side. LBX export
				creates a Brother native label file.
			</p>

			{#if exportStatus}
				<p
					class="text-center text-sm {exportStatus.startsWith('✓')
						? 'text-emerald-400'
						: 'text-destructive'}"
				>
					{exportStatus}
				</p>
			{/if}
		</div>
	{/if}
</div>
