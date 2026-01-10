// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/**
	 * Auto-discovered SVG files from static/images/standards/
	 * Injected by Vite at build time - see vite.config.ts
	 */
	const __AVAILABLE_SVGS__: string[];
}

export {};
