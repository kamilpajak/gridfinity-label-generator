<script lang="ts">
	import type { ChangelogEntry } from '$lib/types/changelog';
	import { getRelativeDate } from '$lib/utils/changelog-parser';
	import X from '@lucide/svelte/icons/x';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Bell from '@lucide/svelte/icons/bell';
	import CategoryTag from './category-tag.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		changelog: ChangelogEntry[];
	}

	let { open = $bindable(), onClose, changelog }: Props = $props();

	// Color schemes for timeline entries (newest to oldest)
	const colorSchemes = [
		{
			dot: 'bg-purple-500',
			ring: 'ring-purple-100',
			border: 'border-purple-200',
			line: 'border-purple-200',
			bg: 'bg-gradient-to-br from-purple-50 to-blue-50',
			badge: 'bg-purple-500 text-white'
		},
		{
			dot: 'bg-blue-500',
			ring: 'ring-blue-100',
			border: 'border-blue-100',
			line: 'border-blue-200',
			bg: 'bg-blue-50/50',
			badge: 'bg-blue-100 text-blue-700'
		},
		{
			dot: 'bg-emerald-500',
			ring: 'ring-emerald-100',
			border: 'border-emerald-100',
			line: 'border-emerald-200',
			bg: 'bg-emerald-50/50',
			badge: 'bg-emerald-100 text-emerald-700'
		},
		{
			dot: 'bg-amber-500',
			ring: 'ring-amber-100',
			border: 'border-amber-100',
			line: 'border-amber-200',
			bg: 'bg-amber-50/50',
			badge: 'bg-amber-100 text-amber-700'
		},
		{
			dot: 'bg-slate-300',
			ring: 'ring-slate-100',
			border: 'border-slate-200',
			line: 'border-slate-200',
			bg: 'bg-slate-50/50',
			badge: 'bg-slate-100 text-slate-700'
		}
	];

	function getColorScheme(index: number) {
		return colorSchemes[Math.min(index, colorSchemes.length - 1)];
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	// Check if this is the newest version
	function isNewest(index: number): boolean {
		return index === 0;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
		onclick={handleBackdropClick}
		data-testid="whats-new-modal-backdrop"
	>
		<!-- Modal -->
		<div
			class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="whats-new-modal-title"
			data-testid="whats-new-modal"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-purple-50 via-blue-50 to-white px-8 py-6"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 text-white"
					>
						<Sparkles class="h-5 w-5" />
					</div>
					<h2 id="whats-new-modal-title" class="text-2xl font-bold text-slate-800">What's New</h2>
				</div>
				<button
					onclick={onClose}
					class="text-slate-400 transition-colors hover:text-slate-600"
					aria-label="Close modal"
					data-testid="whats-new-modal-close"
				>
					<X class="h-6 w-6" />
				</button>
			</div>

			<!-- Content -->
			<div class="custom-scrollbar flex-1 overflow-y-auto px-8 py-6">
				<div class="space-y-6">
					{#each changelog as entry, index (entry.version)}
						{@const colors = getColorScheme(index)}
						{@const isLast = index === changelog.length - 1}

						<div
							class="relative pb-8 pl-8 {isLast ? '' : 'border-l-2'} {colors.line}"
							data-testid="whats-new-entry"
						>
							<!-- Timeline dot -->
							<div
								class="absolute top-0 -left-[9px] h-4 w-4 rounded-full ring-4 {colors.dot} {colors.ring}"
							></div>

							<!-- Entry card -->
							<div class="rounded-xl border p-5 {colors.bg} {colors.border}">
								<div class="mb-3 flex items-start justify-between">
									<div class="flex items-center gap-2">
										{#if isNewest(index)}
											<span
												class="rounded px-2 py-1 text-xs font-bold tracking-wide uppercase {colors.badge}"
											>
												New
											</span>
										{/if}
										<span class="text-sm font-semibold text-slate-600">
											Version {entry.version}
										</span>
									</div>
									<span class="text-xs text-slate-400">
										{getRelativeDate(entry.date)}
									</span>
								</div>

								<!-- Changes -->
								<div class="space-y-3">
									{#each entry.changes as change (change.category)}
										<div>
											<div class="mb-2">
												<CategoryTag category={change.category} />
											</div>
											<ul class="space-y-1.5">
												{#each change.items as item, i (i)}
													{@const colonIndex = item.indexOf(':')}
													{@const hasTitle = colonIndex > 0 && colonIndex < 50}
													<li class="flex items-start gap-2 text-sm text-slate-600">
														<span class="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400"
														></span>
														{#if hasTitle}
															<span>
																<strong class="text-slate-800"
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
						</div>
					{/each}
				</div>
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-8 py-4"
			>
				<div class="flex items-center gap-2 text-sm text-slate-500">
					<Bell class="h-4 w-4 text-purple-500" />
					<span>Stay tuned for more updates!</span>
				</div>
				<button
					onclick={onClose}
					class="rounded-lg bg-purple-500 px-6 py-2 text-sm font-medium text-white transition-all hover:bg-purple-600"
					data-testid="whats-new-modal-close-button"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

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
