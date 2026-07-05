import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';
import { NavigationTabs } from '../components/NavigationTabs';
import { ExportSection } from '../components/ExportSection';
import { LabelSizeToggle } from '../components/LabelSizeToggle';
import type { LabelSize } from '../../types/page-objects';

/** localStorage key under which batch state (including encoded images) is persisted */
export const BATCH_STORAGE_KEY = 'gridscribe_batch_v1';

/**
 * Page object for Batch Mode.
 *
 * In the new batch model the sidebar form is IDENTICAL to single mode. You
 * configure a label with the shared form (reuse SingleModePage form methods on
 * an already-loaded batch page) and click "Add Current Label" to snapshot it
 * into a read-only, drag-reorderable list. Rows are not editable.
 */
export class BatchModePage extends BasePage {
	// Composed Components
	readonly navigation: NavigationTabs;
	readonly exportSection: ExportSection;
	readonly tapeHeightToggle: LabelSizeToggle;

	// Label management
	readonly addLabelButton: Locator;
	readonly progressText: Locator;

	// Main-area locators
	readonly emptyState: Locator;
	readonly draftPreview: Locator;
	readonly labelList: Locator;

	// Legacy locators (kept for backward compatibility)
	readonly tapeHeight9mm: Locator;
	readonly tapeHeight12mm: Locator;

	constructor(page: Page) {
		super(page);

		// Initialize composed components
		this.navigation = new NavigationTabs(page);
		this.exportSection = new ExportSection(page);
		this.tapeHeightToggle = new LabelSizeToggle(page, 'tape-height');

		// Initialize locators
		this.addLabelButton = page.getByTestId('add-label-button');
		this.progressText = page.getByTestId('batch-progress-text');

		// Main-area locators
		this.emptyState = page.getByTestId('batch-empty-state');
		this.draftPreview = page.getByTestId('batch-draft-preview');
		this.labelList = page.getByTestId('batch-label-list');

		// Legacy locators (delegated to component)
		this.tapeHeight9mm = this.tapeHeightToggle.button9mm;
		this.tapeHeight12mm = this.tapeHeightToggle.button12mm;
	}

	// Override goto to ensure page is fully ready
	async goto() {
		await this.page.goto('/');
		await this.page.waitForLoadState('domcontentloaded');
		// networkidle is load-bearing here: it lets Svelte hydration finish before
		// tests interact (SSR renders controls before their handlers attach).
		await this.page.waitForLoadState('networkidle');
		// Switch to batch mode
		await this.navigation.switchToBatchMode();
		// Wait for critical elements to be visible and ready
		await this.addLabelButton.waitFor({ state: 'visible' });
	}

	/**
	 * Reload the page and wait for the app shell to be interactive again.
	 * Callers typically switch back to batch mode afterwards.
	 */
	async reload() {
		await this.page.reload();
		// networkidle lets hydration finish before the caller re-interacts.
		await this.page.waitForLoadState('networkidle');
	}

	/**
	 * Raw persisted batch state string from localStorage (or null if absent).
	 */
	async getPersistedState(): Promise<string | null> {
		return this.page.evaluate((key) => localStorage.getItem(key), BATCH_STORAGE_KEY);
	}

	/**
	 * Wait until the persisted batch state includes an encoded image data URL.
	 * Persistence is debounced (~500ms) plus image encoding time.
	 */
	async waitForImagePersisted(timeout: number = 5000): Promise<void> {
		await expect
			.poll(async () => (await this.getPersistedState())?.includes('data:image/') ?? false, {
				timeout
			})
			.toBe(true);
	}

	// ============================================
	// Tape Height Methods (delegated to component)
	// ============================================

	async selectTapeHeight(height: LabelSize) {
		await this.tapeHeightToggle.select(height);
	}

	async isTapeHeightSelected(height: LabelSize): Promise<boolean> {
		return this.tapeHeightToggle.isSelected(height);
	}

	async getSelectedTapeHeight(): Promise<LabelSize | null> {
		return this.tapeHeightToggle.getSelected();
	}

	// ============================================
	// Label Management Methods
	// ============================================

	/**
	 * Snapshot the current shared-form configuration into the batch list.
	 */
	async addLabel() {
		await this.addLabelButton.waitFor({ state: 'visible' });

		// Wait for the button to become enabled. After filling the shared form,
		// isFormValid updates on the next reactive tick, so an immediate
		// isDisabled() check races with it and can misfire as "max reached".
		try {
			await expect(this.addLabelButton).toBeEnabled({ timeout: 5000 });
		} catch {
			throw new Error('Cannot add label: button stayed disabled (max reached or form invalid)');
		}

		await this.addLabelButton.click();
		await this.waitForUiUpdate();
	}

	async canAddLabel(): Promise<boolean> {
		return !(await this.addLabelButton.isDisabled());
	}

	async getProgress(): Promise<string> {
		return (await this.progressText.textContent()) ?? '';
	}

	async getLabelCount(): Promise<number> {
		const text = await this.getProgress();
		const match = text.match(/(\d+) \/ \d+ labels/);
		return match ? parseInt(match[1], 10) : 0;
	}

	async getMaxLabels(): Promise<number> {
		const text = await this.getProgress();
		const match = text.match(/\d+ \/ (\d+) labels/);
		return match ? parseInt(match[1], 10) : 0;
	}

	// ============================================
	// Label Row Methods
	// ============================================

	getLabelRow(index: number): Locator {
		return this.page.getByTestId(`batch-label-row-${index}`);
	}

	/**
	 * The canvas the batch row chip renders into. Chips render through the same
	 * canvas pipeline as the export, so images are drawn onto this canvas rather
	 * than as a separate <img> element.
	 */
	getRowCanvas(index: number): Locator {
		return this.getLabelRow(index).locator('canvas');
	}

	/**
	 * Whether the row chip canvas contains a colored (non-grayscale) pixel.
	 * Label text is black-on-white (grayscale), so a colored pixel means a custom
	 * image was drawn onto the chip. Used to assert a persisted image re-renders.
	 */
	async rowChipHasColoredPixel(index: number): Promise<boolean> {
		const canvas = this.getRowCanvas(index);
		await canvas.waitFor({ state: 'visible' });
		return canvas.evaluate((el) => {
			const cv = el as HTMLCanvasElement;
			const ctx = cv.getContext('2d');
			if (!ctx || cv.width === 0 || cv.height === 0) return false;
			const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
			for (let i = 0; i < data.length; i += 4) {
				const r = data[i];
				const g = data[i + 1];
				const b = data[i + 2];
				// Colored = meaningful spread between channels (not gray/black/white).
				if (Math.max(r, g, b) - Math.min(r, g, b) > 40) return true;
			}
			return false;
		});
	}

	async waitForLabel(index: number, timeout: number = 5000) {
		await this.getLabelRow(index).waitFor({ state: 'visible', timeout });
	}

	/**
	 * Count of rendered read-only label rows.
	 */
	async getRowCount(): Promise<number> {
		return this.page.locator('[data-testid^="batch-label-row-"]').count();
	}

	async removeLabel(index: number) {
		const removeButton = this.page.getByTestId(`remove-label-button-${index}`);
		await removeButton.click();
		await this.waitForUiUpdate();
	}

	// ============================================
	// Chip Methods
	// ============================================

	getChipPrimary(index: number): Locator {
		return this.page.getByTestId(`batch-chip-primary-${index}`);
	}

	async getChipPrimaryText(index: number): Promise<string> {
		return (await this.getChipPrimary(index).textContent())?.trim() ?? '';
	}

	// ============================================
	// Reorder (keyboard drag via svelte-dnd-action)
	// ============================================

	/**
	 * Reorder a row using svelte-dnd-action keyboard dragging.
	 * Focus the row, press Space to enter drag mode, arrow to move, Space to drop.
	 */
	async reorderByKeyboard(index: number, direction: 'up' | 'down') {
		const row = this.getLabelRow(index);
		await row.focus();
		await this.page.keyboard.press('Space');
		await this.page.keyboard.press(direction === 'up' ? 'ArrowUp' : 'ArrowDown');
		await this.page.keyboard.press('Space');
		await this.waitForUiUpdate();
	}

	/**
	 * Reorder a row using a real POINTER drag (svelte-dnd-action mouse path).
	 *
	 * Deterministic without sleeps: svelte-dnd-action decides the hovered target
	 * index on a recurring ~193ms observer timer (flipDurationMs 180), NOT on
	 * pointermove, so a synthetic down->move->up that finishes inside one timer gap
	 * is a no-op. We hold the pointer down and poll the live DOM until the in-flight
	 * shadow row shows the dragged text at the target index, release only then, and
	 * retry the whole gesture if the reorder did not commit.
	 */
	async reorderByMouse(from: number, to: number) {
		// The chip text that must end up at the target index. A failed pointer drag
		// leaves the order unchanged, so this stays valid across retry attempts.
		const draggedText = await this.inZoneChipText(from);

		const MAX_ATTEMPTS = 3;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			if (await this.attemptMouseDrag(from, to, draggedText)) {
				await this.waitForUiUpdate();
				return;
			}
		}
		throw new Error(
			`reorderByMouse: drag from ${from} to ${to} did not take effect after ${MAX_ATTEMPTS} attempts`
		);
	}

	/**
	 * One pointer-drag attempt. Returns true only if the reorder actually committed
	 * (the dragged chip text is at the target index after drop).
	 */
	private async attemptMouseDrag(from: number, to: number, draggedText: string): Promise<boolean> {
		// Recompute boxes fresh each attempt: a prior failed drag or a flip animation
		// can shift rows, and a stale box aims the clone at the wrong slot.
		const src = await this.getLabelRow(from).boundingBox();
		const dst = await this.getLabelRow(to).boundingBox();
		if (!src || !dst) throw new Error('reorderByMouse: source or target row not visible');

		const sx = src.x + src.width / 2;
		const sy = src.y + src.height / 2;
		const dx = dst.x + dst.width / 2;
		const dy = dst.y + dst.height / 2;
		const dir = to > from ? 1 : -1;
		// Overshoot past the target center so the clone clearly covers the target slot
		// (detection uses the clone center) and the >10px observer tolerance is exceeded.
		const overshoot = Math.max(8, dst.height * 0.4) * dir;

		const clone = this.page.locator('#dnd-action-dragged-el');

		await this.page.mouse.move(sx, sy);
		await this.page.mouse.down();
		// Cross the 3px drag-start threshold, then confirm the drag was recognized
		// (clone appended, shadow inserted) BEFORE travelling.
		await this.page.mouse.move(sx, sy + 6 * dir);
		try {
			await expect(clone).toHaveCount(1, { timeout: 2000 });
		} catch {
			await this.page.mouse.up();
			await expect(clone).toHaveCount(0);
			return false;
		}

		// Travel the clone center to the target row, then overshoot past its center.
		await this.page.mouse.move(dx, dy, { steps: 20 });
		await this.page.mouse.move(dx, dy + overshoot, { steps: 6 });

		// Hold and wait (condition-based) for an observer tick to splice the shadow to
		// the target index. Nudge inside the poll so each iteration re-crosses the
		// tolerance and keeps the ~193ms timer re-evaluating until it lands on target.
		let toggle = 0;
		let reachedTarget = false;
		try {
			await expect
				.poll(
					async () => {
						toggle ^= 1;
						await this.page.mouse.move(dx, dy + overshoot + toggle * 12 * dir, { steps: 2 });
						return this.inZoneChipText(to);
					},
					{ timeout: 4000, intervals: [100, 150, 200, 250, 300] }
				)
				.toContain(draggedText);
			reachedTarget = true;
		} catch {
			reachedTarget = false;
		}

		if (!reachedTarget) {
			// Release so the library restores the original order for the next attempt.
			await this.page.mouse.up();
			await expect(clone).toHaveCount(0);
			return false;
		}

		await this.page.mouse.up();
		// handleDrop runs a ~180ms drop animation before finalize/cleanup removes the
		// clone; waiting for the clone to disappear bridges that delay, so the store
		// reorder has committed by the time this returns.
		await expect(clone).toHaveCount(0);

		// Confirm the reorder actually stuck in the settled DOM.
		return (await this.inZoneChipText(to)).includes(draggedText);
	}

	/**
	 * Chip primary text at a row index, scoped to the drop-zone container.
	 * Scoping matters DURING a drag: svelte-dnd-action deep-clones the dragged row
	 * (duplicating its data-testid) onto document.body, outside `labelList`. An
	 * unscoped getByTestId would match two nodes and trip Playwright strict mode.
	 */
	private async inZoneChipText(index: number): Promise<string> {
		return (
			(await this.labelList.getByTestId(`batch-chip-primary-${index}`).textContent())?.trim() ?? ''
		);
	}
}
