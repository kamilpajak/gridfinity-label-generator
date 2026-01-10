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
	/** Badge text (e.g., "Best Seller", "Essential") */
	badge: string | null;
	/** Star rating (1-5) or null */
	rating: number | null;
	/** Product category for filtering */
	category: 'essential' | 'recommended' | 'nice-to-have';
}

/**
 * Top 3 recommended products for Gridfinity users.
 * Based on requirements document priorities.
 */
export const affiliateProducts: AffiliateProduct[] = [
	{
		id: 'magnets_6x2',
		name: 'Neodymium Magnets 6x2mm',
		description: 'N52 strength, 100-pack. Essential for Gridfinity bins.',
		priceDisplay: '$12.99',
		affiliateLink: null, // To be provided
		image: null,
		badge: 'Essential',
		rating: null,
		category: 'essential'
	},
	{
		id: 'brother_ptd210',
		name: 'Brother P-Touch Cube',
		description: 'Compact label printer. Supports 3.5mm to 12mm tapes.',
		priceDisplay: '$79.99',
		affiliateLink: null, // To be provided
		image: null,
		badge: null,
		rating: 4.8,
		category: 'recommended'
	},
	{
		id: 'tze_tape_12mm',
		name: 'TZe Label Tape 12mm',
		description: '5-pack assorted colors. Laminated, water resistant.',
		priceDisplay: '$24.99',
		affiliateLink: null, // To be provided
		image: null,
		badge: 'Best Seller',
		rating: null,
		category: 'essential'
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
	'As an Amazon Associate, we earn from qualifying purchases at no extra cost to you.';
