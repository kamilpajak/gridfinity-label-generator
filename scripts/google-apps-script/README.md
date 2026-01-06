# Google Apps Script - Survey API (v2)

Future-proof API that aggregates Google Form survey responses using external Config sheet for column mapping.

## Features

- **Config-based column mapping** - Change questions without modifying code
- **Multiple aggregation types** - ratings, text themes, yes/no, label sizes
- **Partial header matching** - Flexible matching even if headers change slightly
- **Anonymized data** - Returns aggregated statistics, not individual responses

## Quick Setup

### 1. Prepare Google Sheet

Your Sheet should have:

- **Tab 1**: Form responses (auto-created when linking form)
- **Tab 2**: `Config` (create manually - see below)

### 2. Create Config Tab

Create a new tab named `Config` with this structure:

| logicalName        | headerText                                                             | type        |
| ------------------ | ---------------------------------------------------------------------- | ----------- |
| rating             | How would you rate the intuitiveness of the website's interface?       | rating      |
| designSuggestions  | What changes would you suggest to improve the website's design?        | text        |
| labelElements      | What elements do you use on your labels?                               | multiChoice |
| labelSizes         | What label sizes (height and width) do you usually work with?          | labelSize   |
| sizeProblems       | Do you experience any problems generating labels of specific sizes?    | yesNo       |
| featureRequests    | What additional features would you like to see in the label generator? | text        |
| biggestAdvantage   | What do you consider the biggest advantage of the website?             | text        |
| needsImprovement   | What area needs the most improvement?                                  | text        |
| additionalComments | Any additional comments or suggestions:                                | text        |

### 3. Get Sheet ID

From your Sheet URL:

```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
```

### 4. Create Apps Script

1. In Google Sheet: **Extensions** → **Apps Script**
2. Delete default code
3. Paste contents of `survey-api.js`
4. Update these constants at the top:
   ```javascript
   const SHEET_ID = 'your-sheet-id-here';
   const RESPONSES_SHEET_NAME = 'Form Responses 1'; // or your tab name
   const CONFIG_SHEET_NAME = 'Config';
   ```
5. Save (Ctrl+S)

### 5. Test

1. Select `testConfig` from dropdown → Run → Check logs
2. Select `testMapping` → Run → Verify column mapping
3. Select `testAggregation` → Run → See full JSON output

### 6. Deploy

1. **Deploy** → **New deployment**
2. **Type**: Web app
3. **Execute as**: Me
4. **Who has access**: Anyone
5. Click **Deploy** → Copy URL

## Config Types

| Type          | Description              | Output                                 |
| ------------- | ------------------------ | -------------------------------------- |
| `rating`      | 1-5 numeric scale        | `{ average, distribution, count }`     |
| `text`        | Free text responses      | `{ responses: [...], totalResponses }` |
| `multiChoice` | Checkbox/multiple select | `{ option: count, ... }`               |
| `yesNo`       | Yes/No answers           | `{ yes, no, other, yesPercentage }`    |
| `labelSize`   | "WxH" dimensions         | `{ popular: {...}, stats: {...} }`     |
| `skip`        | Ignore column            | `null`                                 |

## API Response Example

```json
{
	"totalResponses": 45,
	"timestamp": "2024-01-06T12:00:00.000Z",
	"lastResponseDate": "2024-01-05T15:30:00.000Z",
	"rating": {
		"average": 4.6,
		"distribution": { "1": 0, "2": 1, "3": 2, "4": 12, "5": 30 },
		"count": 45
	},
	"labelElements": {
		"Images, Text (sizes, descriptions)": 38,
		"Images, Text (sizes, descriptions), QR codes": 5,
		"Text (sizes, descriptions)": 2
	},
	"labelSizes": {
		"popular": { "55x12": 8, "37x12": 6, "35x12": 5 },
		"totalParsed": 40,
		"stats": {
			"avgWidth": 38.5,
			"avgHeight": 13.2,
			"minWidth": 9,
			"maxWidth": 100
		}
	},
	"sizeProblems": {
		"yes": 8,
		"no": 32,
		"other": 5,
		"yesPercentage": 20
	},
	"featureRequests": {
		"responses": [
			"Batch mode to generate full page of labels",
			"Support for threaded inserts",
			"API to generate multiple labels from spreadsheet"
		],
		"totalResponses": 35
	}
}
```

## Using in SvelteKit

```typescript
const SURVEY_API_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';

interface SurveyStats {
	totalResponses: number;
	rating: { average: number; distribution: Record<string, number> };
	// ... etc
}

async function fetchSurveyStats(): Promise<SurveyStats> {
	const response = await fetch(SURVEY_API_URL);
	if (!response.ok) throw new Error('Failed to fetch survey stats');
	return response.json();
}
```

## Updating Questions

When you change a survey question:

1. **Only text changed?** → Update `headerText` in Config sheet. Done!
2. **New question added?** → Add new row to Config sheet
3. **Question removed?** → Delete row from Config sheet (or set type to `skip`)
4. **New aggregation type needed?** → Update script code

## Troubleshooting

### "Config sheet not found"

- Check `CONFIG_SHEET_NAME` matches your tab name exactly

### "Responses sheet not found"

- Check `RESPONSES_SHEET_NAME` matches your form responses tab name

### "Header not found for X"

- Check the `headerText` in Config matches the column header in responses
- Headers are matched case-insensitively with partial matching

### Permission errors

- Make sure you approved permissions when first running
- Re-deploy if you changed the code

## Files

- `survey-api.js` - Main script (copy to Apps Script)
- `README.md` - This documentation
- `PLAN.md` - Architecture and implementation plan
