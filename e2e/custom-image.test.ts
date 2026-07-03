import { expect, test, type Page } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { SingleModePage } from './pages/single-mode/SingleModePage';
import type { ImageUploaderComponent } from './pages/components/ImageUploader';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E tests for Custom Image feature in General Mode labels
 * Tests upload, preview, rendering, and persistence of custom images
 */

// Create a simple test PNG image (1x1 red pixel)
function createTestPngBuffer(): Buffer {
	// Minimal valid PNG: 1x1 red pixel
	const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const ihdrChunk = Buffer.from([
		0x00,
		0x00,
		0x00,
		0x0d, // length
		0x49,
		0x48,
		0x44,
		0x52, // IHDR
		0x00,
		0x00,
		0x00,
		0x01, // width: 1
		0x00,
		0x00,
		0x00,
		0x01, // height: 1
		0x08,
		0x02, // bit depth: 8, color type: 2 (RGB)
		0x00,
		0x00,
		0x00, // compression, filter, interlace
		0x90,
		0x77,
		0x53,
		0xde // CRC
	]);
	const idatChunk = Buffer.from([
		0x00,
		0x00,
		0x00,
		0x0c, // length
		0x49,
		0x44,
		0x41,
		0x54, // IDAT
		0x08,
		0xd7,
		0x63,
		0xf8,
		0xcf,
		0xc0,
		0x00,
		0x00, // compressed data (red pixel)
		0x02,
		0x00,
		0x01,
		0x00, // CRC placeholder
		0x05,
		0xfe,
		0x02,
		0x00 // actual CRC
	]);
	const iendChunk = Buffer.from([
		0x00,
		0x00,
		0x00,
		0x00, // length
		0x49,
		0x45,
		0x4e,
		0x44, // IEND
		0xae,
		0x42,
		0x60,
		0x82 // CRC
	]);
	return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

// Create a test SVG file
function createTestSvgContent(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
		<rect fill="blue" width="100" height="100"/>
	</svg>`;
}

// Shared test files directory - cleaned up at start, not at end to avoid race conditions
const SHARED_TMP_DIR = path.join(__dirname, '.tmp-test-images');

// Ensure test files exist (idempotent)
function ensureTestFiles() {
	if (!fs.existsSync(SHARED_TMP_DIR)) {
		fs.mkdirSync(SHARED_TMP_DIR, { recursive: true });
	}

	const pngPath = path.join(SHARED_TMP_DIR, 'test-image.png');
	const svgPath = path.join(SHARED_TMP_DIR, 'test-image.svg');
	const txtPath = path.join(SHARED_TMP_DIR, 'test-file.txt');

	if (!fs.existsSync(pngPath)) {
		fs.writeFileSync(pngPath, createTestPngBuffer());
	}
	if (!fs.existsSync(svgPath)) {
		fs.writeFileSync(svgPath, createTestSvgContent());
	}
	if (!fs.existsSync(txtPath)) {
		fs.writeFileSync(txtPath, 'This is not an image');
	}

	return { pngPath, svgPath, txtPath };
}

// ============================================
// MODE CONFIGURATION FOR DATA-DRIVEN TESTS
// ============================================

interface ModeConfig {
	name: string;
	setupFor12mm: (page: Page) => Promise<ImageUploaderComponent>;
	setupFor9mm: (page: Page) => Promise<ImageUploaderComponent>;
	switchTo12mm: (page: Page) => Promise<void>;
}

const modes: ModeConfig[] = [
	{
		name: 'Single Mode',
		setupFor12mm: async (page: Page) => {
			const singlePage = new SingleModePage(page);
			await singlePage.goto();
			await singlePage.selectLabelSize('12mm');
			await singlePage.selectMode('general');
			return singlePage.getImageUploader();
		},
		setupFor9mm: async (page: Page) => {
			const singlePage = new SingleModePage(page);
			await singlePage.goto();
			await singlePage.selectLabelSize('9mm');
			await singlePage.selectMode('general');
			return singlePage.getImageUploader();
		},
		switchTo12mm: async (page: Page) => {
			const singlePage = new SingleModePage(page);
			await singlePage.selectLabelSize('12mm');
		}
	},
	{
		name: 'Batch Mode',
		setupFor12mm: async (page: Page) => {
			// Batch mode shares the single-mode form. Configure the shared form
			// (general + 12mm tape) and use the single custom-image uploader.
			const batchPage = new BatchModePage(page);
			await batchPage.goto();
			await batchPage.selectTapeHeight('12mm');
			const form = new SingleModePage(page);
			await form.selectMode('general');
			return form.getImageUploader();
		},
		setupFor9mm: async (page: Page) => {
			const batchPage = new BatchModePage(page);
			await batchPage.goto();
			await batchPage.selectTapeHeight('9mm');
			const form = new SingleModePage(page);
			await form.selectMode('general');
			return form.getImageUploader();
		},
		switchTo12mm: async (page: Page) => {
			const batchPage = new BatchModePage(page);
			await batchPage.selectTapeHeight('12mm');
		}
	}
];

// ============================================
// SHARED TESTS (run for both Single and Batch Mode)
// ============================================

for (const mode of modes) {
	test.describe(`Custom Image - ${mode.name} Upload`, () => {
		let testPngPath: string;
		let testSvgPath: string;
		let testTxtPath: string;

		test.beforeAll(() => {
			const paths = ensureTestFiles();
			testPngPath = paths.pngPath;
			testSvgPath = paths.svgPath;
			testTxtPath = paths.txtPath;
		});

		test('should show image preview after file upload', async ({ page }) => {
			const imageUploader = await mode.setupFor12mm(page);

			await imageUploader.expectDropzoneVisible();
			await imageUploader.uploadFile(testPngPath);
			await imageUploader.waitForPreview();
			await imageUploader.expectThumbnailVisible();
			await imageUploader.expectFilenameContains('test-image.png');
		});

		test('should show error for invalid file type', async ({ page }) => {
			const imageUploader = await mode.setupFor12mm(page);

			await imageUploader.uploadFile(testTxtPath);
			await imageUploader.waitForError();
			const errorMessage = await imageUploader.getErrorMessage();
			expect(errorMessage).toMatch(/invalid|not supported|type/i);
		});

		test('should upload SVG file successfully', async ({ page }) => {
			const imageUploader = await mode.setupFor12mm(page);

			await imageUploader.uploadAndWaitForPreview(testSvgPath);
			await imageUploader.expectFilenameContains('test-image.svg');
		});
	});

	test.describe(`Custom Image - ${mode.name} Preview Controls`, () => {
		let testPngPath: string;

		test.beforeAll(() => {
			const paths = ensureTestFiles();
			testPngPath = paths.pngPath;
		});

		test('should remove image when clicking remove button', async ({ page }) => {
			const imageUploader = await mode.setupFor12mm(page);

			await imageUploader.uploadAndWaitForPreview(testPngPath);
			await imageUploader.removeImage();
			await imageUploader.expectNoImage();
		});
	});

	test.describe(`Custom Image - ${mode.name} 9mm Tape Restriction`, () => {
		test('should not show image uploader for 9mm tape', async ({ page }) => {
			const imageUploader = await mode.setupFor9mm(page);
			expect(await imageUploader.isVisible()).toBe(false);
		});

		test('should show image uploader when switching from 9mm to 12mm', async ({ page }) => {
			const imageUploader = await mode.setupFor9mm(page);
			expect(await imageUploader.isVisible()).toBe(false);

			await mode.switchTo12mm(page);
			await imageUploader.expectDropzoneVisible();
		});
	});
}

// ============================================
// BATCH MODE SPECIFIC TESTS (Persistence)
// ============================================

test.describe('Custom Image - Batch Mode Persistence', () => {
	let testPngPath: string;

	test.beforeAll(() => {
		const paths = ensureTestFiles();
		testPngPath = paths.pngPath;
	});

	test('should persist image after page reload', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();
		await batchPage.selectTapeHeight('12mm');

		// Configure the shared form: general mode, primary text, custom image
		const form = new SingleModePage(page);
		await form.selectMode('general');
		await form.fillPrimaryText('Test Label');

		const imageUploader = form.getImageUploader();
		await imageUploader.uploadAndWaitForPreview(testPngPath);

		// Snapshot the configured label into the batch
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Wait for localStorage save (debounced 500ms + image encoding + state save)
		await expect
			.poll(
				async () => {
					const stored = await page.evaluate(() => localStorage.getItem('gridscribe_batch_v1'));
					return stored?.includes('data:image/') ?? false;
				},
				{ timeout: 5000 }
			)
			.toBe(true);

		// Reload page
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Navigate back to batch mode
		await batchPage.navigation.switchToBatchMode();
		await batchPage.waitForLabel(0);

		// The row chip should still render the custom image (an <img> element)
		const rowImage = batchPage.getLabelRow(0).locator('img');
		await expect(rowImage.first()).toBeVisible();
	});

	test('snapshot is independent of later form edits', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();
		await batchPage.selectTapeHeight('12mm');

		// Configure the shared form and snapshot it
		const form = new SingleModePage(page);
		await form.selectMode('general');
		await form.fillPrimaryText('Original');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		expect(await batchPage.getChipPrimaryText(0)).toContain('Original');

		// Change the form after snapshotting; the existing row must NOT change
		await form.fillPrimaryText('Changed');

		expect(await batchPage.getChipPrimaryText(0)).toContain('Original');
	});
});
