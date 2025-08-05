import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: {
		// Use dev server instead of preview for testing
		// This ensures hot reload and proper module loading
		command: 'pnpm dev',
		port: 5173,
		reuseExistingServer: !process.env.CI
	},
	testDir: 'e2e',

	// Set default viewport size for all tests
	use: {
		// Use Full HD viewport to ensure all UI elements are visible
		viewport: { width: 1920, height: 1080 },
		// Capture screenshot on failure
		screenshot: 'only-on-failure',
		// Capture video on failure
		video: 'retain-on-failure'
	},

	// Configure projects for different browsers if needed
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				// Override viewport to Full HD
				viewport: { width: 1920, height: 1080 },
				// Set actual browser window size for headed mode
				launchOptions: {
					args: ['--window-size=1920,1080', '--start-maximized']
				}
			}
		}
	]
});
