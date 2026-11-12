import { dev } from '$app/env';
import { PUBLIC_ALLOW_E2E_PAGES } from '$app/env/public';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	// E2E pages are allowed in dev mode or when explicitly enabled via env var (CI).
	const isE2EAllowed = PUBLIC_ALLOW_E2E_PAGES === 'true';

	if (!dev && !isE2EAllowed) {
		error(404, 'Not Found');
	}
};
