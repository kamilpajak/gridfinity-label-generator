import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	// Enable parallel test execution for faster CI runs
	fullyParallel: true,
	// Use 4 workers on CI (preview server is lightweight), auto-detect locally
	workers: process.env.CI ? 4 : undefined,

	// Configure reporters
	reporter: [
		['html', { outputFolder: 'playwright-report' }],
		['json', { outputFile: 'playwright-report/results.json' }]
	],

	webServer: {
		// CI: use optimized preview build (less CPU/RAM, faster responses)
		// Local: use dev server for hot reload during development
		command: process.env.CI ? 'pnpm preview' : 'pnpm dev',
		port: process.env.CI ? 4173 : 5173,
		reuseExistingServer: !process.env.CI
	},
	testDir: 'e2e',
	// Increase timeout for heavy tests (canvas rendering, randomized inputs)
	timeout: process.env.CI ? 60000 : 30000,

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
		},
		{
			name: 'firefox',
			use: {
				...devices['Desktop Firefox'],
				viewport: { width: 1920, height: 1080 }
			}
		},
		{
			name: 'webkit',
			use: {
				...devices['Desktop Safari'],
				viewport: { width: 1920, height: 1080 }
			}
		}
	]
});
