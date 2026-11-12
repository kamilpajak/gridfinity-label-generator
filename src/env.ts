import { defineEnvVars } from '@sveltejs/kit/env';

// All public vars are optional (may be unset) and read at runtime, matching the
// pre-SvelteKit-3 `$env/dynamic/public` behaviour. The identity schema accepts
// `undefined`, which defineEnvVars treats as declaring an optional variable.
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	PUBLIC_ALLOW_E2E_PAGES: { public: true, schema: optional },
	PUBLIC_MATOMO_URL: { public: true, schema: optional },
	PUBLIC_MATOMO_SITE_ID: { public: true, schema: optional },
	PUBLIC_CONTACT_EMAIL: { public: true, schema: optional },
	PUBLIC_PRIVACY_CONTROLLER: { public: true, schema: optional },
	PUBLIC_AFFILIATE_PTE560BT: { public: true, schema: optional },
	PUBLIC_AFFILIATE_PTP710BT: { public: true, schema: optional },
	PUBLIC_AFFILIATE_TZE231: { public: true, schema: optional },
	PUBLIC_AFFILIATE_MAGNETS: { public: true, schema: optional },
	PUBLIC_AMAZON_STORE_ID: { public: true, schema: optional },
	PUBLIC_ALLOWED_ORIGINS: { public: true, schema: optional }
});
