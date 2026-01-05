# What's New Section - Implementation Plan

## Overview

Add a "What's New" section to display recent updates, features, and bug fixes to users.
Based on mockup: `Do tak wygladajacej aplikacji.html`

## UI Elements

### 1. Header Button

```
+---------------------------+
| [*] What's New            |  <- Sparkles icon + pulsing dot
+---------------------------+
```

- Sparkles icon with text
- Pulsing notification dot (when new unread updates)
- Click scrolls to card or opens modal

### 2. What's New Card (Right Sidebar)

```
+----------------------------------------+
| [icon] What's New           [v2.4.0]   |  <- Header
+----------------------------------------+
|                                        |
| * Batch Processing Beta      Today     |  <- Timeline item
|   Description text here...             |
|   [Feature] [Beta]                     |  <- Category tags
|                                        |
| * Custom Image Upload     3 days ago   |
|   Description text here...             |
|   [Feature]                            |
|                                        |
| * Performance Improvements 1 week ago  |
|   ...                                  |
|                                        |
|   [Loading more...]                    |  <- Infinite scroll
+----------------------------------------+
```

- No footer - infinite scroll loads more entries automatically

### 3. Design Specifications

**Colors:**
| Category | Background | Text |
|-------------|---------------|---------------|
| Feature | emerald-100 | emerald-700 |
| Beta | purple-100 | purple-700 |
| Improvement | amber-100 | amber-700 |
| Bug Fix | red-100 | red-700 |

**Timeline Dots (by recency):**

- Newest: indigo-500
- Recent: blue-400
- Older: amber-400
- Oldest: slate-300

---

## Data Sources

### Version Number

- **Source**: `package.json` (canonical, already maintained)
- **Access**: Import at build time via SvelteKit server load

### Changelog Entries

- **Source**: `CHANGELOG.md` (standard open-source practice)
- **Format**: Keep a Changelog (https://keepachangelog.com)
- **Access**: Parse at build time in `+layout.server.ts`

### Why this approach?

- **Single source of truth** - no duplication
- **Static/build-time** - no runtime network dependency
- **Standard practice** - `CHANGELOG.md` benefits GitHub visitors too
- **Simple workflow** - edit CHANGELOG.md + bump package.json version

---

## CHANGELOG.md Format

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [2.4.0] - 2024-01-05

### Added

- Custom image upload for General Item labels (PNG, JPG, SVG support)
- Image compression with binary search for optimal quality

### Fixed

- QR codes now scan correctly on all printer models

## [2.3.0] - 2024-12-20

### Added

- Batch mode for generating multiple labels

### Improved

- Label preview now updates in real-time
```

---

## Data Structure (parsed)

```typescript
// src/lib/types/changelog.ts

export type ChangeCategory = 'added' | 'changed' | 'fixed' | 'removed' | 'improved';

export interface ChangelogEntry {
	version: string;
	date: string; // ISO date: "2024-01-05"
	changes: {
		category: ChangeCategory;
		items: string[];
	}[];
}
```

---

## Component Structure

```
src/lib/components/whats-new/
├── whats-new-card.svelte       # Main sidebar card
├── whats-new-item.svelte       # Individual timeline item
├── whats-new-button.svelte     # Header button with pulse
└── category-tag.svelte         # Colored category badge
```

---

## Implementation Phases

```
Phase 1: Data Layer
    |
    v
Phase 2: Components ----+----+----+----+
    |                   |    |    |    |
    v                   v    v    v    v
  Card              Item   Tag  Button  ...
    |
    v
Phase 3: Integration
    |
    v
Phase 4: Polish
```

### Phase 1: Data Layer

1. **Create `CHANGELOG.md`** (project root)
   - Follow "Keep a Changelog" format
   - Add entries for recent features (custom images, batch mode, etc.)

2. **Create `src/lib/types/changelog.ts`**
   - TypeScript interfaces for parsed changelog

3. **Create `src/lib/utils/changelog-parser.ts`**
   - Parse CHANGELOG.md into structured data
   - Helper: `getRelativeDate(date: string): string`
     - Returns "Today", "Yesterday", "3 days ago", etc.

4. **Modify `src/routes/+layout.server.ts`**
   - Read and parse CHANGELOG.md at build time
   - Read version from package.json
   - Pass data to all pages via `data.changelog` and `data.appVersion`

### Phase 2: Components

5. **Create `category-tag.svelte`**
   - Props: `category: ChangeCategory` (added, fixed, improved, changed, removed)
   - Renders colored badge based on category
   - Uses Tailwind classes for colors

6. **Create `whats-new-item.svelte`**
   - Props: `entry: ChangelogEntry`, `index: number`
   - Timeline dot color based on index (newer = more vibrant)
   - Layout: dot | version + date + changes grouped by category

7. **Create `whats-new-card.svelte`**
   - Header: bullhorn icon + "What's New" + version badge
   - Scrollable content area (max-h-[380px])
   - Maps changelog entries to whats-new-item components
   - **Infinite scroll**: load more entries when scrolling near bottom
   - Calls `markAsSeen()` on mount

8. **Create `whats-new-button.svelte`**
   - Sparkles icon + "What's New" text
   - Pulsing dot when `hasUnseenUpdates` is true
   - Click handler: scroll to card / open modal

### Phase 3: Integration

9. **Modify `src/routes/+page.svelte`**
   - Import WhatsNewCard
   - **Single mode**: Add to right sidebar, below Label Settings
   - Card visible only in Single mode (Batch mode has different layout)

10. **Add header button**
    - Determine location in current header layout
    - Connect to WhatsNewCard visibility (scroll to card)

### Phase 4: Polish

11. **localStorage tracking**
    - Key: `whatsNewLastSeen`
    - Value: ISO date of last viewed
    - Compare with newest entry to determine pulse state

12. **Smooth scroll**
    - `scrollIntoView({ behavior: 'smooth' })`

13. **Responsive behavior**
    - Mobile: Consider modal/drawer instead of sidebar card
    - Test at various breakpoints

---

## Changelog Parser Implementation

```typescript
// src/lib/utils/changelog-parser.ts

import type { ChangelogEntry, ChangeCategory } from '$lib/types/changelog';

const CATEGORY_MAP: Record<string, ChangeCategory> = {
	added: 'added',
	changed: 'changed',
	fixed: 'fixed',
	removed: 'removed',
	improved: 'improved',
	deprecated: 'changed',
	security: 'fixed'
};

export function parseChangelog(content: string): ChangelogEntry[] {
	const entries: ChangelogEntry[] = [];

	// Match version headers: ## [1.2.3] - 2024-01-05
	// Also supports prerelease (1.0.0-beta.1) and build metadata (1.0.0+build.123)
	const versionRegex = /^## \[(\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?)\] - (\d{4}-\d{2}-\d{2})$/gm;
	const sections = content.split(versionRegex).slice(1); // Skip content before first version

	for (let i = 0; i < sections.length; i += 3) {
		const version = sections[i];
		const date = sections[i + 1];
		const body = sections[i + 2] || '';

		const changes = parseVersionBody(body);

		if (version && date) {
			entries.push({ version, date, changes });
		}
	}

	return entries;
}

function parseVersionBody(body: string): ChangelogEntry['changes'] {
	const changes: ChangelogEntry['changes'] = [];

	// Match category headers: ### Added, ### Fixed, etc.
	const categoryRegex = /^### (\w+)$/gm;
	const parts = body.split(categoryRegex).slice(1);

	for (let i = 0; i < parts.length; i += 2) {
		const categoryName = parts[i]?.toLowerCase();
		const items =
			parts[i + 1]
				?.split('\n')
				.filter((line) => line.trim().startsWith('-'))
				.map((line) => line.replace(/^-\s*/, '').trim())
				.filter(Boolean) || [];

		const category = CATEGORY_MAP[categoryName];
		if (category && items.length > 0) {
			changes.push({ category, items });
		}
	}

	return changes;
}

export function getRelativeDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Yesterday';
	if (diffDays < 7) return `${diffDays} days ago`;
	if (diffDays < 14) return '1 week ago';
	if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
	if (diffDays < 60) return '1 month ago';
	return `${Math.floor(diffDays / 30)} months ago`;
}
```

---

## Layout Server Load

```typescript
// src/routes/+layout.server.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseChangelog } from '$lib/utils/changelog-parser';

export async function load() {
	// Read package.json for version
	const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));

	// Read and parse CHANGELOG.md
	let changelog = [];
	try {
		const changelogContent = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf-8');
		changelog = parseChangelog(changelogContent);
	} catch (e) {
		console.warn('CHANGELOG.md not found');
	}

	return {
		appVersion: packageJson.version,
		changelog
	};
}
```

---

## State Management

```typescript
// In whats-new-button.svelte or store

const STORAGE_KEY = 'whatsNewLastSeen';

function getLastSeenDate(): string | null {
	return localStorage.getItem(STORAGE_KEY);
}

function markAsSeen(): void {
	localStorage.setItem(STORAGE_KEY, new Date().toISOString());
}

function hasUnseenUpdates(entries: ChangelogEntry[]): boolean {
	const lastSeen = getLastSeenDate();
	if (!lastSeen || entries.length === 0) return entries.length > 0;

	// Compare date strings only (YYYY-MM-DD format)
	// lastSeen is ISO timestamp, extract date part for fair comparison
	const newestEntryDate = entries[0].date; // "2024-01-05"
	const lastSeenDate = lastSeen.split('T')[0]; // "2024-01-05T12:00:00Z" -> "2024-01-05"
	return newestEntryDate > lastSeenDate;
}
```

---

## Infinite Scroll Implementation

```typescript
// In whats-new-card.svelte

const ITEMS_PER_PAGE = 5;

let visibleCount = $state(ITEMS_PER_PAGE);
let scrollContainer: HTMLElement;

const visibleEntries = $derived(changelog.slice(0, visibleCount));
const hasMore = $derived(visibleCount < changelog.length);

function loadMore() {
	visibleCount = Math.min(visibleCount + ITEMS_PER_PAGE, changelog.length);
}

function handleScroll() {
	if (!scrollContainer || !hasMore) return;

	const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
	const nearBottom = scrollTop + clientHeight >= scrollHeight - 50;

	if (nearBottom) {
		loadMore();
	}
}
```

```svelte
<div bind:this={scrollContainer} onscroll={handleScroll} class="max-h-[380px] overflow-y-auto">
	{#each visibleEntries as entry, index}
		<WhatsNewItem {entry} {index} />
	{/each}

	{#if hasMore}
		<div class="py-3 text-center text-xs text-slate-400">Loading more...</div>
	{/if}
</div>
```

---

## Files Summary

| Action | File Path                                              |
| ------ | ------------------------------------------------------ |
| CREATE | `CHANGELOG.md`                                         |
| CREATE | `src/lib/types/changelog.ts`                           |
| CREATE | `src/lib/utils/changelog-parser.ts`                    |
| CREATE | `src/lib/components/whats-new/whats-new-card.svelte`   |
| CREATE | `src/lib/components/whats-new/whats-new-item.svelte`   |
| CREATE | `src/lib/components/whats-new/whats-new-button.svelte` |
| CREATE | `src/lib/components/whats-new/category-tag.svelte`     |
| MODIFY | `src/routes/+layout.server.ts`                         |
| MODIFY | `src/routes/+page.svelte`                              |

---

## Decisions

- [x] Card visible only in **Single mode** (Batch mode has different layout)
- [x] **No** "View Full Changelog" link - removed from footer
- [x] **Infinite scroll** - load more entries as user scrolls down

---

## Future Enhancements

1. **GitHub Releases Integration**
   - Fetch changelog from `gh api repos/{owner}/{repo}/releases`
   - Auto-sync with actual releases

2. **Filtering**
   - Filter by category (show only features, etc.)

3. **Notifications**
   - Browser notifications for major updates
