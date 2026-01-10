<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';

	interface Props {
		onclick: () => void;
		showBadge?: boolean;
	}

	const { onclick, showBadge = true }: Props = $props();
</script>

<button
	{onclick}
	class="relative inline-flex min-h-[44px] transform items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 px-3 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:from-purple-600 hover:to-purple-700 hover:shadow-xl lg:px-6 lg:py-3 lg:text-base"
	data-testid="whats-new-button"
>
	<Sparkles class="h-4 w-4 lg:h-5 lg:w-5" />
	<span class="hidden sm:inline">What's New</span>
	<span class="sm:hidden">New</span>
	{#if showBadge}
		<span
			class="absolute -top-1 -right-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
		>
			NEW
		</span>
	{/if}
</button>
