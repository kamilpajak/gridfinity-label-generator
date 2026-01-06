/**
 * Imperial fraction parsing utilities
 *
 * Handles conversion between fraction strings (1/4, 3/8, 1-1/2)
 * and decimal numbers for imperial fastener lengths.
 */

/**
 * Parse imperial fractions to decimal numbers
 * Supports formats: "1/4", "3/8", "1/2", "5/16", "1-1/2" (mixed), "1 1/2" (mixed with space)
 *
 * @param value - String value to parse (can be fraction, mixed fraction, or number)
 * @returns Decimal number or undefined if invalid
 *
 * @example
 * parseFraction("1/4")    // 0.25
 * parseFraction("3/8")    // 0.375
 * parseFraction("1-1/2")  // 1.5
 * parseFraction("10")     // 10
 * parseFraction("0.25")   // 0.25
 */
export function parseFraction(value: string): number | undefined {
	if (!value || value.trim() === '') return undefined;

	const trimmed = value.trim();

	// Try parsing as a regular number first (handles "10", "0.25", etc.)
	// But only if it doesn't contain a slash (to avoid parseFloat("1/4") → 1)
	if (!trimmed.includes('/')) {
		const asNumber = Number.parseFloat(trimmed);
		if (!Number.isNaN(asNumber)) {
			return asNumber;
		}
	}

	// Handle mixed fractions like "1-1/2" or "1 1/2"
	const mixedRegex = /^(\d+)[-\s](\d+)\/(\d+)$/;
	const mixedMatch = mixedRegex.exec(trimmed);
	if (mixedMatch) {
		const whole = Number.parseInt(mixedMatch[1], 10);
		const numerator = Number.parseInt(mixedMatch[2], 10);
		const denominator = Number.parseInt(mixedMatch[3], 10);
		if (denominator !== 0) {
			return whole + numerator / denominator;
		}
	}

	// Handle simple fractions like "1/4", "3/8"
	const fractionRegex = /^(\d+)\/(\d+)$/;
	const fractionMatch = fractionRegex.exec(trimmed);
	if (fractionMatch) {
		const numerator = Number.parseInt(fractionMatch[1], 10);
		const denominator = Number.parseInt(fractionMatch[2], 10);
		if (denominator !== 0) {
			return numerator / denominator;
		}
	}

	return undefined;
}

/**
 * Convert decimal back to fraction string for display
 * Uses common imperial denominators: 16, 8, 4, 2
 *
 * @param decimal - Decimal number to convert
 * @returns Fraction string (e.g., "1/4", "3/8") or decimal string if no exact match
 *
 * @example
 * decimalToFraction(0.25)   // "1/4"
 * decimalToFraction(0.375)  // "3/8"
 * decimalToFraction(1.5)    // "1-1/2"
 * decimalToFraction(2)      // "2"
 */
export function decimalToFraction(decimal: number): string {
	// Handle whole numbers
	if (Number.isInteger(decimal)) {
		return decimal.toString();
	}

	// Handle mixed numbers (e.g., 1.5 → "1-1/2")
	const wholePart = Math.floor(decimal);
	const fractionalPart = decimal - wholePart;

	// Common denominators for imperial sizes (in order of preference)
	const denominators = [16, 8, 4, 2];

	const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

	for (const denom of denominators) {
		const numerator = Math.round(fractionalPart * denom);
		if (Math.abs(numerator / denom - fractionalPart) < 0.001) {
			// Simplify fraction
			const divisor = gcd(numerator, denom);
			const simplifiedNum = numerator / divisor;
			const simplifiedDenom = denom / divisor;

			if (simplifiedDenom === 1) {
				// Fractional part is a whole number (shouldn't happen, but handle it)
				return (wholePart + simplifiedNum).toString();
			}

			if (wholePart === 0) {
				return `${simplifiedNum}/${simplifiedDenom}`;
			}
			return `${wholePart}-${simplifiedNum}/${simplifiedDenom}`;
		}
	}

	// Fallback to decimal string
	return decimal.toString();
}
