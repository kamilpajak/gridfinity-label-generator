import { type Page, type Locator } from '@playwright/test';

/** Test id of the thread-size select trigger */
export const THREAD_SIZE_SELECT_TESTID = 'thread-size-select';
/** Test id of the pitch select trigger */
export const PITCH_SELECT_TESTID = 'pitch-select';

/**
 * Component for thread size, pitch, and length selection
 * Used in fastener mode for specifying hardware dimensions
 */
export class ThreadSizeSelector {
	private page: Page;

	readonly threadSizeButton: Locator;
	readonly pitchSelect: Locator;
	readonly lengthInput: Locator;

	/**
	 * Callback to wait for label render after selection
	 */
	private onSelectionComplete?: () => Promise<void>;

	constructor(page: Page, onSelectionComplete?: () => Promise<void>) {
		this.page = page;
		this.onSelectionComplete = onSelectionComplete;

		// Initialize locators
		this.threadSizeButton = page.getByTestId(THREAD_SIZE_SELECT_TESTID);
		this.pitchSelect = page.getByTestId(PITCH_SELECT_TESTID);
		this.lengthInput = page.getByTestId('length-input');
	}

	// ============================================
	// Thread Size Methods
	// ============================================

	/**
	 * Select a thread size from the dropdown
	 * @param size - The size to select (e.g., "M6", "M8")
	 */
	async selectThreadSize(size: string): Promise<void> {
		await this.threadSizeButton.click();
		await this.page.getByRole('option', { name: size }).click();
	}

	/**
	 * Open the thread size dropdown without selecting
	 */
	async openDropdown(): Promise<void> {
		await this.threadSizeButton.click();
		await this.page.getByRole('option').first().waitFor({ state: 'visible' });
	}

	/**
	 * Get all available thread sizes from the dropdown
	 */
	async getAvailableSizes(): Promise<string[]> {
		const options = this.page.getByRole('option');
		const count = await options.count();
		const sizes: string[] = [];
		for (let i = 0; i < count; i++) {
			const text = await options.nth(i).textContent();
			if (text) sizes.push(text.trim());
		}
		return sizes;
	}

	/**
	 * Check if a specific thread size is available
	 * @param size - The size to check for
	 */
	async hasSize(size: string): Promise<boolean> {
		const option = this.page.getByRole('option', { name: size, exact: true });
		return (await option.count()) > 0;
	}

	/**
	 * Get the option locator for a specific size
	 * @param size - The size to get the option for
	 */
	getOption(size: string): Locator {
		return this.page.getByRole('option', { name: size, exact: true });
	}

	/**
	 * Get the currently selected thread size text
	 */
	async getSelectedSize(): Promise<string> {
		return (await this.threadSizeButton.textContent()) || '';
	}

	// ============================================
	// Pitch Methods
	// ============================================

	/**
	 * Select a pitch from the dropdown
	 * @param pitch - The pitch to select
	 */
	async selectPitch(pitch: string): Promise<void> {
		await this.pitchSelect.click();
		await this.page.getByRole('option', { name: pitch }).click();

		if (this.onSelectionComplete) {
			await this.onSelectionComplete();
		}
	}

	/**
	 * Get the current pitch value
	 */
	async getPitchValue(): Promise<string> {
		return (await this.pitchSelect.textContent()) || '';
	}

	/**
	 * Check if the pitch field is enabled
	 */
	async isPitchEnabled(): Promise<boolean> {
		return await this.pitchSelect.isEnabled();
	}

	// ============================================
	// Length Methods
	// ============================================

	/**
	 * Fill the length input
	 * @param length - The length value to enter
	 */
	async fillLength(length: string): Promise<void> {
		await this.lengthInput.fill(length);
	}

	/**
	 * Get the current length value
	 */
	async getLengthValue(): Promise<string> {
		return await this.lengthInput.inputValue();
	}

	/**
	 * Check if the length field is enabled
	 */
	async isLengthEnabled(): Promise<boolean> {
		return await this.lengthInput.isEnabled();
	}

	/**
	 * Get the length input placeholder text
	 */
	async getLengthPlaceholder(): Promise<string | null> {
		return await this.lengthInput.getAttribute('placeholder');
	}

	// ============================================
	// Combined Methods
	// ============================================

	/**
	 * Set complete thread specification
	 * @param size - Thread size (e.g., "M6")
	 * @param pitch - Optional pitch value
	 * @param length - Optional length value
	 */
	async setSpecification(size: string, pitch?: string, length?: string): Promise<void> {
		await this.selectThreadSize(size);

		if (pitch && (await this.isPitchEnabled())) {
			await this.selectPitch(pitch);
		}

		if (length && (await this.isLengthEnabled())) {
			await this.fillLength(length);
		}
	}
}
