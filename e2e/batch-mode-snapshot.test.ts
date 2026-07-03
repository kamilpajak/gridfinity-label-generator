import { expect, test } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { SingleModePage } from './pages/single-mode/SingleModePage';

/**
 * Tests for the new batch snapshot model: the sidebar form is shared with single
 * mode; clicking "Add Current Label" snapshots the current config into a
 * read-only, drag-reorderable list.
 */
test.describe('Batch Mode - Snapshot Model', () => {
	test('empty state shows when no labels', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		await expect(batchPage.emptyState).toBeVisible();
		// With no labels the batch panel renders no export button (the single-mode
		// tab keeps its own hidden export button mounted, so assert not-visible).
		await expect(batchPage.exportSection.exportButton).not.toBeVisible();
	});

	test('Add Current Label appends a read-only row matching the form', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		const form = new SingleModePage(page);

		// First label: fastener with ISO 4762 standard, M8, length 20
		await form.selectMode('fastener');
		await form.selectHardwareByName('ISO', /ISO 4762/);
		await form.selectThreadSize('M8');
		await form.fillLength('20');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		expect(await batchPage.getRowCount()).toBe(1);
		expect(await batchPage.getChipPrimaryText(0)).toContain('M8');

		// Second label: change size to M6, add
		await form.selectThreadSize('M6');
		await batchPage.addLabel();
		await batchPage.waitForLabel(1);

		expect(await batchPage.getRowCount()).toBe(2);
		expect(await batchPage.getChipPrimaryText(0)).toContain('M8');
		expect(await batchPage.getChipPrimaryText(1)).toContain('M6');
	});

	test('remove deletes the correct row', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		const form = new SingleModePage(page);
		await form.selectMode('fastener');
		await form.selectHardwareByName('ISO', /ISO 4762/);
		await form.selectThreadSize('M8');
		await form.fillLength('20');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		await form.selectThreadSize('M6');
		await batchPage.addLabel();
		await batchPage.waitForLabel(1);

		expect(await batchPage.getRowCount()).toBe(2);

		// Remove the first row (M8); the M6 row should remain
		await batchPage.removeLabel(0);

		expect(await batchPage.getRowCount()).toBe(1);
		expect(await batchPage.getChipPrimaryText(0)).toContain('M6');
	});

	test('keyboard drag reorders rows', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		const form = new SingleModePage(page);
		await form.selectMode('general');
		await form.fillPrimaryText('AAA');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);
		await form.fillPrimaryText('BBB');
		await batchPage.addLabel();
		await batchPage.waitForLabel(1);

		expect(await batchPage.getChipPrimaryText(0)).toContain('AAA');
		expect(await batchPage.getChipPrimaryText(1)).toContain('BBB');

		// Move the first row down using svelte-dnd-action keyboard dragging
		await batchPage.reorderByKeyboard(0, 'down');

		expect(await batchPage.getChipPrimaryText(0)).toContain('BBB');
		expect(await batchPage.getChipPrimaryText(1)).toContain('AAA');
	});

	test('list stays in sync after keyboard reorder (regression: no freeze on later remove)', async ({
		page
	}) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		const form = new SingleModePage(page);
		await form.selectMode('general');
		await form.fillPrimaryText('AAA');
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);
		await form.fillPrimaryText('BBB');
		await batchPage.addLabel();
		await batchPage.waitForLabel(1);
		await form.fillPrimaryText('CCC');
		await batchPage.addLabel();
		await batchPage.waitForLabel(2);

		// Reorder the first row down: AAA, BBB, CCC -> BBB, AAA, CCC
		await batchPage.reorderByKeyboard(0, 'down');
		expect(await batchPage.getChipPrimaryText(0)).toContain('BBB');

		// Regression: a keyboard reorder used to leave svelte-dnd-action's dragging
		// flag stuck, freezing the list so this remove never re-rendered. The remove
		// must drop the first visible row (BBB) and the DOM must match the store now.
		await batchPage.removeLabel(0);
		expect(await batchPage.getRowCount()).toBe(2);
		expect(await batchPage.getChipPrimaryText(0)).toContain('AAA');
		expect(await batchPage.getChipPrimaryText(1)).toContain('CCC');
	});

	test('Add Current Label disabled at max (20)', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		const form = new SingleModePage(page);
		await form.selectMode('general');

		for (let i = 0; i < 20; i++) {
			await form.fillPrimaryText(`Item ${i}`);
			await batchPage.addLabel();
			await batchPage.waitForLabel(i);
		}

		expect(await batchPage.getRowCount()).toBe(20);
		await expect(batchPage.addLabelButton).toBeDisabled();
		expect(await batchPage.getProgress()).toContain('20 / 20 labels');
	});
});
