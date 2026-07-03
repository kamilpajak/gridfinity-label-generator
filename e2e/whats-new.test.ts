import { expect, test } from '@playwright/test';
import { WhatsNewModal } from './pages/components/WhatsNewModal';

test.describe("What's New Modal", () => {
	let whatsNew: WhatsNewModal;

	test.beforeEach(async ({ page }) => {
		whatsNew = new WhatsNewModal(page);
		await whatsNew.goto();
	});

	test("should display What's New button in header", async () => {
		await expect(whatsNew.button).toBeVisible();
	});

	test('should open modal when clicking button', async () => {
		await whatsNew.open();
		await expect(whatsNew.modal).toBeVisible();
	});

	test('should close modal via X button', async () => {
		await whatsNew.open();
		await whatsNew.close();
		await expect(whatsNew.modal).not.toBeVisible();
	});

	test('should close modal via footer button', async () => {
		await whatsNew.open();
		await whatsNew.closeViaFooter();
		await expect(whatsNew.modal).not.toBeVisible();
	});

	test('should close modal via ESC key', async () => {
		await whatsNew.open();
		await whatsNew.closeViaEscape();
		await expect(whatsNew.modal).not.toBeVisible();
	});

	test('should close modal via backdrop click', async () => {
		await whatsNew.open();
		await whatsNew.closeViaBackdrop();
		await expect(whatsNew.modal).not.toBeVisible();
	});

	test('should display changelog entries', async () => {
		await whatsNew.open();
		const entryCount = await whatsNew.getEntryCount();
		expect(entryCount).toBeGreaterThan(0);
	});

	test('should show version numbers for entries', async () => {
		await whatsNew.open();
		const versions = await whatsNew.getEntryVersions();
		expect(versions.length).toBeGreaterThan(0);
		expect(versions[0]).toMatch(/Version \d+\.\d+\.\d+/);
	});

	test('should have category tags', async () => {
		await whatsNew.open();
		const tagCount = await whatsNew.getCategoryTagCount();
		expect(tagCount).toBeGreaterThan(0);
	});
});
