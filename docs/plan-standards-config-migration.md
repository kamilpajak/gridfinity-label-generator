# Plan migracji: standards-config.json v2

## Cel

Refaktoryzacja `standards-config.json` z dwusekcyjnej struktury (`crossref`, `dinOnly`) na jednolitą strukturę per-system dla lepszej rozszerzalności, czytelności i maintainability.

## Aktualna struktura (v1)

```json
{
	"crossref": {
		"iso4762": { "din": ["912"] },
		"iso10509": { "din": [] },
		"iso1051": { "din": ["660"], "status": "WITHDRAWN" }
	},
	"dinOnly": {
		"din95": { "description": "Slotted countersunk..." },
		"din127": { "description": "Spring lock washers", "status": "WITHDRAWN" },
		"din7991": { "description": "...", "status": "WITHDRAWN", "replacedBy": "iso10642" }
	}
}
```

## Docelowa struktura (v2)

```json
{
	"iso": {
		"4762": { "din": ["912"] },
		"10509": {},
		"1051": { "din": ["660"], "withdrawn": true }
	},
	"din": {
		"95": {},
		"127": { "withdrawn": true },
		"7991": { "withdrawn": true, "replacedBy": "iso10642" }
	}
}
```

## Kluczowe zmiany

| Aspekt          | v1                      | v2                                                |
| --------------- | ----------------------- | ------------------------------------------------- |
| Sekcje          | `crossref`, `dinOnly`   | `iso`, `din`, (future: `ansi`, `pn`, `gb`, `jis`) |
| Klucze          | `iso4762`, `din912`     | `4762`, `912` (system = sekcja)                   |
| Status          | `"status": "WITHDRAWN"` | `"withdrawn": true`                               |
| Description     | Wymagane w `dinOnly`    | Usunięte (DIN Media = SSOT)                       |
| Puste cross-ref | `"din": []`             | Pominięte (brak klucza)                           |

## Pliki do modyfikacji

### Faza 1: Nowa biblioteka pomocnicza

**Nowy plik: `src/lib/utils/standards-config.ts`**

```typescript
/**
 * Standards Config v2 Utilities
 */

export type StandardSystem = 'iso' | 'din' | 'ansi' | 'pn' | 'gb' | 'jis';

export interface StandardEntry {
	din?: string[];
	iso?: string[];
	ansi?: string[];
	pn?: string[];
	withdrawn?: boolean;
	replacedBy?: string;
}

export interface StandardsConfigV2 {
	iso?: Record<string, StandardEntry>;
	din?: Record<string, StandardEntry>;
	ansi?: Record<string, StandardEntry>;
	pn?: Record<string, StandardEntry>;
	gb?: Record<string, StandardEntry>;
	jis?: Record<string, StandardEntry>;
}

/**
 * Parse full standard ID to system and number
 * "iso4762" -> { system: "iso", number: "4762" }
 */
export function parseStandardId(fullId: string): { system: StandardSystem; number: string } | null {
	const match = fullId.toLowerCase().match(/^(iso|din|ansi|pn|gb|jis)(\d+[a-z]?)$/);
	if (!match) return null;
	return { system: match[1] as StandardSystem, number: match[2] };
}

/**
 * Build full standard ID from system and number
 * { system: "iso", number: "4762" } -> "iso4762"
 */
export function buildStandardId(system: StandardSystem, number: string): string {
	return `${system}${number}`;
}

/**
 * Extract all standard IDs from v2 config
 */
export function extractAllStandardIds(config: StandardsConfigV2): string[] {
	const ids: string[] = [];
	const systems: StandardSystem[] = ['iso', 'din', 'ansi', 'pn', 'gb', 'jis'];

	for (const system of systems) {
		const section = config[system];
		if (section) {
			for (const number of Object.keys(section)) {
				ids.push(buildStandardId(system, number));
			}
		}
	}

	return ids;
}

/**
 * Get standard entry from v2 config
 */
export function getStandardEntry(
	config: StandardsConfigV2,
	fullId: string
): StandardEntry | undefined {
	const parsed = parseStandardId(fullId);
	if (!parsed) return undefined;
	return config[parsed.system]?.[parsed.number];
}

/**
 * Check if standard is withdrawn
 */
export function isWithdrawn(config: StandardsConfigV2, fullId: string): boolean {
	const entry = getStandardEntry(config, fullId);
	return entry?.withdrawn === true;
}
```

### Faza 2: Skrypt migracji danych

**Nowy plik: `scripts/migrate-standards-config.js`**

```javascript
#!/usr/bin/env node
/**
 * One-time migration script: standards-config.json v1 -> v2
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, '../data/standards-config.json');
const OUTPUT = path.join(__dirname, '../data/standards-config-v2.json');

const v1 = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
const v2 = { iso: {}, din: {} };

// Migrate crossref -> iso
for (const [fullId, entry] of Object.entries(v1.crossref)) {
	const number = fullId.replace('iso', '');
	const newEntry = {};

	if (entry.din?.length > 0) {
		newEntry.din = entry.din;
	}
	if (entry.status === 'WITHDRAWN') {
		newEntry.withdrawn = true;
	}
	if (entry.replacedBy) {
		newEntry.replacedBy = entry.replacedBy;
	}

	v2.iso[number] = newEntry;
}

// Migrate dinOnly -> din
for (const [fullId, entry] of Object.entries(v1.dinOnly)) {
	const number = fullId.replace('din', '');
	const newEntry = {};

	// Skip description (DIN Media is SSOT)
	if (entry.status === 'WITHDRAWN') {
		newEntry.withdrawn = true;
	}
	if (entry.replacedBy) {
		newEntry.replacedBy = entry.replacedBy;
	}

	v2.din[number] = newEntry;
}

fs.writeFileSync(OUTPUT, JSON.stringify(v2, null, '\t'));
console.log(`Migrated: ${Object.keys(v2.iso).length} ISO, ${Object.keys(v2.din).length} DIN`);
console.log(`Output: ${OUTPUT}`);
```

### Faza 3: Aktualizacja skryptów pipeline

#### 3.1 `scripts/standards-validate.js`

Zmiany:

- Nowa walidacja struktury (sekcje `iso`, `din` zamiast `crossref`, `dinOnly`)
- Walidacja kluczy (tylko cyfry + opcjonalny suffix literowy)
- Walidacja cross-referencji (tablice stringów)

```javascript
// Stare
if (!('crossref' in config)) errors.push('Missing: crossref');
if (!('dinOnly' in config)) errors.push('Missing: dinOnly');

// Nowe
const VALID_SYSTEMS = ['iso', 'din', 'ansi', 'pn', 'gb', 'jis'];
const hasAtLeastOneSystem = VALID_SYSTEMS.some((s) => s in config);
if (!hasAtLeastOneSystem) {
	errors.push('Config must have at least one system section (iso, din, etc.)');
}
```

#### 3.2 `scripts/standards-resolve.js`

Zmiany:

- `loadStandardIdsFromConfig()` - iteracja po sekcjach systemów
- Budowanie pełnego ID z systemu i numeru

```javascript
// Stare
for (const id of Object.keys(config.crossref || {})) {
	ids.push(id.toLowerCase());
}
for (const id of Object.keys(config.dinOnly || {})) {
	ids.push(id.toLowerCase());
}

// Nowe
const systems = ['iso', 'din', 'ansi', 'pn', 'gb', 'jis'];
for (const system of systems) {
	for (const number of Object.keys(config[system] || {})) {
		ids.push(`${system}${number}`);
	}
}
```

#### 3.3 `scripts/standards-build.js`

Zmiany:

- Iteracja po `config.iso` zamiast `config.crossref`
- Iteracja po `config.din` zamiast `config.dinOnly`
- Budowanie ID: `iso${number}` zamiast używania klucza
- Sprawdzanie `withdrawn: true` zamiast `status === 'WITHDRAWN'`

```javascript
// Stare
const processedISO = Object.entries(config.crossref).map(([id, crossref]) => {
  const isoNumber = id.replace('iso', '');
  const markedWithdrawn = crossref?.status === 'WITHDRAWN';
  ...
});

// Nowe
const processedISO = Object.entries(config.iso || {}).map(([number, entry]) => {
  const id = `iso${number}`;
  const markedWithdrawn = entry?.withdrawn === true;
  ...
});
```

#### 3.4 `scripts/standards-fetch.js`

Zmiany podobne do resolve.js - zmiana sposobu iteracji po konfiguracji.

### Faza 4: Aktualizacja walidatora TypeScript

#### 4.1 `src/lib/utils/config-validator.ts`

Kompletna refaktoryzacja:

```typescript
export type StandardSystem = 'iso' | 'din' | 'ansi' | 'pn' | 'gb' | 'jis';

export interface StandardEntry {
	din?: string[];
	iso?: string[];
	withdrawn?: boolean;
	replacedBy?: string;
}

export interface StandardsConfigV2 {
	[key: string]: Record<string, StandardEntry> | undefined;
}

const VALID_SYSTEMS: StandardSystem[] = ['iso', 'din', 'ansi', 'pn', 'gb', 'jis'];

export function validateConfigStructure(config: unknown): ValidationResult {
	// ... nowa logika
}

export function validateSystemSection(system: string, section: unknown): ValidationResult {
	// Walidacja numerów (tylko cyfry + opcjonalny suffix)
	// Walidacja wpisów (withdrawn: boolean, din/iso: string[])
}
```

#### 4.2 `src/lib/utils/config-validator.test.ts`

Aktualizacja testów dla nowej struktury.

### Faza 5: Aktualizacja utility functions

#### 5.1 `src/lib/utils/dinmedia-search.ts`

```typescript
// Stare
export function extractStandardIdsFromConfig(config: StandardsConfig): string[] {
  for (const id of Object.keys(config.crossref || {})) { ... }
  for (const id of Object.keys(config.dinOnly || {})) { ... }
}

// Nowe - import z nowej biblioteki
import { extractAllStandardIds } from './standards-config';
export { extractAllStandardIds as extractStandardIdsFromConfig };
```

### Faza 6: Aktualizacja testów

Pliki do aktualizacji:

- `src/lib/utils/config-validator.test.ts`
- `src/lib/utils/dinmedia-search.test.ts`
- `src/lib/data/standards-validation.test.ts`

### Faza 7: Dokumentacja

- Aktualizacja `CLAUDE.md` - opis nowej struktury
- Aktualizacja `docs/plan-standards-validation-pipeline.md`
- Aktualizacja `scripts/README.md`

## Kolejność implementacji

```
1. [x] Utworzenie src/lib/utils/standards-config.ts (nowa biblioteka)
2. [x] Testy dla standards-config.ts
3. [x] Skrypt migracji migrate-standards-config.js
4. [x] Uruchomienie migracji -> standards-config-v2.json
5. [x] Weryfikacja danych po migracji
6. [x] Aktualizacja config-validator.ts
7. [x] Aktualizacja config-validator.test.ts
8. [x] Aktualizacja dinmedia-search.ts
9. [x] Aktualizacja dinmedia-search.test.ts
10. [x] Aktualizacja standards-validate.js
11. [x] Aktualizacja standards-resolve.js
12. [x] Aktualizacja standards-fetch.js
13. [x] Aktualizacja standards-build.js
14. [x] Uruchomienie pełnego pipeline z nowym configiem
15. [x] Zamiana standards-config.json na v2
16. [x] Usunięcie skryptu migracji
17. [x] Aktualizacja dokumentacji
18. [x] Aktualizacja standards-validation.test.ts
```

**Status: MIGRACJA ZAKOŃCZONA (2025-01)**

## Ryzyka i mitygacja

| Ryzyko                  | Mitygacja                                            |
| ----------------------- | ---------------------------------------------------- |
| Błędy w migracji danych | Skrypt migracji + manualna weryfikacja przed zamianą |
| Regresje w pipeline     | Uruchomienie pełnego pipeline przed merge            |
| Brakujące testy         | Najpierw testy, potem implementacja (TDD)            |

## Metryki sukcesu

- [x] `pnpm standards:validate` przechodzi
- [x] `pnpm standards:build` generuje identyczny output
- [x] `pnpm test:unit` przechodzi (693 tests)
- [x] Liczba standardów przed i po migracji jest identyczna (104 ISO + 106 DIN = 210)

## Backward compatibility

Migracja jest **breaking change** - nie ma potrzeby wspierania starej struktury po migracji. Wszystkie zmiany będą w jednym PR.
