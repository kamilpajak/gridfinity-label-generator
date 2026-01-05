<script lang="ts">
	import type { ChangeCategory } from '$lib/types/changelog';

	interface Props {
		category: ChangeCategory;
	}

	const { category }: Props = $props();

	const categoryConfig: Record<ChangeCategory, { label: string; classes: string }> = {
		added: { label: 'Feature', classes: 'bg-emerald-100 text-emerald-700' },
		changed: { label: 'Changed', classes: 'bg-amber-100 text-amber-700' },
		fixed: { label: 'Bug Fix', classes: 'bg-red-100 text-red-700' },
		removed: { label: 'Removed', classes: 'bg-slate-100 text-slate-700' },
		improved: { label: 'Improvement', classes: 'bg-amber-100 text-amber-700' }
	};

	const config = $derived(categoryConfig[category]);
</script>

<span
	data-testid="category-tag"
	class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium {config.classes}"
>
	{config.label}
</span>
