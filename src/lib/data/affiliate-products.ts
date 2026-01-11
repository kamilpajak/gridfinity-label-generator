/**
 * Affiliate products data for Amazon Associates integration.
 * Store ID: gridfinitylab-20
 *
 * Note: Affiliate links will be added later. For now, links are placeholders.
 */

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
		description: 'Industrial label printer with Bluetooth and auto-cutter.',
		priceDisplay: '$239.84',
		affiliateLink: 'https://amzn.to/4qjqcWr',
		image: null,
		badge: '💎 My Top Pick',
		rating: null,
		category: 'printer'
	},
	{
		id: 'brother_ptp710bt',
		name: 'Brother P-touch CUBE Plus',
		description: 'Compact Bluetooth label printer. Great for home and office.',
		priceDisplay: '$99.98',
		affiliateLink: 'https://amzn.to/4jBHF9R',
		image: null,
		badge: '💰 Great Value',
		rating: null,
		category: 'printer'
	},
	// Accessories
	{
		id: 'tze231_tape',
		name: 'Brother TZe-231 Tape',
		description: '12mm black on white. Laminated for durability.',
		priceDisplay: '$27.45',
		affiliateLink: 'https://amzn.to/4suZgVb',
		image: null,
		badge: 'Best Seller',
		rating: null,
		category: 'accessory'
	},
	{
		id: 'magnets_6x2',
		name: 'Neodymium Magnets 6x2mm',
		description: 'Precise 6x2mm dimensions. Perfect for Gridfinity bins.',
		priceDisplay: '$13.99',
		affiliateLink: 'https://amzn.to/49lx7XC',
		image: null,
		badge: null,
		rating: null,
		category: 'accessory'
	}
];

/**
 * Amazon Associates Store ID for tracking.
 */
export const AMAZON_STORE_ID = 'gridfinitylab-20';

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
