import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Component for Label Settings section
 * Handles both mobile (collapsible) and desktop (Card) variants
 */
export class LabelSettingsComponent {
	readonly page: Page;

	// Mobile-specific elements
	readonly mobileCollapsibleButton: Locator;
	readonly mobileChevronIcon: Locator;

	// Settings controls (shared between mobile and desktop)
	readonly standardReferenceSwitch: Locator;
	readonly hardwareImageSwitch: Locator;
	readonly qrCodeSwitch: Locator;
	readonly labelHeightToggle: Locator;
	readonly labelHeight9mm: Locator;
	readonly labelHeight12mm: Locator;

	constructor(page: Page) {
		this.page = page;

		// Mobile collapsible button (only visible on mobile via lg:hidden)
		this.mobileCollapsibleButton = page.getByRole('button', { name: /Label Settings/i });
		this.mobileChevronIcon = this.mobileCollapsibleButton.locator('svg');

		// Settings controls - use last() to prefer desktop visible elements on desktop viewport
		this.standardReferenceSwitch = page.getByTestId('standard-reference-switch');
		this.hardwareImageSwitch = page.getByTestId('hardware-image-switch');
		this.qrCodeSwitch = page.getByTestId('qr-code-switch');
		this.labelHeightToggle = page.getByTestId('label-height-toggle');
		this.labelHeight9mm = this.labelHeightToggle.getByRole('radio', { name: '9mm' });
		this.labelHeight12mm = this.labelHeightToggle.getByRole('radio', { name: '12mm' });
	}

	/**
	 * Check if mobile collapsible button is visible
	 * Only visible on mobile viewport (< lg breakpoint)
	 */
	async isMobileView(): Promise<boolean> {
		return await this.mobileCollapsibleButton.isVisible();
	}

	/**
	 * Check if settings are expanded on mobile
	 */
	async isExpandedOnMobile(): Promise<boolean> {
		if (!(await this.isMobileView())) {
			throw new Error('Not in mobile view');
		}
		// Check if any settings control is visible
		return await this.standardReferenceSwitch.first().isVisible();
	}

	/**
	 * Expand settings on mobile (no-op if already expanded or on desktop)
	 */
	async expandOnMobile(): Promise<void> {
		if (!(await this.isMobileView())) {
			return; // Desktop - always visible
		}
		if (await this.isExpandedOnMobile()) {
			return; // Already expanded
		}
		await this.mobileCollapsibleButton.scrollIntoViewIfNeeded();
		await this.mobileCollapsibleButton.click();
		await expect(this.standardReferenceSwitch.first()).toBeVisible({ timeout: 5000 });
	}

	/**
	 * Collapse settings on mobile (no-op if already collapsed or on desktop)
	 */
	async collapseOnMobile(): Promise<void> {
		if (!(await this.isMobileView())) {
			return; // Desktop - always visible
		}
		if (!(await this.isExpandedOnMobile())) {
			return; // Already collapsed
		}
		await this.mobileCollapsibleButton.click();
		await expect(this.standardReferenceSwitch.first()).not.toBeVisible({ timeout: 5000 });
	}

	/**
	 * Get the visible label height toggle (handles mobile/desktop DOM duplication)
	 */
	getVisibleHeightToggle(): Locator {
		return this.labelHeightToggle.last();
	}

	/**
	 * Get the visible standard reference switch
	 */
	getVisibleStandardSwitch(): Locator {
		return this.standardReferenceSwitch.last();
	}

	/**
	 * Get the visible hardware image switch
	 */
	getVisibleHardwareSwitch(): Locator {
		return this.hardwareImageSwitch.last();
	}

	/**
	 * Get the visible QR code switch
	 */
	getVisibleQRSwitch(): Locator {
		return this.qrCodeSwitch.last();
	}

	/**
	 * Check if 12mm height is selected
	 */
	async isHeight12mmSelected(): Promise<boolean> {
		const toggle = this.getVisibleHeightToggle();
		const button12mm = toggle.getByRole('radio', { name: '12mm' });
		const state = await button12mm.getAttribute('data-state');
		return state === 'on';
	}

	/**
	 * Check if 9mm height is selected
	 */
	async isHeight9mmSelected(): Promise<boolean> {
		const toggle = this.getVisibleHeightToggle();
		const button9mm = toggle.getByRole('radio', { name: '9mm' });
		const state = await button9mm.getAttribute('data-state');
		return state === 'on';
	}

	/**
	 * Select 9mm height
	 */
	async selectHeight9mm(): Promise<void> {
		const toggle = this.getVisibleHeightToggle();
		await toggle.scrollIntoViewIfNeeded();
		const button9mm = toggle.getByRole('radio', { name: '9mm' });
		await button9mm.click();
		await expect(button9mm).toHaveAttribute('data-state', 'on');
	}

	/**
	 * Select 12mm height
	 */
	async selectHeight12mm(): Promise<void> {
		const toggle = this.getVisibleHeightToggle();
		await toggle.scrollIntoViewIfNeeded();
		const button12mm = toggle.getByRole('radio', { name: '12mm' });
		await button12mm.click();
		await expect(button12mm).toHaveAttribute('data-state', 'on');
	}
}
