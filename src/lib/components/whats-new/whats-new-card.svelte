<script lang="ts">
	import type { ChangelogEntry } from '$lib/types/changelog';
	import Megaphone from '@lucide/svelte/icons/megaphone';
	import WhatsNewItem from './whats-new-item.svelte';

	interface Props {
		changelog: ChangelogEntry[];
		appVersion: string;
	}

	const { changelog, appVersion }: Props = $props();

	// Flatten changelog entries to individual changes for display
	// Format: "Title: Description" or just "Title" if no colon
	const flatChanges = $derived(
		changelog.flatMap((entry) =>
			entry.changes.flatMap((change) =>
				change.items.map((item) => {
					const colonIndex = item.indexOf(':');
					if (colonIndex > 0 && colonIndex < 50) {
						// Has title:description format
						return {
							date: entry.date,
							category: change.category,
							title: item.substring(0, colonIndex).trim(),
							description: item.substring(colonIndex + 1).trim()
						};
					}
					// No colon or colon too late - treat whole thing as title
					return {
						date: entry.date,
						category: change.category,
						title: item,
						description: undefined
					};
				})
			)
		)
	);

	const ITEMS_PER_PAGE = 5;

	let visibleCount = $state(ITEMS_PER_PAGE);
	let scrollContainer: HTMLElement | undefined = $state();

	const visibleEntries = $derived(flatChanges.slice(0, visibleCount));
	const hasMore = $derived(visibleCount < flatChanges.length);

	function loadMore() {
		visibleCount = Math.min(visibleCount + ITEMS_PER_PAGE, flatChanges.length);
	}

	function handleScroll() {
		if (!scrollContainer || !hasMore) return;

		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		const nearBottom = scrollTop + clientHeight >= scrollHeight - 50;

		if (nearBottom) {
			loadMore();
		}
	}
</script>

<div
	data-testid="whats-new-card"
	class="overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white shadow-sm"
>
	<!-- Header -->
	<div
		data-testid="whats-new-header"
		class="flex items-center justify-between border-b border-indigo-100 bg-white px-5 py-4"
	>
		<h3 class="flex items-center gap-2 text-lg font-bold text-indigo-900">
			<Megaphone class="h-4 w-4 text-indigo-500" />
			What's New
		</h3>
		<span
			data-testid="version-badge"
			class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-indigo-700 uppercase"
		>
			v{appVersion}
		</span>
	</div>

	<!-- Scrollable content -->
	<div
		bind:this={scrollContainer}
		onscroll={handleScroll}
		data-testid="whats-new-scroll"
		class="custom-scrollbar max-h-[380px] space-y-5 overflow-y-auto p-5"
	>
		{#if visibleEntries.length > 0}
			{#each visibleEntries as entry, index (index)}
				<WhatsNewItem {entry} {index} />
			{/each}

			{#if hasMore}
				<div class="py-3 text-center text-xs text-slate-400">Loading more...</div>
			{/if}
		{:else}
			<p class="text-center text-sm text-slate-500">No updates available.</p>
		{/if}
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: #f1f5f9;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
</style>
