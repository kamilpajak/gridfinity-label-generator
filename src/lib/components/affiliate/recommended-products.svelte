<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import Magnet from '@lucide/svelte/icons/magnet';
	import Printer from '@lucide/svelte/icons/printer';
	import Disc from '@lucide/svelte/icons/disc';
	import Package from '@lucide/svelte/icons/package';
	import Info from '@lucide/svelte/icons/info';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import {
		AFFILIATE_DISCLOSURE,
		getProductsByCategory,
		getProductIconName,
		type AffiliateProduct
	} from '$lib/data/affiliate-products';
	import { trackEvent } from '$lib/matomo';

	// Group products by category using shared utility
	const printers = getProductsByCategory('printer');
	const accessories = getProductsByCategory('accessory');

	/**
	 * Track affiliate link click in Matomo.
	 */
	function trackClick(product: AffiliateProduct) {
		trackEvent('Affiliate', 'Click', product.name);
	}

	/**
	 * Get icon component for product based on ID.
	 */
	function getProductIcon(productId: string) {
		const iconName = getProductIconName(productId);
		switch (iconName) {
			case 'magnet':
				return Magnet;
			case 'printer':
				return Printer;
			case 'disc':
				return Disc;
			default:
				return Star;
		}
	}

	/** Bordered-pill classes for a product badge, colored by its kind. */
	function badgeClasses(badge: string): string {
		if (badge.includes('Value')) {
			return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
		}
		if (badge.includes('Top Pick')) {
			return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
		}
		return 'bg-slate-800 text-slate-300 border border-slate-700';
	}
</script>

{#snippet productCard(product: AffiliateProduct)}
	{@const IconComponent = getProductIcon(product.id)}
	{@const hasLink = product.affiliateLink !== null}

	<a
		href={product.affiliateLink ?? '#'}
		target={hasLink ? '_blank' : undefined}
		rel={hasLink ? 'noopener noreferrer sponsored' : undefined}
		class="group flex flex-col gap-3 rounded-xl border border-slate-700/50 bg-slate-950/50 p-3 transition-colors {hasLink
			? 'hover:border-slate-600'
			: 'cursor-default'}"
		onclick={(e) => {
			if (!hasLink) {
				e.preventDefault();
				return;
			}
			trackClick(product);
		}}
		data-testid="affiliate-product-{product.id}"
	>
		<!-- Top row: icon + (name, price & badge) -->
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 transition-colors {hasLink
					? 'group-hover:border-slate-700'
					: ''}"
			>
				<IconComponent class="h-5 w-5 text-slate-400" />
			</div>

			<div class="min-w-0 flex-1">
				<h5
					class="truncate text-sm font-bold text-slate-200 transition-colors {hasLink
						? 'group-hover:text-cyan-400'
						: ''}"
				>
					{product.name}
					{#if hasLink}
						<ExternalLink class="ml-0.5 inline h-3 w-3 opacity-0 group-hover:opacity-50" />
					{/if}
				</h5>
				<div class="mt-0.5 flex items-center gap-2">
					<span class="text-sm font-bold text-cyan-400">{product.priceDisplay}</span>
					{#if product.badge}
						<span class="rounded px-1.5 py-0.5 text-[10px] font-bold {badgeClasses(product.badge)}">
							{product.badge}
						</span>
					{:else if product.rating}
						<span class="flex items-center gap-1 text-[10px] text-slate-400">
							<Star class="h-3 w-3 fill-amber-400 text-amber-400" />
							{product.rating}
						</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Description below -->
		<p class="text-xs leading-relaxed whitespace-pre-line text-slate-400">
			{product.description}
		</p>
	</a>
{/snippet}

<div data-testid="recommended-products-card" class="w-full">
	<!-- Section header -->
	<div class="mb-5 flex items-center justify-between">
		<h3
			class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-slate-400 uppercase"
		>
			<Star class="h-3 w-3 text-amber-500" />
			Recommended
		</h3>
		<span
			class="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-500 uppercase"
		>
			Partner
		</span>
	</div>

	<div class="space-y-6">
		<!-- Label Printers Category -->
		{#if printers.length > 0}
			<div>
				<div
					class="mb-3 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase"
				>
					<Printer class="h-3 w-3" />
					Printers
				</div>
				<div class="space-y-3">
					{#each printers as product (product.id)}
						{@render productCard(product)}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Accessories Category -->
		{#if accessories.length > 0}
			<div>
				<div
					class="mb-3 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase"
				>
					<Package class="h-3 w-3" />
					Accessories
				</div>
				<div class="space-y-3">
					{#each accessories as product (product.id)}
						{@render productCard(product)}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Disclosure -->
		<div
			class="flex items-start gap-1.5 rounded-lg border border-slate-800/50 bg-slate-900/50 p-2.5 text-[10px] leading-relaxed text-slate-500"
		>
			<Info class="mt-0.5 h-3 w-3 flex-shrink-0" />
			<p>{AFFILIATE_DISCLOSURE}</p>
		</div>
	</div>
</div>
