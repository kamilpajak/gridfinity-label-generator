import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original globals
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

describe('matomo', () => {
	let mockPaq: unknown[][];
	let mockScript: {
		async: boolean;
		src: string;
		onerror: (() => void) | null;
	};
	let mockFirstScript: {
		parentNode: {
			insertBefore: ReturnType<typeof vi.fn>;
		};
	};

	beforeEach(() => {
		vi.resetModules();

		// Setup mock _paq
		mockPaq = [];

		// Setup mock script element
		mockScript = {
			async: false,
			src: '',
			onerror: null
		};

		// Setup mock first script with parentNode
		mockFirstScript = {
			parentNode: {
				insertBefore: vi.fn()
			}
		};

		// Setup mock window with _paq that has push method
		(globalThis as unknown as { window: unknown }).window = {
			_paq: {
				push: (args: unknown[]) => mockPaq.push(args)
			}
		};

		// Setup mock document on globalThis
		(globalThis as unknown as { document: unknown }).document = {
			createElement: vi.fn().mockReturnValue(mockScript),
			getElementsByTagName: vi.fn().mockReturnValue([mockFirstScript])
		};
	});

	afterEach(() => {
		// Restore original globals
		(globalThis as unknown as { window: unknown }).window = originalWindow;
		(globalThis as unknown as { document: unknown }).document = originalDocument;
		vi.clearAllMocks();
	});

	describe('initMatomo - window undefined', () => {
		it('should return early when window is undefined', async () => {
			(globalThis as unknown as { window: undefined }).window = undefined;

			vi.doMock('$app/environment', () => ({ dev: false }));
			vi.doMock('$env/dynamic/public', () => ({
				env: { PUBLIC_MATOMO_URL: 'https://example.com/', PUBLIC_MATOMO_SITE_ID: '1' }
			}));

			const { initMatomo } = await import('./matomo');
			initMatomo();

			// Should not throw and _paq should be empty
			expect(mockPaq.length).toBe(0);
		});
	});

	describe('initMatomo - development mode', () => {
		it('should return early and log in development mode', async () => {
			vi.doMock('$app/environment', () => ({ dev: true }));
			vi.doMock('$env/dynamic/public', () => ({
				env: { PUBLIC_MATOMO_URL: 'https://example.com/', PUBLIC_MATOMO_SITE_ID: '1' }
			}));

			const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

			const { initMatomo } = await import('./matomo');
			initMatomo();

			expect(consoleSpy).toHaveBeenCalledWith('Analytics disabled in development mode');
			consoleSpy.mockRestore();
		});
	});

	describe('initMatomo - missing config', () => {
		it('should return early when Matomo URL is missing', async () => {
			vi.doMock('$app/environment', () => ({ dev: false }));
			vi.doMock('$env/dynamic/public', () => ({
				env: { PUBLIC_MATOMO_URL: '', PUBLIC_MATOMO_SITE_ID: '1' }
			}));

			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const { initMatomo } = await import('./matomo');
			initMatomo();

			expect(consoleSpy).toHaveBeenCalledWith(
				'Matomo configuration is missing. Analytics will be disabled.'
			);
			consoleSpy.mockRestore();
		});

		it('should return early when site ID is missing', async () => {
			vi.doMock('$app/environment', () => ({ dev: false }));
			vi.doMock('$env/dynamic/public', () => ({
				env: { PUBLIC_MATOMO_URL: 'https://example.com/', PUBLIC_MATOMO_SITE_ID: '' }
			}));

			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const { initMatomo } = await import('./matomo');
			initMatomo();

			expect(consoleSpy).toHaveBeenCalledWith(
				'Matomo configuration is missing. Analytics will be disabled.'
			);
			consoleSpy.mockRestore();
		});
	});

	describe('initMatomo - production mode', () => {
		beforeEach(() => {
			vi.doMock('$app/environment', () => ({ dev: false }));
			vi.doMock('$env/dynamic/public', () => ({
				env: { PUBLIC_MATOMO_URL: 'https://analytics.example.com/', PUBLIC_MATOMO_SITE_ID: '1' }
			}));
		});

		it('should initialize _paq with privacy-focused settings', async () => {
			const { initMatomo } = await import('./matomo');
			initMatomo();

			expect(mockPaq).toContainEqual(['disableCookies']);
			expect(mockPaq).toContainEqual(['setDoNotTrack', true]);
			expect(mockPaq).toContainEqual(['enableLinkTracking']);
		});

		it('should configure tracker URL and site ID', async () => {
			const { initMatomo } = await import('./matomo');
			initMatomo();

			expect(mockPaq).toContainEqual(['setTrackerUrl', 'https://analytics.example.com/matomo.php']);
			expect(mockPaq).toContainEqual(['setSiteId', '1']);
		});

		it('should create and insert Matomo script', async () => {
			const { initMatomo } = await import('./matomo');
			initMatomo();

			const mockDocument = globalThis.document as unknown as {
				createElement: ReturnType<typeof vi.fn>;
			};
			expect(mockDocument.createElement).toHaveBeenCalledWith('script');
			expect(mockScript.async).toBe(true);
			expect(mockScript.src).toBe('https://analytics.example.com/matomo.js');
			expect(mockFirstScript.parentNode.insertBefore).toHaveBeenCalledWith(
				mockScript,
				mockFirstScript
			);
		});

		it('should handle script load error', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const { initMatomo } = await import('./matomo');
			initMatomo();

			// Trigger onerror callback
			expect(mockScript.onerror).toBeDefined();
			mockScript.onerror?.();

			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to load Matomo script from https://analytics.example.com/matomo.js'
			);
			consoleSpy.mockRestore();
		});
	});

	describe('trackPageView', () => {
		beforeEach(() => {
			vi.doMock('$app/environment', () => ({ dev: false }));
			vi.doMock('$env/dynamic/public', () => ({
				env: { PUBLIC_MATOMO_URL: 'https://example.com/', PUBLIC_MATOMO_SITE_ID: '1' }
			}));
		});

		it('should return early when window is undefined', async () => {
			(globalThis as unknown as { window: undefined }).window = undefined;

			const { trackPageView } = await import('./matomo');
			trackPageView();

			expect(mockPaq.length).toBe(0);
		});

		it('should return early when _paq is not initialized', async () => {
			(globalThis as unknown as { window: object }).window = {};

			const { trackPageView } = await import('./matomo');
			trackPageView();

			// Should not throw
			expect(mockPaq.length).toBe(0);
		});

		it('should push trackPageView command', async () => {
			const { trackPageView } = await import('./matomo');
			trackPageView();

			expect(mockPaq).toContainEqual(['trackPageView']);
		});
	});

	describe('trackEvent', () => {
		beforeEach(() => {
			vi.doMock('$app/environment', () => ({ dev: false }));
			vi.doMock('$env/dynamic/public', () => ({
				env: { PUBLIC_MATOMO_URL: 'https://example.com/', PUBLIC_MATOMO_SITE_ID: '1' }
			}));
		});

		it('should return early when window is undefined', async () => {
			(globalThis as unknown as { window: undefined }).window = undefined;

			const { trackEvent } = await import('./matomo');
			trackEvent('category', 'action');

			expect(mockPaq.length).toBe(0);
		});

		it('should return early when _paq is not initialized', async () => {
			(globalThis as unknown as { window: object }).window = {};

			const { trackEvent } = await import('./matomo');
			trackEvent('category', 'action');

			expect(mockPaq.length).toBe(0);
		});

		it('should push trackEvent command with all parameters', async () => {
			const { trackEvent } = await import('./matomo');
			trackEvent('Download', 'PDF', 'manual.pdf', 42);

			expect(mockPaq).toContainEqual(['trackEvent', 'Download', 'PDF', 'manual.pdf', 42]);
		});

		it('should push trackEvent command with optional parameters undefined', async () => {
			const { trackEvent } = await import('./matomo');
			trackEvent('Navigation', 'Click');

			expect(mockPaq).toContainEqual(['trackEvent', 'Navigation', 'Click', undefined, undefined]);
		});
	});
});
