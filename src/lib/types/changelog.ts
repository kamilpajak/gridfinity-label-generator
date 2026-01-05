export type ChangeCategory = 'added' | 'changed' | 'fixed' | 'removed' | 'improved';

export interface ChangelogEntry {
	version: string;
	date: string; // ISO date: "2024-01-05"
	changes: {
		category: ChangeCategory;
		items: string[];
	}[];
}
