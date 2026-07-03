import { describe, it, expect, vi, beforeEach } from 'vitest';

// The config reads public env only in the browser; force that on for these tests.
vi.mock('$app/environment', () => ({ browser: true }));

describe('deployment config', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('reports features enabled and returns contact/controller when configured', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: {
				PUBLIC_MATOMO_URL: 'https://matomo.example.com/',
				PUBLIC_MATOMO_SITE_ID: '1',
				PUBLIC_AFFILIATE_TZE231: 'https://amzn.to/x',
				PUBLIC_CONTACT_EMAIL: 'privacy@example.com',
				PUBLIC_PRIVACY_CONTROLLER: 'Example Ltd'
			}
		}));
		const m = await import('./deployment');
		expect(m.isAnalyticsEnabled()).toBe(true);
		expect(m.isAffiliateEnabled()).toBe(true);
		expect(m.getContactEmail()).toBe('privacy@example.com');
		expect(m.getDataController()).toBe('Example Ltd');
	});

	it('reports everything disabled/neutral on an unconfigured fork (empty env)', async () => {
		vi.doMock('$env/dynamic/public', () => ({ env: {} }));
		const m = await import('./deployment');
		expect(m.isAnalyticsEnabled()).toBe(false);
		expect(m.isAffiliateEnabled()).toBe(false);
		expect(m.getContactEmail()).toBe('');
		expect(m.getDataController()).toBe('');
	});

	it('requires BOTH matomo url and site id for analytics', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_MATOMO_URL: 'https://matomo.example.com/' }
		}));
		const m = await import('./deployment');
		expect(m.isAnalyticsEnabled()).toBe(false);
	});
});
