/**
 * Matomo Analytics Integration (Privacy-focused, cookieless)
 * Provides type-safe Matomo tracking for SvelteKit with GDPR considerations
 */

import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';

type MatomoCommand =
	| ['disableCookies']
	| ['setDoNotTrack', boolean]
	| ['trackPageView']
	| ['enableLinkTracking']
	| ['setTrackerUrl', string]
	| ['setSiteId', string]
	| ['trackEvent', string, string, string?, number?];

export interface MatomoTracker {
	push: (args: MatomoCommand) => void;
}

declare global {
	interface Window {
		_paq?: MatomoTracker;
	}
}

/**
 * Initialize Matomo tracking with privacy-focused settings
 * - Disables cookies (cookieless tracking)
 * - Respects DoNotTrack
 * - IP anonymization must be configured in Matomo admin (2-3 bytes)
 */
export function initMatomo(): void {
	if (typeof globalThis.window === 'undefined') return;

	// Disable analytics in development mode
	if (dev) {
		console.info('Analytics disabled in development mode');
		return;
	}

	// Validate configuration
	if (!env.PUBLIC_MATOMO_URL || !env.PUBLIC_MATOMO_SITE_ID) {
		console.warn('Matomo configuration is missing. Analytics will be disabled.');
		return;
	}

	// Initialize _paq array (Matomo uses a regular array that gets replaced by their script)
	globalThis.window._paq ??= [] as unknown as MatomoTracker;
	const _paq = globalThis.window._paq;

	// Privacy-focused configuration
	_paq.push(['disableCookies']); // Cookieless tracking
	_paq.push(['setDoNotTrack', true]); // Respect DNT header

	// Configure tracking
	// trackPageView is called via afterNavigate in +layout.svelte for both initial and subsequent navigations
	_paq.push(['enableLinkTracking']);

	// Set tracker URL and site ID from environment variables
	_paq.push(['setTrackerUrl', `${env.PUBLIC_MATOMO_URL}matomo.php`]);
	_paq.push(['setSiteId', env.PUBLIC_MATOMO_SITE_ID]);

	// Load Matomo script
	const script = document.createElement('script');
	script.async = true;
	script.src = `${env.PUBLIC_MATOMO_URL}matomo.js`;
	script.onerror = () => {
		console.error(`Failed to load Matomo script from ${script.src}`);
	};

	const firstScript = document.getElementsByTagName('script')[0];
	firstScript.parentNode?.insertBefore(script, firstScript);
}

/**
 * Track a page view manually
 * Use this for SPA navigation tracking
 */
export function trackPageView(): void {
	if (typeof globalThis.window === 'undefined' || !globalThis.window._paq) return;
	globalThis.window._paq.push(['trackPageView']);
}

/**
 * Track a custom event
 */
export function trackEvent(category: string, action: string, name?: string, value?: number): void {
	if (typeof globalThis.window === 'undefined' || !globalThis.window._paq) return;
	globalThis.window._paq.push(['trackEvent', category, action, name, value]);
}
