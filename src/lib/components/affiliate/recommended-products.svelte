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
			? 'hover:bg-slate-50'
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
		<div class="flex gap-3">
			<!-- Product icon -->
			<div
				class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 transition-all {hasLink
					? 'group-hover:bg-white group-hover:shadow-sm'
					: ''}"
			>
				<IconComponent class="h-6 w-6 text-slate-400" />
			</div>

			<!-- Product info -->
			<div class="min-w-0 flex-1">
				<h5
					class="mb-1 text-sm font-bold text-slate-800 transition-colors {hasLink
						? 'group-hover:text-blue-600'
						: ''}"
				>
					{product.name}
					{#if hasLink}
						<ExternalLink class="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-50" />
					{/if}
				</h5>
				<p class="mb-2 line-clamp-3 text-xs whitespace-pre-line text-slate-500">
					{product.description}
				</p>
				<div class="flex items-center justify-between">
					<span class="text-sm font-bold text-blue-600">{product.priceDisplay}</span>
					{#if product.badge}
						<span
							class="rounded px-2 py-0.5 text-[10px] font-medium {product.badge.includes('Value')
								? 'bg-green-100 text-green-700'
								: 'bg-purple-100 text-purple-700'}"
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
	</a>

	{#if !isLast}
		<div class="h-px bg-slate-100"></div>
	{/if}
{/snippet}

<div
	data-testid="recommended-products-card"
	class="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm"
>
	<!-- Header -->
	<div
		class="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white px-5 py-4"
	>
		<h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
			<Star class="h-4 w-4 text-amber-500" />
			Recommended Products
		</h3>
		<span
			class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 uppercase"
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
					<h4 class="text-xs font-bold tracking-wide text-slate-700 uppercase">Label Printers</h4>
				</div>

				{#each printers as product, index (product.id)}
					{@render productItem(product, index === printers.length - 1)}
				{/each}
			</div>
		{/if}

		<!-- Separator -->
		{#if printers.length > 0 && accessories.length > 0}
			<div class="h-px bg-slate-200"></div>
		{/if}

		<!-- Accessories Category -->
		{#if accessories.length > 0}
			<div class="space-y-3">
				<div class="mb-3 flex items-center gap-2">
					<Package class="h-4 w-4 text-emerald-500" />
					<h4 class="text-xs font-bold tracking-wide text-slate-700 uppercase">Accessories</h4>
				</div>

				{#each accessories as product, index (product.id)}
					{@render productItem(product, index === accessories.length - 1)}
				{/each}
			</div>
		{/if}
	</div>

	<!-- Disclosure -->
	<div class="border-t border-slate-100 px-5 py-4">
		<p class="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
			<Info class="mt-0.5 h-3 w-3 flex-shrink-0" />
			{AFFILIATE_DISCLOSURE}
		</p>
	</div>
</div>
