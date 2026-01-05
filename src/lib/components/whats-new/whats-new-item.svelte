<script lang="ts">
	import type { ChangeCategory } from '$lib/types/changelog';
	import { getRelativeDate } from '$lib/utils/changelog-parser';
	import CategoryTag from './category-tag.svelte';

	interface FlatEntry {
		date: string;
		category: ChangeCategory;
		title: string;
		description?: string;
	}

	interface Props {
		entry: FlatEntry;
		index: number;
	}

	const { entry, index }: Props = $props();

	// Timeline dot and ring colors based on recency
	const dotStyles = [
		{ dot: 'bg-indigo-500', ring: 'ring-indigo-50', border: 'border-indigo-200' },
		{ dot: 'bg-blue-400', ring: 'ring-blue-50', border: 'border-indigo-200' },
		{ dot: 'bg-amber-400', ring: 'ring-amber-50', border: 'border-indigo-200' },
		{ dot: 'bg-slate-300', ring: 'ring-slate-50', border: 'border-slate-200' }
	];
	const style = $derived(dotStyles[Math.min(index, dotStyles.length - 1)]);

	const relativeDate = $derived(getRelativeDate(entry.date));
</script>

<div data-testid="whats-new-item" class="relative border-l-2 pl-4 {style.border}">
	<!-- Timeline dot -->
	<div
		class="absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full ring-4 {style.dot} {style.ring}"
	></div>

	<!-- Content -->
	<div>
		<div class="mb-1 flex items-start justify-between">
			<h4 data-testid="item-version" class="text-sm font-bold text-slate-800">
				{entry.title}
			</h4>
			<span data-testid="relative-date" class="ml-2 shrink-0 text-[10px] text-slate-400">
				{relativeDate}
			</span>
		</div>

		{#if entry.description}
			<p class="text-xs leading-relaxed text-slate-600">
				{entry.description}
			</p>
		{/if}

		<div class="mt-2">
			<CategoryTag category={entry.category} />
		</div>
	</div>
</div>
