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
</script>

{#snippet productItem(product: AffiliateProduct, isLast: boolean)}
	{@const IconComponent = getProductIcon(product.id)}
	{@const hasLink = product.affiliateLink !== null}

	<a
		href={product.affiliateLink ?? '#'}
		target={hasLink ? '_blank' : undefined}
		rel={hasLink ? 'noopener noreferrer sponsored' : undefined}
		class="group -mx-2 block rounded-lg px-2 py-3 transition-all {hasLink
			? 'hover:bg-slate-800/60'
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
		<div class="flex flex-col gap-2">
			<!-- Top row: icon + (name, price & badge) -->
			<div class="flex items-center gap-3">
				<div
					class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 transition-all {hasLink
						? 'group-hover:border-slate-700'
						: ''}"
				>
					<IconComponent class="h-5 w-5 text-slate-400" />
				</div>

				<div class="min-w-0 flex-1">
					<h5
						class="text-sm font-bold text-slate-100 transition-colors {hasLink
							? 'group-hover:text-cyan-400'
							: ''}"
					>
						{product.name}
						{#if hasLink}
							<ExternalLink class="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-50" />
						{/if}
					</h5>
					<div class="mt-0.5 flex items-center gap-2">
						<span class="text-sm font-bold text-cyan-400">{product.priceDisplay}</span>
						{#if product.badge}
							<span
								class="rounded px-2 py-0.5 text-[10px] font-medium {product.badge.includes('Value')
									? 'bg-emerald-500/15 text-emerald-400'
									: 'bg-indigo-500/15 text-indigo-400'}"
							>
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
			<p class="line-clamp-3 text-xs whitespace-pre-line text-slate-400">
				{product.description}
			</p>
		</div>
	</a>

	{#if !isLast}
		<div class="h-px bg-slate-800"></div>
	{/if}
{/snippet}

<div
	data-testid="recommended-products-card"
	class="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-sm"
>
	<!-- Header -->
	<div
		class="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-amber-500/10 to-transparent px-5 py-4"
	>
		<h3 class="flex items-center gap-2 text-lg font-bold text-slate-100">
			<Star class="h-4 w-4 text-amber-500" />
			Recommended Products
		</h3>
		<span
			class="rounded-full border border-amber-500/20 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-400 uppercase"
		>
			Partner
		</span>
	</div>

	<div class="space-y-5 p-5">
		<!-- Label Printers Category -->
		{#if printers.length > 0}
			<div class="space-y-3">
				<div class="mb-3 flex items-center gap-2">
					<Printer class="h-4 w-4 text-indigo-500" />
					<h4 class="text-xs font-bold tracking-wide text-slate-300 uppercase">Label Printers</h4>
				</div>

				{#each printers as product, index (product.id)}
					{@render productItem(product, index === printers.length - 1)}
				{/each}
			</div>
		{/if}

		<!-- Separator -->
		{#if printers.length > 0 && accessories.length > 0}
			<div class="h-px bg-slate-800"></div>
		{/if}

		<!-- Accessories Category -->
		{#if accessories.length > 0}
			<div class="space-y-3">
				<div class="mb-3 flex items-center gap-2">
					<Package class="h-4 w-4 text-emerald-500" />
					<h4 class="text-xs font-bold tracking-wide text-slate-300 uppercase">Accessories</h4>
				</div>

				{#each accessories as product, index (product.id)}
					{@render productItem(product, index === accessories.length - 1)}
				{/each}
			</div>
		{/if}
	</div>

	<!-- Disclosure -->
	<div class="border-t border-slate-800/50 bg-slate-900/50 px-5 py-4">
		<p class="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500">
			<Info class="mt-0.5 h-3 w-3 flex-shrink-0" />
			{AFFILIATE_DISCLOSURE}
		</p>
	</div>
</div>
