import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Auto-discover SVG files in static/images/standards/ at build time.
 * This prevents 404 attempts for non-existent SVGs.
 */
function discoverAvailableSvgs(): string[] {
	const svgDir = resolve(process.cwd(), 'static/images/standards');
	if (!existsSync(svgDir)) {
		return [];
	}
	return readdirSync(svgDir).filter((f) => f.endsWith('.svg'));
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		__AVAILABLE_SVGS__: JSON.stringify(discoverAvailableSvgs())
	},
	test: {
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			reportsDirectory: './coverage',
			include: ['src/lib/**/*.ts', 'src/routes/**/*.ts'],
			exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types/**', '**/*.d.ts']
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
