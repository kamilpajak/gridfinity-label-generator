<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';

	interface Props {
		onclick: () => void;
		/** Full app version (e.g. "2.9.1"), rendered in the label. */
		version: string;
	}

	const { onclick, version }: Props = $props();
</script>

<button
	{onclick}
	class="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 py-1 pr-3 pl-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200"
	data-testid="whats-new-button"
>
	<span
		class="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-indigo-400 uppercase"
	>
		<Sparkles class="h-3 w-3" />
		New
	</span>
	<span>What's new in v{version}?</span>
</button>
