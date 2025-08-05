import { type Page } from '@playwright/test';
import { BasePage } from '../base/BasePage';
import { NavigationTabs } from '../components/NavigationTabs';
import { ExportSection } from '../components/ExportSection';

/**
 * Page object for Batch Mode (future implementation)
 * Will handle bulk label creation from CSV/data entry
 */
export class BatchLabelPage extends BasePage {
	// Components
	readonly navigation: NavigationTabs;
	readonly exportSection: ExportSection;

	constructor(page: Page) {
		super(page);

		// Initialize shared components
		this.navigation = new NavigationTabs(page);
		this.exportSection = new ExportSection(page);

		// TODO: Initialize batch-specific components when implemented
		// - CSV upload
		// - Label list/grid
		// - Batch preview (long PNG)
		// - Bulk operations
	}

	// TODO: Implement batch-specific methods
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async uploadCSV(filePath: string) {
		// Implementation pending
		throw new Error('Batch mode not yet implemented');
	}

	async getLabelsCount(): Promise<number> {
		// Implementation pending
		return 0;
	}
}
