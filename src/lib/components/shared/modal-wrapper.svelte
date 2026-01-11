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
		headerGradient?: string;
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
		headerGradient = 'from-slate-50 to-white',
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
		onclick={handleBackdropClick}
		data-testid={testId ? `${testId}-backdrop` : undefined}
	>
		<!-- Modal -->
		<div
			class="flex max-h-[90vh] w-full {maxWidthClasses[
				maxWidth
			]} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			data-testid={testId}
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r {headerGradient} px-8 py-6"
			>
				<div class="flex items-center gap-3">
					{#if headerIcon}
						{@render headerIcon()}
					{/if}
					<div>
						<h2 id={titleId} class="text-2xl font-bold text-slate-800">{title}</h2>
						{#if headerSubtitle}
							{@render headerSubtitle()}
						{/if}
					</div>
				</div>
				<button
					onclick={onClose}
					class="text-slate-400 transition-colors hover:text-slate-600"
					aria-label="Close modal"
					data-testid={testId ? `${testId}-close` : undefined}
				>
					<X class="h-6 w-6" />
				</button>
			</div>

			<!-- Content -->
			<div class="custom-scrollbar flex-1 overflow-y-auto px-8 py-6">
				{@render content()}
			</div>

			<!-- Footer -->
			{#if footer}
				<div class="border-t border-slate-200 bg-slate-50 px-8 py-4">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
