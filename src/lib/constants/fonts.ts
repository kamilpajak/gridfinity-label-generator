/**
 * Font Configuration Constants
 *
 * Centralized font definitions used throughout the application.
 * Change these values to update fonts globally.
 */

export interface FontConfig {
	family: string;
	weight: string;
}

/**
 * Primary font used for main label text (e.g., "M3", "M5")
 * Heavy weight for bold, readable text
 */
export const PRIMARY_FONT: FontConfig = {
	family: 'Noto Sans',
	weight: '900'
};

/**
 * Secondary font used for standard/reference text (e.g., "DIN 931")
 * Light weight for contrast with primary text
 */
export const SECONDARY_FONT: FontConfig = {
	family: 'Oswald',
	weight: '300'
};
