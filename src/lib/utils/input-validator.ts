export interface ValidationResult {
	isValid: boolean;
	message?: string;
}

/**
 * Validates thread size input for fasteners
 * Accepts:
 * - Metric: M3, M4, M5, M6, M8, M10, M12, M16, M20, M1.4, M1.6, M2.5
 * - Imperial gauge: #4, #6, #8, #10
 * - Imperial fractional: 1/4, 3/8, 1/2, 5/8, 3/4, etc.
 * - Imperial whole: 1, 2, etc.
 * Rejects mixed numbers (e.g., 1 1/4) as those are for length
 */
export function validateThreadSize(input: string | null | undefined): ValidationResult {
	const trimmed = (input || '').trim();

	if (!trimmed) {
		return { isValid: false, message: 'Thread size is required' };
	}

	// Metric thread pattern: M followed by number, optionally with decimal
	// No 'x' pitch notation allowed (e.g., M8x1.25 not allowed)
	const metricPattern = /^[mM]\d+(\.\d+)?$/;

	// Imperial gauge pattern: # followed by number
	const gaugePattern = /^#\d+$/;

	// Imperial fractional pattern: simple fraction only
	// Whole numbers like "1" or "2" are only valid with inch marks for thread sizes
	const imperialFractionPattern = /^\d+\/\d+$/;
	// Imperial whole number pattern: must have inch mark
	const imperialWholePattern = /^\d+[″"]$/;

	if (
		metricPattern.test(trimmed) ||
		gaugePattern.test(trimmed) ||
		imperialFractionPattern.test(trimmed) ||
		imperialWholePattern.test(trimmed)
	) {
		return { isValid: true };
	}

	return { isValid: false, message: 'Invalid thread size format' };
}

/**
 * Validates length input for fasteners
 * Accepts:
 * - Metric: whole numbers and decimals (10, 25, 10.5, 100.25)
 * - Imperial fractions: 1/4, 3/8, 1/2, etc.
 * - Imperial mixed numbers: 1 1/4, 2 3/4, etc.
 * - Imperial decimals: 0.25, 1.5, 2.75
 * Does NOT accept units (mm, in, ")
 */
export function validateLength(
	input: string | null | undefined,
	measurementSystem: 'metric' | 'imperial' = 'metric'
): ValidationResult {
	const trimmed = (input || '').trim();

	if (!trimmed) {
		return { isValid: false, message: 'Length is required' };
	}

	// Check for units - we don't want them
	if (/mm|in|″|"/i.test(trimmed)) {
		return { isValid: false, message: 'Invalid length format (do not include units)' };
	}

	// Metric/decimal pattern: whole or decimal number
	const decimalPattern = /^\d+(\.\d+)?$/;

	// Imperial fraction pattern: simple fraction
	const fractionPattern = /^\d+\/\d+$/;

	// Imperial mixed number pattern: whole number + space + fraction
	const mixedPattern = /^\d+\s+\d+\/\d+$/;

	// Invalid patterns to check
	const invalidPatterns = [
		/^\.$/, // just a dot
		/^\d+\.$/, // number ending with dot
		/^\.\d+$/, // starting with dot
		/\/$/, // ending with slash
		/^\//, // starting with slash
		/\/\//, // double slash
		/\s+\/$/, // space then slash
		/\/\s+/ // slash then space
	];

	// Check for invalid patterns first
	for (const pattern of invalidPatterns) {
		if (pattern.test(trimmed)) {
			return { isValid: false, message: 'Invalid length format' };
		}
	}

	// Measurement system-specific validation
	if (measurementSystem === 'metric') {
		// Metric only accepts decimal numbers
		if (decimalPattern.test(trimmed)) {
			return { isValid: true };
		}
		// Reject fractions in metric mode
		if (fractionPattern.test(trimmed) || mixedPattern.test(trimmed)) {
			return { isValid: false, message: 'Use decimal format for metric (e.g., 10, 25.5)' };
		}
	} else if (
		decimalPattern.test(trimmed) ||
		fractionPattern.test(trimmed) ||
		mixedPattern.test(trimmed)
	) {
		// Imperial accepts all formats: decimals, fractions, and mixed numbers
		return { isValid: true };
	}

	return { isValid: false, message: 'Invalid length format' };
}

/**
 * Validates URL input for QR codes
 * Only accepts http:// and https:// URLs
 */
export function validateQRCodeUrl(input: string | null | undefined): ValidationResult {
	const trimmed = (input || '').trim();

	if (!trimmed) {
		return { isValid: false, message: 'URL is required' };
	}

	// Check if it starts with http:// or https://
	if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
		return { isValid: false, message: 'URL must start with http:// or https://' };
	}

	// Try to parse as URL
	try {
		const url = new URL(trimmed);
		// Additional validation: must have a host
		if (!url.host || url.host === '.' || url.host === '') {
			return { isValid: false, message: 'Invalid URL format' };
		}
		// For localhost, allow it
		if (url.hostname === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)) {
			return { isValid: true };
		}
		// For other hosts, must have at least a TLD
		if (!url.hostname.includes('.') && url.hostname !== 'localhost') {
			return { isValid: false, message: 'Invalid URL format' };
		}
		return { isValid: true };
	} catch {
		return { isValid: false, message: 'Invalid URL format' };
	}
}

/**
 * Validates general text input
 * Checks for length constraints
 */
export function validateText(
	input: string | null | undefined,
	minLength: number,
	maxLength: number
): ValidationResult {
	const trimmed = (input || '').trim();
	const length = trimmed.length;

	if (length === 0 && minLength > 0) {
		return { isValid: false, message: 'Text is required' };
	}

	if (length > maxLength) {
		return {
			isValid: false,
			message: `Text must be between ${minLength} and ${maxLength} characters`
		};
	}

	if (length < minLength && length > 0) {
		return {
			isValid: false,
			message: `Text must be between ${minLength} and ${maxLength} characters`
		};
	}

	return { isValid: true };
}
