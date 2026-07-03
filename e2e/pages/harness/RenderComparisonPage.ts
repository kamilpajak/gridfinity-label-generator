import { type Page } from '@playwright/test';

/** Pixel data snapshot exposed by the render-comparison harness page. */
export interface CanvasData {
	width: number;
	height: number;
	data: number[];
}

/**
 * Page object for the `/e2e/render-comparison` test harness, which renders the
 * same label through the single-mode and batch-mode pipelines so tests can
 * compare their pixel output.
 */
export class RenderComparisonPage {
	private page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async goto(): Promise<void> {
		await this.page.goto('/e2e/render-comparison');
	}

	/**
	 * Wait until both canvases have rendered (status text === "Rendered successfully").
	 */
	async waitForRendered(timeout: number = 10000): Promise<void> {
		await this.page.waitForFunction(
			() => {
				const statusEl = document.querySelector('[data-testid="status"]');
				return statusEl?.textContent === 'Rendered successfully';
			},
			{ timeout }
		);
	}

	async getSingleCanvasData(): Promise<CanvasData> {
		return this.page.evaluate(() => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (window as any).getSingleCanvasData() as CanvasData;
		});
	}

	async getBatchCanvasData(): Promise<CanvasData> {
		return this.page.evaluate(() => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (window as any).getBatchCanvasData() as CanvasData;
		});
	}
}
