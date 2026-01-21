/**
 * Search Aliases for Standards Search
 *
 * Provides fuzzy matching capabilities by:
 * 1. Using synonym groups for bi-directional alias matching
 * 2. Tokenizing queries while preserving multi-word phrases
 * 3. Typo tolerance via Levenshtein distance (fallback)
 *
 * This allows users to search "hex nut" and find "Hexagon nut",
 * or search "torx" and find "Hexalobular" standards.
 * Symmetric: searching "hexagon" will also find "hex" matches.
 * Typo tolerant: "philips" will match "phillips".
 */

import levenshtein from 'js-levenshtein';

/**
 * Synonym groups: each array contains terms that are mutually interchangeable.
 * Any term in a group will match any other term in the same group.
 *
 * Example: searching "hex" will match "hexagon", and searching "hexagon" will match "hex"
 */
export const SYNONYM_GROUPS: string[][] = [
	// Head shapes
	['hex', 'hexagon', 'hexagonal'],
	['flat', 'countersunk', 'flat head'],
	['pan', 'pan head'],
	['button', 'button head'],
	['fillister', 'cheese', 'cylinder head', 'cylindrical', 'raised cylinder'],
	['carriage', 'carriage bolt', 'round head square neck'],

	// Drive types
	['torx', 'hexalobular', 'six-lobe', 'six lobe'],
	['allen', 'socket', 'hex socket'],
	['phillips', 'cross', 'cross-recessed', 'cross recessed'],
	['slotted', 'slot drive', 'slot'],

	// Screw types
	['grub', 'set screw', 'headless'],
	['cap', 'socket head cap', 'cap screw', 'socket head'],
	// Note: 'set screw' appears in multiple groups intentionally.
	// Cup point and dog point are TYPES of set screws, not synonyms of each other.
	['cup point', 'set screw', 'cup'],
	['dog point', 'set screw', 'dog']
];

/**
 * Find the synonym group containing a given term
 * @param term - The term to search for
 * @returns The synonym group containing the term, or undefined if not found
 */
export function findSynonymGroup(term: string): string[] | undefined {
	const normalized = term.toLowerCase();
	return SYNONYM_GROUPS.find((group) => group.some((t) => t.toLowerCase() === normalized));
}

/**
 * Get multi-word keys from synonym groups, sorted by length descending
 * (to match longest phrases first)
 */
const multiWordKeys = SYNONYM_GROUPS.flat()
	.filter((key) => key.includes(' '))
	.sort((a, b) => b.length - a.length);

/**
 * Expand a single token to include all its synonyms
 * @param token - A single word or phrase from the search query
 * @returns Array containing all synonyms from the group, or just the original token
 */
export function expandToken(token: string): string[] {
	const normalized = token.toLowerCase();

	// Find the synonym group containing this token
	const group = SYNONYM_GROUPS.find((g) => g.some((t) => t.toLowerCase() === normalized));

	if (group) {
		return group.map((t) => t.toLowerCase());
	}

	return [normalized];
}

/**
 * Calculate the maximum allowed Levenshtein distance for typo tolerance
 * Shorter words need stricter matching to avoid false positives
 *
 * @param tokenLength - Length of the search token
 * @returns Maximum allowed distance (0, 1, or 2)
 */
function getMaxTypoDistance(tokenLength: number): number {
	if (tokenLength <= 2) return 0; // No typos allowed for very short tokens
	if (tokenLength <= 4) return 1; // 1 typo for short words
	return 2; // 2 typos for longer words
}

/**
 * Try to find a synonym group by fuzzy matching the token against all known synonym terms
 * Used as a fallback when exact synonym lookup fails
 *
 * @param token - A single word to fuzzy match (not a phrase)
 * @returns The synonym group if a fuzzy match is found, undefined otherwise
 */
function findSynonymGroupByTypo(token: string): string[] | undefined {
	const maxDistance = getMaxTypoDistance(token.length);
	if (maxDistance === 0) return undefined;

	for (const group of SYNONYM_GROUPS) {
		for (const term of group) {
			// Only fuzzy match against single-word synonyms
			if (!term.includes(' ') && levenshtein(token, term.toLowerCase()) <= maxDistance) {
				return group;
			}
		}
	}

	return undefined;
}

/**
 * Tokenize a search query into individual words, preserving multi-word aliases
 * @param query - The full search query
 * @returns Array of lowercase tokens
 */
export function tokenizeQuery(query: string): string[] {
	let processedQuery = query.toLowerCase().trim();
	const tokens: string[] = [];

	// First, extract any multi-word aliases from the query string
	for (const key of multiWordKeys) {
		const keyLower = key.toLowerCase();
		if (processedQuery.includes(keyLower)) {
			tokens.push(keyLower);
			// Remove ALL occurrences of the matched key to avoid re-processing its words
			processedQuery = processedQuery.replaceAll(keyLower, ' ');
		}
	}

	// Then, process the remaining single-word tokens
	const remainingTokens = processedQuery.split(/\s+/).filter((token) => token.length > 0);

	tokens.push(...remainingTokens);
	return tokens;
}

/**
 * Check if a word/phrase appears in text at word boundaries
 * - "cap" should NOT match "capstan" (substring of another word)
 * - "set screw" SHOULD match "set screws" (allow plural 's')
 *
 * @param phrase - The word/phrase to search for
 * @param text - The text to search in
 * @returns True if the phrase appears as whole words (with optional plural 's')
 */
function matchWholeWord(phrase: string, text: string): boolean {
	// Split phrase into individual words
	const words = phrase.split(/\s+/);

	// Each word must appear at a word boundary in the text
	return words.every((word) => {
		// Escape special regex characters
		const escaped = word.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
		// Match word boundary at start, allow optional 's' for plurals, then word boundary
		const regex = new RegExp(String.raw`\b${escaped}s?\b`, 'i');
		return regex.test(text);
	});
}

/**
 * Check if a token is a prefix of any word in the text
 * Used for autocomplete-style matching on the last token of a query
 *
 * @param token - The token to match as a prefix
 * @param text - The text to search in
 * @returns True if the token is a prefix of any word in the text
 */
function matchWordPrefix(token: string, text: string): boolean {
	// Escape special regex characters
	const escaped = token.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
	// Match word boundary at start, then our token as prefix of a word
	const regex = new RegExp(String.raw`\b${escaped}`, 'i');
	return regex.test(text);
}

/**
 * Check if a token matches any word in the text with typo tolerance
 * Uses Levenshtein distance with dynamic threshold based on word length
 *
 * @param token - The token to match (should be a single word, not a phrase)
 * @param text - The text to search in
 * @returns True if the token is within acceptable distance of any word in the text
 */
function matchWithTypoTolerance(token: string, text: string): boolean {
	const maxDistance = getMaxTypoDistance(token.length);
	if (maxDistance === 0) return false; // No typo tolerance for very short tokens

	const words = text.split(/\s+/);

	return words.some((word) => {
		const distance = levenshtein(token, word);
		return distance <= maxDistance;
	});
}

/**
 * Check if a query matches a description using fuzzy matching
 *
 * Rules:
 * 1. Query is split into tokens (preserving multi-word phrases)
 * 2. Each token is expanded with all synonyms from its group
 * 3. ALL tokens must match somewhere in the description
 * 4. Non-last tokens must match as WHOLE WORDS
 * 5. Last token can match as a PREFIX only in multi-token queries (autocomplete behavior)
 * 6. If no synonym match, try typo tolerance as fallback (single words only)
 *
 * @param query - The search query (e.g., "hex nut")
 * @param description - The standard description (e.g., "Hexagon nut")
 * @returns True if all query tokens match the description
 */
export function fuzzyMatchDescription(query: string, description: string): boolean {
	const tokens = tokenizeQuery(query);
	const normalizedDescription = description.toLowerCase();

	// Every token (or one of its synonyms) must be found in the description
	return tokens.every((token, index) => {
		const expansions = expandToken(token);
		const isLastToken = index === tokens.length - 1;
		// Only allow prefix matching for multi-token queries (autocomplete behavior)
		// Single-token queries require whole word match to avoid false positives
		const allowPrefixMatch = isLastToken && tokens.length > 1;

		// Step 1: Try exact/synonym match (preferred)
		let matched = false;

		if (allowPrefixMatch) {
			// Last token in multi-token query: allow prefix matching
			matched = expansions.some(
				(expansion) =>
					matchWholeWord(expansion, normalizedDescription) ||
					matchWordPrefix(expansion, normalizedDescription)
			);
		} else {
			// Single token or non-last tokens: require whole word match
			matched = expansions.some((expansion) => matchWholeWord(expansion, normalizedDescription));
		}

		// Step 2: If no match and token is a single word, try typo tolerance as fallback
		if (!matched && !token.includes(' ')) {
			// First, try to fuzzy match against synonym terms
			// e.g., "grb" → "grub" → expands to ["grub", "set screw", "headless"]
			const fuzzyGroup = findSynonymGroupByTypo(token);
			if (fuzzyGroup) {
				const fuzzyExpansions = fuzzyGroup.map((t) => t.toLowerCase());
				matched = fuzzyExpansions.some((expansion) =>
					matchWholeWord(expansion, normalizedDescription)
				);
			}

			// If still no match, try direct typo tolerance against description words
			if (!matched) {
				matched = matchWithTypoTolerance(token, normalizedDescription);
			}
		}

		return matched;
	});
}
