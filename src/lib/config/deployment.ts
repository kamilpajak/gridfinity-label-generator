/**
 * Deployment-specific configuration derived from public environment variables.
 *
 * The in-app Privacy Policy is rendered from these so a fork/self-host only makes
 * claims that are true for its own deployment. With nothing configured, analytics
 * and affiliate sections are omitted and a neutral self-hosted notice is shown.
 */
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

const AFFILIATE_KEYS = [
	'PUBLIC_AFFILIATE_PTE560BT',
	'PUBLIC_AFFILIATE_PTP710BT',
	'PUBLIC_AFFILIATE_TZE231',
	'PUBLIC_AFFILIATE_MAGNETS'
] as const;

// Read public env only in the browser. During prerender/SSR `$env/dynamic/public`
// is unavailable (SvelteKit throws), and the privacy modal is only ever rendered
// client-side (it starts closed), so an empty value at build time is correct.
const read = (key: `PUBLIC_${string}`): string => (browser ? (env[key] ?? '') : '').trim();

/** Analytics is active only when a Matomo endpoint AND site id are configured. */
export function isAnalyticsEnabled(): boolean {
	return !!(read('PUBLIC_MATOMO_URL') && read('PUBLIC_MATOMO_SITE_ID'));
}

/** Affiliate links are active when at least one affiliate id is configured. */
export function isAffiliateEnabled(): boolean {
	return AFFILIATE_KEYS.some((key) => read(key));
}

/** Operator contact email for the policy (empty on an unconfigured fork). */
export function getContactEmail(): string {
	return read('PUBLIC_CONTACT_EMAIL');
}

/** Named data controller for the policy (empty on an unconfigured fork). */
export function getDataController(): string {
	return read('PUBLIC_PRIVACY_CONTROLLER');
}
