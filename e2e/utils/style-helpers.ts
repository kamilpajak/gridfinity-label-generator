import { type Page } from '@playwright/test';

/**
 * Style-inspection helpers for e2e tests.
 *
 * These keep raw `page.evaluate` DOM/style reads out of test files. They operate
 * on a `data-testid` value and inspect the corresponding element's computed style
 * or descendant classes.
 */

/**
 * Whether the element identified by `testId` contains a descendant carrying the
 * `text-muted-foreground` class (used by empty select placeholders).
 * Returns false when the element is not present.
 */
export async function hasMutedForegroundClass(page: Page, testId: string): Promise<boolean> {
	return page.evaluate((id) => {
		const element = document.querySelector(`[data-testid="${id}"]`);
		if (!element) return false;
		return element.querySelector('.text-muted-foreground') !== null;
	}, testId);
}

/**
 * Computed `background-color` of the element identified by `testId`.
 * Returns null when the element is not present.
 */
export async function getComputedBackground(page: Page, testId: string): Promise<string | null> {
	return page.evaluate((id) => {
		const element = document.querySelector(`[data-testid="${id}"]`);
		if (!element) return null;
		return window.getComputedStyle(element).backgroundColor;
	}, testId);
}
