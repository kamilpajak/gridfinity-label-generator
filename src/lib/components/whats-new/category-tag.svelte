<script lang="ts">
	import type { ChangeCategory } from '$lib/types/changelog';

	interface Props {
		category: ChangeCategory;
	}

	const { category }: Props = $props();

	const categoryConfig: Record<ChangeCategory, { label: string; classes: string }> = {
		added: { label: 'Feature', classes: 'bg-emerald-500/15 text-emerald-300' },
		changed: { label: 'Changed', classes: 'bg-amber-500/15 text-amber-300' },
		fixed: { label: 'Bug Fix', classes: 'bg-red-500/15 text-red-300' },
		removed: { label: 'Removed', classes: 'bg-slate-500/15 text-slate-300' },
		improved: { label: 'Improvement', classes: 'bg-amber-500/15 text-amber-300' }
	};

	const config = $derived(categoryConfig[category]);
</script>

<span
	data-testid="category-tag"
	class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium {config.classes}"
>
	{config.label}
</span>
