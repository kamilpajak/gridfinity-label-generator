<script lang="ts">
	import type { ChangelogEntry } from '$lib/types/changelog';
	import { getRelativeDate } from '$lib/utils/changelog-parser';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import CategoryTag from './category-tag.svelte';
	import ModalWrapper from '$lib/components/shared/modal-wrapper.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		changelog: ChangelogEntry[];
	}

	let { open = $bindable(), onClose, changelog }: Props = $props();

	function isNewest(index: number): boolean {
		return index === 0;
	}
</script>

<ModalWrapper
	bind:open
	{onClose}
	title="What's New"
	titleId="whats-new-modal-title"
	testId="whats-new-modal"
	maxWidth="2xl"
>
	{#snippet headerIcon()}
		<div
			class="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 shadow-inner"
		>
			<Sparkles class="h-5 w-5" />
		</div>
	{/snippet}

	{#snippet headerSubtitle()}
		<p class="text-xs font-medium text-slate-400">Recent updates and improvements</p>
	{/snippet}

	{#snippet content()}
		<div class="space-y-4">
			{#each changelog as entry, index (entry.version)}
				<div
					class="rounded-xl p-5 {isNewest(index)
						? 'border border-indigo-500/20 bg-indigo-500/5'
						: 'border border-slate-800/50 bg-slate-950/50 hover:border-slate-700/50'}"
					data-testid="whats-new-entry"
				>
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span
								class="rounded border border-indigo-500/20 bg-indigo-500/20 px-2 py-0.5 tracking-wider text-indigo-400 uppercase"
							>
								<span class="text-sm font-semibold">Version {entry.version}</span>
							</span>
							{#if isNewest(index)}
								<span
									class="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase"
								>
									<CheckCircle2 class="h-2.5 w-2.5" /> Latest
								</span>
							{/if}
						</div>
						<span class="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
							{getRelativeDate(entry.date)}
						</span>
					</div>

					<!-- Changes -->
					<div class="space-y-4">
						{#each entry.changes as change (change.category)}
							<div>
								<div class="mb-2">
									<CategoryTag category={change.category} />
								</div>
								<ul class="space-y-2">
									{#each change.items as item, i (i)}
										{@const colonIndex = item.indexOf(':')}
										{@const hasTitle = colonIndex > 0 && colonIndex < 50}
										<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
											<span class="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-600"
											></span>
											{#if hasTitle}
												<span>
													<strong class="font-medium text-slate-300"
														>{item.substring(0, colonIndex)}</strong
													>{item.substring(colonIndex)}
												</span>
											{:else}
												<span>{item}</span>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/snippet}

	{#snippet footer()}
		<div class="flex items-center justify-end">
			<button
				onclick={onClose}
				class="rounded-full border border-slate-700 bg-slate-800 px-6 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
				data-testid="whats-new-modal-close-button"
			>
				Close
			</button>
		</div>
	{/snippet}
</ModalWrapper>
