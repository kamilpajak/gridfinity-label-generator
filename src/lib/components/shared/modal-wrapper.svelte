<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { createEscapeHandler, createBackdropClickHandler } from '$lib/utils/modal-utils';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		title: string;
		titleId: string;
		testId?: string;
		maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
		headerIcon?: Snippet;
		headerSubtitle?: Snippet;
		footer?: Snippet;
		content: Snippet;
	}

	let {
		open = $bindable(),
		onClose,
		title,
		titleId,
		testId,
		maxWidth = '3xl',
		headerIcon,
		headerSubtitle,
		footer,
		content
	}: Props = $props();

	const handleKeydown = createEscapeHandler(onClose);
	const handleBackdropClick = createBackdropClickHandler(onClose);

	const maxWidthClasses: Record<string, string> = {
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl',
		'2xl': 'max-w-2xl',
		'3xl': 'max-w-3xl',
		'4xl': 'max-w-4xl'
	};
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
		onclick={handleBackdropClick}
		data-testid={testId ? `${testId}-backdrop` : undefined}
	>
		<!-- Modal -->
		<div
			class="flex max-h-[90vh] w-full {maxWidthClasses[
				maxWidth
			]} flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/95 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			data-testid={testId}
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-slate-800/80 bg-slate-900 px-6 py-5"
			>
				<div class="flex items-center gap-3">
					{#if headerIcon}
						{@render headerIcon()}
					{/if}
					<div>
						<h2 id={titleId} class="text-lg font-black tracking-tight text-white">{title}</h2>
						{#if headerSubtitle}
							{@render headerSubtitle()}
						{/if}
					</div>
				</div>
				<button
					onclick={onClose}
					class="rounded-full p-2.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
					aria-label="Close modal"
					data-testid={testId ? `${testId}-close` : undefined}
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<!-- Content -->
			<div class="custom-scrollbar flex-1 overflow-y-auto px-6 py-6">
				{@render content()}
			</div>

			<!-- Footer -->
			{#if footer}
				<div class="border-t border-slate-800/80 bg-slate-900 px-6 py-4">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
