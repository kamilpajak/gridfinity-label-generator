// Capture a crisp README hero screenshot at 2x (retina) of a filled label state.
// Usage: URL=http://localhost:5173/ node scripts/capture-hero.mjs [outPath]
import { chromium } from '@playwright/test';

const url = process.env.URL || 'http://localhost:5173/';
const out = process.argv[2] || 'docs/screenshot.png';

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 1280, height: 800 },
	deviceScaleFactor: 2 // retina-sharp text + canvas
});
const page = await context.newPage();

await page.goto(url, { waitUntil: 'networkidle' });
// Canvas text falls back to a system font if the webfont is not loaded yet.
await page.evaluate(() => document.fonts.ready);

// Fill a representative fastener label: ISO 4762 / DIN 912, M8, 20 mm.
await page.getByTestId('hardware-select').click();
await page.getByRole('option', { name: 'ISO 4762 / DIN 912 Hexagon' }).click();
await page.getByTestId('thread-size-select').click();
await page.getByRole('option', { name: 'M8', exact: true }).click();
await page.getByTestId('length-input').fill('20');

// Wait for the live preview to replace the empty state (condition-based, no fixed sleep).
await page.getByText('Ready to design').waitFor({ state: 'detached' });
await page.getByTestId('export-button').waitFor({ state: 'visible' });
await page.waitForFunction(() => {
	const b = document.querySelector('[data-testid="export-button"]');
	return b && !b.hasAttribute('disabled');
});

await page.screenshot({ path: out });
await browser.close();
console.log('captured', out);
