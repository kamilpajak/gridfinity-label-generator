/**
 * Affiliate products data for Amazon Associates integration.
 *
 * Affiliate links and the Amazon store ID are NOT hard-coded here — they are
 * injected at runtime from public environment variables so that forks/re-hosts
 * of this open-source project do not ship the maintainer's affiliate tag
 * (which would violate the Amazon Associates Operating Agreement). Set
 * `PUBLIC_AFFILIATE_*` and `PUBLIC_AMAZON_STORE_ID` in your deployment env
 * (see .env.example). When unset, products render without a clickable link.
 */

import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

/** Read a public affiliate env var, but only in the browser (dynamic public env
 * cannot be accessed during prerendering). Returns null when unset/prerendered. */
function affiliateEnv(key: `PUBLIC_${string}`): string | null {
	return browser ? env[key] || null : null;
}

export interface AffiliateProduct {
	id: string;
	name: string;
	description: string;
	/** Price display string (informational only - actual price shown by Amazon) */
	priceDisplay: string;
	/** Amazon affiliate link (to be provided) */
	affiliateLink: string | null;
	/** Product image path or null for icon fallback */
	image: string | null;
	/** Badge text (e.g., "Best Seller", "Premium Choice") */
	badge: string | null;
	/** Star rating (1-5) or null */
	rating: number | null;
	/** Product category for display grouping */
	category: 'printer' | 'accessory';
}

/**
 * Recommended products for Gridfinity users.
 * Grouped by category: printers first, then accessories.
 */
export const affiliateProducts: AffiliateProduct[] = [
	// Label Printers
	{
		id: 'brother_pte560bt',
		name: 'Brother PT-E560BT',
		description:
			"I use this whenever I'm setting up new Gridfinity bins or updating my workshop labels.\nIt's reliable and fast.",
		priceDisplay: '$239.84',
		affiliateLink: affiliateEnv('PUBLIC_AFFILIATE_PTE560BT'),
		image: null,
		badge: '💎 My Top Pick',
		rating: null,
		category: 'printer'
	},
	{
		id: 'brother_ptp710bt',
		name: 'Brother P-touch CUBE Plus',
		description: 'Compact Bluetooth label printer.\nGreat for home and small Gridfinity projects.',
		priceDisplay: '$99.98',
		affiliateLink: affiliateEnv('PUBLIC_AFFILIATE_PTP710BT'),
		image: null,
		badge: '💰 Great Value',
		rating: null,
		category: 'printer'
	},
	// Accessories
	{
		id: 'tze231_tape',
		name: 'Brother TZe-231 Tape',
		description: "12mm black on white.\nProven durability – won't fade or peel.",
		priceDisplay: '$27.45',
		affiliateLink: affiliateEnv('PUBLIC_AFFILIATE_TZE231'),
		image: null,
		badge: 'Best Seller',
		rating: null,
		category: 'accessory'
	},
	{
		id: 'magnets_6x2',
		name: 'Neodymium Magnets 6x2mm',
		description: 'Precise 6x2mm dimensions.\nPerfect for Gridfinity bins.',
		priceDisplay: '$13.99',
		affiliateLink: affiliateEnv('PUBLIC_AFFILIATE_MAGNETS'),
		image: null,
		badge: null,
		rating: null,
		category: 'accessory'
	}
];

/**
 * Amazon Associates Store ID for tracking (injected from env; empty in the
 * public repo so forks do not ship the maintainer's affiliate tag).
 */
export const AMAZON_STORE_ID = browser ? env.PUBLIC_AMAZON_STORE_ID || '' : '';

/**
 * Disclosure text required by Amazon Associates.
 */
export const AFFILIATE_DISCLOSURE =
	'As an Amazon Associate, we earn from qualifying purchases at no extra cost to you. Prices may vary.';

/**
 * Get products filtered by category.
 */
export function getProductsByCategory(category: AffiliateProduct['category']): AffiliateProduct[] {
	return affiliateProducts.filter((p) => p.category === category);
}

/**
 * Icon name mapping for product IDs.
 * Used by UI components to display appropriate icons.
 */
export type ProductIconName = 'magnet' | 'printer' | 'disc' | 'star';

/**
 * Get icon name for a product ID.
 */
export function getProductIconName(productId: string): ProductIconName {
	switch (productId) {
		case 'magnets_6x2':
			return 'magnet';
		case 'brother_pte560bt':
		case 'brother_ptp710bt':
			return 'printer';
		case 'tze231_tape':
			return 'disc';
		default:
			return 'star';
	}
}

/**
 * Check if a product has a valid affiliate link.
 */
export function hasValidAffiliateLink(product: AffiliateProduct): boolean {
	return product.affiliateLink?.startsWith('https://') ?? false;
}
