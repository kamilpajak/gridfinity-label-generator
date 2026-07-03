<script lang="ts">
	import type { ChangeCategory } from '$lib/types/changelog';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Wrench from '@lucide/svelte/icons/wrench';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	interface Props {
		category: ChangeCategory;
	}

	const { category }: Props = $props();

	const categoryConfig: Record<
		ChangeCategory,
		{ label: string; icon: typeof Sparkles; iconClass: string }
	> = {
		added: { label: 'New Features', icon: Sparkles, iconClass: 'text-cyan-400' },
		changed: { label: 'Changes', icon: Pencil, iconClass: 'text-amber-400' },
		fixed: { label: 'Bug Fixes', icon: Wrench, iconClass: 'text-slate-400' },
		removed: { label: 'Removed', icon: Trash2, iconClass: 'text-slate-400' },
		improved: { label: 'Improvements', icon: Wrench, iconClass: 'text-slate-400' }
	};

	const config = $derived(categoryConfig[category]);
	const Icon = $derived(config.icon);
</script>

<h4 data-testid="category-tag" class="flex items-center gap-1.5 text-sm font-bold text-slate-200">
	<Icon class="h-3.5 w-3.5 {config.iconClass}" />
	{config.label}
</h4>
