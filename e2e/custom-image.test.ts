import { expect, test } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { SingleModePage } from './pages/single-mode/SingleModePage';
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

test.describe('Custom Image - Upload', () => {
	let testPngPath: string;
	let testSvgPath: string;
	let testTxtPath: string;

	test.beforeAll(() => {
		const paths = ensureTestFiles();
		testPngPath = paths.pngPath;
		testSvgPath = paths.svgPath;
		testTxtPath = paths.txtPath;
	});

	test('should show image preview after file upload via input', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		// Ensure 12mm tape (required for custom images)
		await batchPage.selectTapeHeight('12mm');

		// Add a general mode label
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Switch to general mode
		await batchPage.switchLabelMode(0, 'general');

		// Get image uploader component
		const imageUploader = batchPage.getImageUploader(0);

		// Wait for the image uploader to appear
		await imageUploader.expectDropzoneVisible();

		// Upload image via file input
		await imageUploader.uploadFile(testPngPath);

		// Wait for preview to appear
		await imageUploader.waitForPreview();

		// Check thumbnail is displayed
		await imageUploader.expectThumbnailVisible();

		// Check filename is displayed
		await imageUploader.expectFilenameContains('test-image.png');
	});

	test('should show error for invalid file type', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();
		await batchPage.selectTapeHeight('12mm');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Switch to general mode
		await batchPage.switchLabelMode(0, 'general');

		// Get image uploader component
		const imageUploader = batchPage.getImageUploader(0);

		// Try to upload invalid file
		await imageUploader.uploadFile(testTxtPath);

		// Error message should appear
		await imageUploader.waitForError();
		const errorMessage = await imageUploader.getErrorMessage();
		expect(errorMessage).toMatch(/invalid|not supported|type/i);
	});

	test('should upload SVG file successfully', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();
		await batchPage.selectTapeHeight('12mm');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Switch to general mode
		await batchPage.switchLabelMode(0, 'general');

		// Get image uploader component
		const imageUploader = batchPage.getImageUploader(0);

		// Upload SVG and wait for preview
		await imageUploader.uploadAndWaitForPreview(testSvgPath);

		// Verify filename
		await imageUploader.expectFilenameContains('test-image.svg');
	});
});

test.describe('Custom Image - Preview Controls', () => {
	let testPngPath: string;

	test.beforeAll(() => {
		const paths = ensureTestFiles();
		testPngPath = paths.pngPath;
	});

	test('should remove image when clicking remove button', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();
		await batchPage.selectTapeHeight('12mm');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Switch to general mode
		await batchPage.switchLabelMode(0, 'general');

		// Get image uploader component
		const imageUploader = batchPage.getImageUploader(0);

		// Upload image and wait for preview
		await imageUploader.uploadAndWaitForPreview(testPngPath);

		// Remove image
		await imageUploader.removeImage();

		// Preview should disappear, dropzone should reappear
		await imageUploader.expectNoImage();
	});
});

test.describe('Custom Image - Persistence', () => {
	let testPngPath: string;

	test.beforeAll(() => {
		const paths = ensureTestFiles();
		testPngPath = paths.pngPath;
	});

	test('should persist image after page reload', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();
		await batchPage.selectTapeHeight('12mm');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Switch to general mode
		await batchPage.switchLabelMode(0, 'general');

		// Fill in primary text (required)
		await batchPage.getPrimaryTextInput(0).fill('Test Label');

		// Get image uploader and upload image
		const imageUploader = batchPage.getImageUploader(0);
		await imageUploader.uploadAndWaitForPreview(testPngPath);

		// Wait for localStorage save (debounced 500ms)
		await page.waitForTimeout(1000);

		// Reload page
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Navigate back to batch mode
		await batchPage.navigation.switchToBatchMode();
		await batchPage.waitForLabel(0);

		// Image should still be there
		const reloadedUploader = batchPage.getImageUploader(0);
		await reloadedUploader.waitForPreview();
		await reloadedUploader.expectFilenameContains('test-image.png');
	});

	test('should create independent copy when duplicating label', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();
		await batchPage.selectTapeHeight('12mm');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Switch to general mode
		await batchPage.switchLabelMode(0, 'general');

		// Get image uploader and upload image
		const imageUploader0 = batchPage.getImageUploader(0);
		await imageUploader0.uploadAndWaitForPreview(testPngPath);

		// Duplicate the label
		await batchPage.duplicateLabel(0);
		await batchPage.waitForLabel(1);

		// Both labels should have the image
		const imageUploader1 = batchPage.getImageUploader(1);
		await imageUploader1.expectPreviewVisible();

		// Remove image from duplicated label
		await imageUploader1.removeImage();

		// Original should still have the image (deep copy, not shared reference)
		await imageUploader0.expectPreviewVisible();
		await imageUploader1.expectDropzoneVisible();
	});
});

test.describe('Custom Image - 9mm Tape Restriction', () => {
	test('should not show image uploader for 9mm tape', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		// Select 9mm tape
		await batchPage.selectTapeHeight('9mm');

		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Switch to general mode
		await batchPage.switchLabelMode(0, 'general');

		// Image uploader should NOT be visible for 9mm tape
		const imageUploader = batchPage.getImageUploader(0);
		expect(await imageUploader.isVisible()).toBe(false);
	});

	test('should show image uploader when switching from 9mm to 12mm', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		// Start with 9mm
		await batchPage.selectTapeHeight('9mm');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Switch to general mode
		await batchPage.switchLabelMode(0, 'general');

		// No uploader for 9mm
		const imageUploader = batchPage.getImageUploader(0);
		expect(await imageUploader.isVisible()).toBe(false);

		// Switch to 12mm
		await batchPage.selectTapeHeight('12mm');

		// Uploader should now be visible
		await imageUploader.expectDropzoneVisible();
	});
});

// ============================================
// SINGLE MODE TESTS
// ============================================

test.describe('Custom Image - Single Mode Upload', () => {
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
		const singlePage = new SingleModePage(page);
		await singlePage.goto();

		// Ensure 12mm tape (required for custom images)
		await singlePage.selectLabelSize('12mm');

		// Switch to general mode
		await singlePage.selectMode('general');

		// Get image uploader component
		const imageUploader = singlePage.getImageUploader();

		// Wait for the image uploader to appear
		await imageUploader.expectDropzoneVisible();

		// Upload image via file input
		await imageUploader.uploadFile(testPngPath);

		// Wait for preview to appear
		await imageUploader.waitForPreview();

		// Check thumbnail is displayed
		await imageUploader.expectThumbnailVisible();

		// Check filename is displayed
		await imageUploader.expectFilenameContains('test-image.png');
	});

	test('should show error for invalid file type', async ({ page }) => {
		const singlePage = new SingleModePage(page);
		await singlePage.goto();
		await singlePage.selectLabelSize('12mm');
		await singlePage.selectMode('general');

		const imageUploader = singlePage.getImageUploader();

		// Try to upload invalid file
		await imageUploader.uploadFile(testTxtPath);

		// Error message should appear
		await imageUploader.waitForError();
		const errorMessage = await imageUploader.getErrorMessage();
		expect(errorMessage).toMatch(/invalid|not supported|type/i);
	});

	test('should upload SVG file successfully', async ({ page }) => {
		const singlePage = new SingleModePage(page);
		await singlePage.goto();
		await singlePage.selectLabelSize('12mm');
		await singlePage.selectMode('general');

		const imageUploader = singlePage.getImageUploader();

		// Upload SVG and wait for preview
		await imageUploader.uploadAndWaitForPreview(testSvgPath);

		// Verify filename
		await imageUploader.expectFilenameContains('test-image.svg');
	});
});

test.describe('Custom Image - Single Mode Preview Controls', () => {
	let testPngPath: string;

	test.beforeAll(() => {
		const paths = ensureTestFiles();
		testPngPath = paths.pngPath;
	});

	test('should remove image when clicking remove button', async ({ page }) => {
		const singlePage = new SingleModePage(page);
		await singlePage.goto();
		await singlePage.selectLabelSize('12mm');
		await singlePage.selectMode('general');

		const imageUploader = singlePage.getImageUploader();

		// Upload image and wait for preview
		await imageUploader.uploadAndWaitForPreview(testPngPath);

		// Remove image
		await imageUploader.removeImage();

		// Preview should disappear, dropzone should reappear
		await imageUploader.expectNoImage();
	});
});

test.describe('Custom Image - Single Mode 9mm Tape Restriction', () => {
	test('should not show image uploader for 9mm tape', async ({ page }) => {
		const singlePage = new SingleModePage(page);
		await singlePage.goto();

		// Select 9mm tape
		await singlePage.selectLabelSize('9mm');

		// Switch to general mode
		await singlePage.selectMode('general');

		// Image uploader should NOT be visible for 9mm tape
		const imageUploader = singlePage.getImageUploader();
		expect(await imageUploader.isVisible()).toBe(false);
	});

	test('should show image uploader when switching from 9mm to 12mm', async ({ page }) => {
		const singlePage = new SingleModePage(page);
		await singlePage.goto();

		// Start with 9mm
		await singlePage.selectLabelSize('9mm');

		// Switch to general mode
		await singlePage.selectMode('general');

		// No uploader for 9mm
		const imageUploader = singlePage.getImageUploader();
		expect(await imageUploader.isVisible()).toBe(false);

		// Switch to 12mm
		await singlePage.selectLabelSize('12mm');

		// Uploader should now be visible
		await imageUploader.expectDropzoneVisible();
	});
});
