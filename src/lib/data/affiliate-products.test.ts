import { describe, it, expect } from 'vitest';
import {
	affiliateProducts,
	AMAZON_STORE_ID,
	AFFILIATE_DISCLOSURE,
	getProductsByCategory,
	getProductIconName,
	hasValidAffiliateLink,
	type AffiliateProduct
} from './affiliate-products';

describe('affiliate-products', () => {
	describe('affiliateProducts', () => {
		it('should have at least one product', () => {
			expect(affiliateProducts.length).toBeGreaterThan(0);
		});

		it('should have valid product structure', () => {
			affiliateProducts.forEach((product) => {
				expect(product).toHaveProperty('id');
				expect(product).toHaveProperty('name');
				expect(product).toHaveProperty('description');
				expect(product).toHaveProperty('priceDisplay');
				expect(product).toHaveProperty('category');
				expect(['printer', 'accessory']).toContain(product.category);
			});
		});

		it('should have unique product IDs', () => {
			const ids = affiliateProducts.map((p) => p.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(ids.length);
		});

		it('should have printers and accessories', () => {
			const printers = affiliateProducts.filter((p) => p.category === 'printer');
			const accessories = affiliateProducts.filter((p) => p.category === 'accessory');

			expect(printers.length).toBeGreaterThan(0);
			expect(accessories.length).toBeGreaterThan(0);
		});

		it('should have valid affiliate links or null', () => {
			affiliateProducts.forEach((product) => {
				if (product.affiliateLink !== null) {
					expect(product.affiliateLink).toMatch(/^https:\/\//);
				}
			});
		});

		it('should have price display format', () => {
			affiliateProducts.forEach((product) => {
				expect(product.priceDisplay).toMatch(/^\$\d+(\.\d{2})?$/);
			});
		});
	});

	describe('AMAZON_STORE_ID', () => {
		it('should be a valid store ID', () => {
			expect(AMAZON_STORE_ID).toBe('gridfinitylab-20');
		});
	});

	describe('AFFILIATE_DISCLOSURE', () => {
		it('should contain required disclosure text', () => {
			expect(AFFILIATE_DISCLOSURE).toContain('Amazon Associate');
			expect(AFFILIATE_DISCLOSURE).toContain('earn');
		});
	});

	describe('getProductsByCategory', () => {
		it('should return only printers', () => {
			const printers = getProductsByCategory('printer');
			expect(printers.length).toBeGreaterThan(0);
			printers.forEach((p) => expect(p.category).toBe('printer'));
		});

		it('should return only accessories', () => {
			const accessories = getProductsByCategory('accessory');
			expect(accessories.length).toBeGreaterThan(0);
			accessories.forEach((p) => expect(p.category).toBe('accessory'));
		});
	});

	describe('getProductIconName', () => {
		it('should return magnet for magnets product', () => {
			expect(getProductIconName('magnets_6x2')).toBe('magnet');
		});

		it('should return printer for printer products', () => {
			expect(getProductIconName('brother_pte560bt')).toBe('printer');
			expect(getProductIconName('brother_ptp710bt')).toBe('printer');
		});

		it('should return disc for tape product', () => {
			expect(getProductIconName('tze231_tape')).toBe('disc');
		});

		it('should return star for unknown products', () => {
			expect(getProductIconName('unknown_product')).toBe('star');
			expect(getProductIconName('')).toBe('star');
		});
	});

	describe('hasValidAffiliateLink', () => {
		it('should return true for valid https links', () => {
			const product: AffiliateProduct = {
				id: 'test',
				name: 'Test',
				description: 'Test',
				priceDisplay: '$10.00',
				affiliateLink: 'https://amzn.to/abc123',
				image: null,
				badge: null,
				rating: null,
				category: 'printer'
			};
			expect(hasValidAffiliateLink(product)).toBe(true);
		});

		it('should return false for null links', () => {
			const product: AffiliateProduct = {
				id: 'test',
				name: 'Test',
				description: 'Test',
				priceDisplay: '$10.00',
				affiliateLink: null,
				image: null,
				badge: null,
				rating: null,
				category: 'printer'
			};
			expect(hasValidAffiliateLink(product)).toBe(false);
		});

		it('should return false for non-https links', () => {
			const product: AffiliateProduct = {
				id: 'test',
				name: 'Test',
				description: 'Test',
				priceDisplay: '$10.00',
				affiliateLink: 'http://insecure.com',
				image: null,
				badge: null,
				rating: null,
				category: 'printer'
			};
			expect(hasValidAffiliateLink(product)).toBe(false);
		});
	});
});
