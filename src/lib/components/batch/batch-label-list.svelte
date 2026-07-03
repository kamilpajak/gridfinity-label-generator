<script lang="ts">
	import { batchStore } from '$lib/stores/batch-store';
	import BatchLabelChip from './batch-label-chip.svelte';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import XIcon from '@lucide/svelte/icons/x';
	import type { BatchLabel } from '$lib/types/batch';

	const batchState = $derived($batchStore);
	const height = $derived(batchState.height);

	const FLIP_MS = 180;

	// Local, drag-reorderable copy of the labels. Kept in sync with the store,
	// but mutated live during a drag (svelte-dnd-action reassigns it on
	// `consider`), so it must be writable $state — not a $derived.
	// eslint-disable-next-line svelte/prefer-writable-derived
	let items = $state<BatchLabel[]>([]);
	$effect(() => {
		items = [...batchState.labels];
	});

	function handleConsider(e: CustomEvent<DndEvent<BatchLabel>>) {
		items = e.detail.items;
	}

	function handleFinalize(e: CustomEvent<DndEvent<BatchLabel>>) {
		items = e.detail.items;
		batchStore.reorder(items);
	}

	function remove(id: string) {
		batchStore.removeLabelById(id);
	}
</script>

<div
	class="flex flex-col gap-4"
	use:dndzone={{ items, flipDurationMs: FLIP_MS, dropTargetStyle: {} }}
	onconsider={handleConsider}
	onfinalize={handleFinalize}
	data-testid="batch-label-list"
>
	{#each items as label, index (label.id)}
		<div
			animate:flip={{ duration: FLIP_MS }}
			class="group flex items-center gap-4 rounded-xl border border-slate-800/60 bg-slate-900/40 p-3"
			data-testid="batch-label-row-{index}"
		>
			<div class="w-6 shrink-0 text-right font-mono text-xs font-bold text-slate-500">
				{index + 1}.
			</div>

			<BatchLabelChip config={label} {height} {index} />

			<div class="ml-auto flex items-center gap-1">
				<span
					class="flex cursor-grab items-center justify-center rounded p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300 active:cursor-grabbing"
					title="Drag to reorder"
					aria-hidden="true"
					data-testid="batch-drag-handle-{index}"
				>
					<GripVerticalIcon class="h-4 w-4" />
				</span>
				<button
					onclick={() => remove(label.id)}
					class="rounded-lg border border-slate-700/50 bg-slate-900/50 p-2.5 text-slate-400 transition-all hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-400"
					title="Remove label"
					data-testid="remove-label-button-{index}"
				>
					<XIcon class="h-4 w-4" />
				</button>
			</div>
		</div>
	{/each}
</div>
