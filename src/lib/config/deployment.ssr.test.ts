import { describe, it, expect, vi } from 'vitest';

// Not in the browser (prerender/SSR): env must not be read even when set.
vi.mock('$app/environment', () => ({ browser: false }));
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_MATOMO_URL: 'https://matomo.example.com/',
		PUBLIC_MATOMO_SITE_ID: '1',
		PUBLIC_AFFILIATE_TZE231: 'https://amzn.to/x',
		PUBLIC_CONTACT_EMAIL: 'privacy@example.com',
		PUBLIC_PRIVACY_CONTROLLER: 'Example Ltd'
	}
}));

import {
	isAnalyticsEnabled,
	isAffiliateEnabled,
	getContactEmail,
	getDataController
} from './deployment';

describe('deployment config (SSR / prerender)', () => {
	it('returns disabled/empty regardless of env when not in the browser', () => {
		expect(isAnalyticsEnabled()).toBe(false);
		expect(isAffiliateEnabled()).toBe(false);
		expect(getContactEmail()).toBe('');
		expect(getDataController()).toBe('');
	});
});
