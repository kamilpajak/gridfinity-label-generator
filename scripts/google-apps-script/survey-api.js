/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * GridScribe Survey API - Google Apps Script (v2 - Config-based)
 *
 * This script aggregates Google Form responses using external Config sheet
 * for column mapping. Future-proof against survey question changes.
 *
 * SETUP:
 * 1. Link your Google Form to a Google Sheet
 * 2. Create a "Config" tab with columns: logicalName, headerText, type
 * 3. Open the Sheet → Extensions → Apps Script
 * 4. Paste this code, update SHEET_ID, and save
 * 5. Deploy → New deployment → Web app (Anyone, Execute as Me)
 *
 * CONFIG TYPES:
 * - rating: Numeric 1-5 scale → average + distribution
 * - text: Free text → raw responses for AI analysis
 * - multiChoice: Checkboxes → count per option
 * - yesNo: Yes/No answers → counts + percentage
 * - labelSize: "WxH" format → popular sizes + stats
 * - skip: Ignore this column
 */

// ============================================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================================

const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // Get from Sheet URL
const RESPONSES_SHEET_NAME = 'Responses'; // Your responses tab name
const CONFIG_SHEET_NAME = 'Config';

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Main entry point for GET requests (Web App)
 */
function doGet() {
	try {
		const data = aggregateSurveyData();
		return ContentService.createTextOutput(JSON.stringify(data, null, 2)).setMimeType(
			ContentService.MimeType.JSON
		);
	} catch (error) {
		return ContentService.createTextOutput(
			JSON.stringify({
				error: error.message,
				stack: error.stack,
				timestamp: new Date().toISOString()
			})
		).setMimeType(ContentService.MimeType.JSON);
	}
}

// ============================================================
// CONFIG & MAPPING
// ============================================================

/**
 * Loads column configuration from Config sheet
 * @returns {Object} Map of logicalName → { header, type }
 */
function loadColumnConfig() {
	const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
	const configSheet = spreadsheet.getSheetByName(CONFIG_SHEET_NAME);

	if (!configSheet) {
		throw new Error(`Config sheet "${CONFIG_SHEET_NAME}" not found`);
	}

	const data = configSheet.getDataRange().getValues();
	const config = {};

	// Skip header row (index 0)
	for (let i = 1; i < data.length; i++) {
		const [logicalName, headerText, type] = data[i];
		if (logicalName && headerText) {
			config[logicalName.trim()] = {
				header: headerText.trim(),
				type: (type || 'text').trim().toLowerCase()
			};
		}
	}

	return config;
}

/**
 * Builds column index mapping by matching headers
 * @param {Object} config - Config from loadColumnConfig()
 * @param {Array} headers - Header row from responses sheet
 * @returns {Object} Map of logicalName → columnIndex
 */
function buildColumnMapping(config, headers) {
	const mapping = {};
	const warnings = [];

	// Normalize headers for comparison
	const normalizedHeaders = headers.map((h) => String(h).trim().toLowerCase());

	for (const [logicalName, { header }] of Object.entries(config)) {
		const normalizedHeader = header.toLowerCase();

		// Find matching column (partial match for flexibility)
		let foundIndex = -1;

		// First try exact match
		foundIndex = normalizedHeaders.findIndex((h) => h === normalizedHeader);

		// If not found, try "starts with" match
		if (foundIndex === -1) {
			foundIndex = normalizedHeaders.findIndex(
				(h) => h.startsWith(normalizedHeader) || normalizedHeader.startsWith(h)
			);
		}

		if (foundIndex !== -1) {
			mapping[logicalName] = foundIndex;
		} else {
			warnings.push(`Header not found for "${logicalName}": "${header}"`);
		}
	}

	if (warnings.length > 0) {
		console.log('Column mapping warnings:', warnings);
	}

	return mapping;
}

// ============================================================
// DATA AGGREGATION
// ============================================================

/**
 * Main aggregation function
 */
function aggregateSurveyData() {
	const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
	const responsesSheet = spreadsheet.getSheetByName(RESPONSES_SHEET_NAME);

	if (!responsesSheet) {
		throw new Error(`Responses sheet "${RESPONSES_SHEET_NAME}" not found`);
	}

	const allData = responsesSheet.getDataRange().getValues();
	const headers = allData[0];
	const responses = allData.slice(1).filter((row) => row[0]); // Filter empty rows

	if (responses.length === 0) {
		return {
			totalResponses: 0,
			timestamp: new Date().toISOString(),
			message: 'No responses yet'
		};
	}

	// Load config and build mapping
	const config = loadColumnConfig();
	const mapping = buildColumnMapping(config, headers);

	// Build result object
	const result = {
		totalResponses: responses.length,
		timestamp: new Date().toISOString(),
		lastResponseDate: getLastResponseDate(responses)
	};

	// Aggregate each configured field
	for (const [logicalName, columnIndex] of Object.entries(mapping)) {
		const fieldConfig = config[logicalName];
		const type = fieldConfig.type;

		result[logicalName] = aggregateByType(responses, columnIndex, type);
	}

	return result;
}

/**
 * Aggregates data based on field type
 */
function aggregateByType(responses, columnIndex, type) {
	switch (type) {
		case 'rating':
			return aggregateRatings(responses, columnIndex);
		case 'multichoice':
			return aggregateMultipleChoice(responses, columnIndex);
		case 'yesno':
			return aggregateYesNo(responses, columnIndex);
		case 'labelsize':
			return aggregateLabelSizes(responses, columnIndex);
		case 'text':
			return extractTextResponses(responses, columnIndex);
		case 'skip':
			return null;
		default:
			return extractTextResponses(responses, columnIndex);
	}
}

/**
 * Gets the date of the most recent response
 */
function getLastResponseDate(responses) {
	if (responses.length === 0) return null;
	const lastRow = responses[responses.length - 1];
	const timestamp = lastRow[0];
	return timestamp instanceof Date ? timestamp.toISOString() : String(timestamp);
}

/**
 * Aggregates numeric ratings (1-5 scale)
 */
function aggregateRatings(responses, columnIndex) {
	const ratings = responses
		.map((row) => parseInt(row[columnIndex]))
		.filter((r) => r >= 1 && r <= 5);

	if (ratings.length === 0) {
		return { average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, count: 0 };
	}

	const sum = ratings.reduce((a, b) => a + b, 0);
	const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
	ratings.forEach((r) => distribution[r]++);

	return {
		average: Math.round((sum / ratings.length) * 10) / 10,
		distribution: distribution,
		count: ratings.length
	};
}

/**
 * Aggregates multiple choice / checkbox responses
 */
function aggregateMultipleChoice(responses, columnIndex) {
	const counts = {};

	responses.forEach((row) => {
		const value = String(row[columnIndex] || '').trim();
		if (!value) return;

		// Handle checkbox responses - smart split respecting parentheses
		const choices = smartSplitChoices(value);
		choices.forEach((choice) => {
			if (choice) {
				counts[choice] = (counts[choice] || 0) + 1;
			}
		});
	});

	// Sort by count descending
	return Object.entries(counts)
		.sort((a, b) => b[1] - a[1])
		.reduce((obj, [key, val]) => {
			obj[key] = val;
			return obj;
		}, {});
}

/**
 * Splits checkbox choices while respecting parentheses
 * "Images, Text (sizes, descriptions), QR codes" → ["Images", "Text (sizes, descriptions)", "QR codes"]
 */
function smartSplitChoices(value) {
	const choices = [];
	let current = '';
	let parenDepth = 0;

	for (let i = 0; i < value.length; i++) {
		const char = value[i];

		if (char === '(') {
			parenDepth++;
			current += char;
		} else if (char === ')') {
			parenDepth--;
			current += char;
		} else if (char === ',' && parenDepth === 0) {
			const trimmed = current.trim();
			if (trimmed) choices.push(trimmed);
			current = '';
		} else {
			current += char;
		}
	}

	// Don't forget the last item
	const trimmed = current.trim();
	if (trimmed) choices.push(trimmed);

	return choices;
}

/**
 * Aggregates Yes/No responses
 */
function aggregateYesNo(responses, columnIndex) {
	let yes = 0;
	let no = 0;
	let other = 0;

	responses.forEach((row) => {
		const value = String(row[columnIndex] || '')
			.trim()
			.toLowerCase();
		if (!value) return;

		if (value.includes('yes') || value.includes('tak') || value === 'y') {
			yes++;
		} else if (value.includes('no') || value.includes('nie') || value === 'n') {
			no++;
		} else {
			other++;
		}
	});

	const total = yes + no;
	return {
		yes: yes,
		no: no,
		other: other,
		yesPercentage: total > 0 ? Math.round((yes / total) * 100) : 0
	};
}

/**
 * Aggregates label sizes into common categories
 */
function aggregateLabelSizes(responses, columnIndex) {
	const sizes = {};
	const widths = [];
	const heights = [];

	responses.forEach((row) => {
		const value = String(row[columnIndex] || '').trim();
		if (!value) return;

		// Try to parse various formats: "WxH", "W x H", "W*H", "HxW mm", etc.
		const match = value.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i);
		if (match) {
			const num1 = parseFloat(match[1]);
			const num2 = parseFloat(match[2]);

			// Assume larger number is width, smaller is height (common convention)
			const width = Math.max(num1, num2);
			const height = Math.min(num1, num2);
			const sizeKey = `${width}x${height}`;

			sizes[sizeKey] = (sizes[sizeKey] || 0) + 1;
			widths.push(width);
			heights.push(height);
		}
	});

	// Sort by count
	const sortedSizes = Object.entries(sizes)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.reduce((obj, [key, val]) => {
			obj[key] = val;
			return obj;
		}, {});

	return {
		popular: sortedSizes,
		totalParsed: widths.length,
		stats:
			widths.length > 0
				? {
						avgWidth: Math.round((widths.reduce((a, b) => a + b, 0) / widths.length) * 10) / 10,
						avgHeight: Math.round((heights.reduce((a, b) => a + b, 0) / heights.length) * 10) / 10,
						minWidth: Math.min(...widths),
						maxWidth: Math.max(...widths),
						minHeight: Math.min(...heights),
						maxHeight: Math.max(...heights)
					}
				: null
	};
}

/**
 * Extracts raw text responses for AI analysis
 */
function extractTextResponses(responses, columnIndex) {
	const textResponses = responses
		.map((row) => String(row[columnIndex] || '').trim())
		.filter((text) => text.length > 0);

	return {
		responses: textResponses,
		totalResponses: textResponses.length
	};
}

// ============================================================
// TEST FUNCTIONS
// ============================================================

/**
 * Test function - run this to verify config loading
 */
function testConfig() {
	const config = loadColumnConfig();
	console.log('Loaded config:', JSON.stringify(config, null, 2));
}

/**
 * Test function - run this to verify column mapping
 */
function testMapping() {
	const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
	const responsesSheet = spreadsheet.getSheetByName(RESPONSES_SHEET_NAME);
	const headers = responsesSheet.getRange(1, 1, 1, responsesSheet.getLastColumn()).getValues()[0];

	console.log('Headers found:', headers);

	const config = loadColumnConfig();
	const mapping = buildColumnMapping(config, headers);
	console.log('Column mapping:', JSON.stringify(mapping, null, 2));
}

/**
 * Test function - run this to verify full aggregation
 */
function testAggregation() {
	const result = aggregateSurveyData();
	console.log(JSON.stringify(result, null, 2));
}
