# Plan: Future-proof Survey API

## Problem

Aktualny skrypt używa hardcoded indeksów kolumn (1, 2, 3...). Zmiana pytań w ankiecie łamie agregację danych.

## Rozwiązanie

Hybrid approach: **Header-based mapping + External Config Sheet**

---

## Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Spreadsheet                        │
├─────────────────────┬───────────────────────────────────────┤
│   Config (tab)      │      Form Responses 1 (tab)           │
│                     │                                       │
│  logicalName │ header│  Timestamp │ Rating │ Feedback │ ... │
│  ────────────┼──────│  ──────────┼────────┼──────────┼──── │
│  rating      │ How..│  2024-01-01│   5    │  Great!  │     │
│  feedback    │ What.│  2024-01-02│   4    │  Nice    │     │
│  ...         │ ...  │  ...       │  ...   │  ...     │     │
└─────────────────────┴───────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Apps Script    │
                    │                 │
                    │ 1. Read Config  │
                    │ 2. Read Headers │
                    │ 3. Build mapping│
                    │ 4. Aggregate    │
                    │ 5. Return JSON  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Web App URL   │
                    │   (public GET)  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  SvelteKit App  │
                    │   fetch(url)    │
                    └─────────────────┘
```

---

## Config Sheet - Struktura

### Zakładka: `Config`

| Kolumna A            | Kolumna B                                                              | Kolumna C     |
| -------------------- | ---------------------------------------------------------------------- | ------------- |
| **logicalName**      | **headerText**                                                         | **type**      |
| `rating`             | How would you rate the intuitiveness of the website's interface?       | `rating`      |
| `designSuggestions`  | What changes would you suggest to improve the website's design?        | `text`        |
| `labelElements`      | What elements do you use on your labels?                               | `multiChoice` |
| `labelSizes`         | What label sizes (height and width) do you usually work with?          | `labelSize`   |
| `sizeProblems`       | Do you experience any problems generating labels of specific sizes?    | `yesNo`       |
| `featureRequests`    | What additional features would you like to see in the label generator? | `text`        |
| `biggestAdvantage`   | What do you consider the biggest advantage of the website?             | `text`        |
| `needsImprovement`   | What area needs the most improvement?                                  | `text`        |
| `additionalComments` | Any additional comments or suggestions:                                | `text`        |

### Typy agregacji (`type`):

- `rating` - średnia + rozkład 1-5
- `text` - surowe odpowiedzi tekstowe (dla analizy AI)
- `multiChoice` - licznik wyborów
- `yesNo` - tak/nie + procent
- `labelSize` - parsowanie WxH + statystyki
- `skip` - ignoruj kolumnę

---

## Zmiany w skrypcie

### 1. Nowe funkcje

```javascript
// Wczytuje mapowanie z Config sheet
function loadColumnConfig() → { logicalName: { header, type } }

// Znajduje indeksy kolumn po nagłówkach
function buildColumnMapping(config, headers) → { logicalName: columnIndex }

// Agreguje dane według typu
function aggregateByType(responses, columnIndex, type) → aggregatedData
```

### 2. Zmodyfikowany flow

```
doGet()
  └─> loadColumnConfig()           // Wczytaj Config sheet
  └─> getResponseHeaders()         // Wczytaj nagłówki z Form Responses
  └─> buildColumnMapping()         // Zbuduj mapowanie logical -> index
  └─> aggregateSurveyData(mapping) // Agreguj z użyciem mapowania
  └─> return JSON
```

### 3. Obsługa błędów

- Brakujący nagłówek → log warning, pomiń pole
- Brakujący Config → fallback na legacy indices (backwards compatible)
- Nieznany typ → traktuj jako `text`

---

## Kroki implementacji

### Faza 1: Refactor skryptu

- [x] Dodaj funkcję `loadColumnConfig()`
- [x] Dodaj funkcję `buildColumnMapping()`
- [x] Dodaj funkcję `aggregateByType()`
- [x] Zrefaktoruj `aggregateSurveyData()` na użycie mapowania
- [x] Dodaj obsługę błędów i fallback
- [x] Zaktualizuj `testAggregation()` do testowania nowego flow
- [x] Zmień `text` type: word clouds → surowe odpowiedzi (dla analizy AI)

### Faza 2: Dokumentacja

- [x] Zaktualizuj README.md z instrukcją tworzenia Config sheet
- [x] Dodaj przykładową strukturę Config
- [x] Dodaj sekcję troubleshooting

### Faza 3: Opcjonalne ulepszenia

- [ ] Cache column mapping (PropertyService)
- [ ] Webhook do odświeżania cache przy zmianie Config
- [ ] Walidacja Config sheet przy deploy

---

## Przykład użycia po zmianach

### Scenariusz: Zmiana treści pytania

**Przed:** "How would you rate the intuitiveness of the website's interface?"
**Po:** "Rate the website's ease of use (1-5)"

**Akcja:** Zmień tylko komórkę B2 w Config sheet. Skrypt działa bez zmian.

### Scenariusz: Dodanie nowego pytania

1. Dodaj pytanie w Google Form
2. Dodaj wiersz w Config sheet:
   ```
   newQuestion | New question text here | text
   ```
3. (Opcjonalnie) Dodaj obsługę `newQuestion` w skrypcie jeśli potrzebna specjalna agregacja

### Scenariusz: Usunięcie pytania

1. Usuń pytanie z Google Form
2. Usuń lub zakomentuj wiersz w Config sheet
3. Skrypt automatycznie pominie brakującą kolumnę

---

## API Response - bez zmian

Format odpowiedzi JSON pozostaje taki sam:

```json
{
  "totalResponses": 42,
  "timestamp": "2024-01-06T12:00:00.000Z",
  "rating": { "average": 4.2, "distribution": {...} },
  "labelElements": { "Images": 35, "Text": 42 },
  ...
}
```

---

## Ryzyka i mitygacja

| Ryzyko                    | Prawdopodobieństwo | Impact               | Mitygacja                       |
| ------------------------- | ------------------ | -------------------- | ------------------------------- |
| Literówka w headerText    | Średnie            | Brak danych dla pola | Walidacja + warning log         |
| Brak Config sheet         | Niskie             | Błąd skryptu         | Fallback na legacy mode         |
| Duplikaty nagłówków       | Niskie             | Niepewne mapowanie   | Użyj pierwszego match + warning |
| Performance (duży Config) | Niskie             | Wolniejsze response  | Cache w PropertyService         |

---

## Decyzje do podjęcia

1. **Czy zachować backwards compatibility?**
   - Tak → fallback na hardcoded indices jeśli brak Config
   - Nie → wymagaj Config sheet

2. **Gdzie przechowywać Config?**
   - Opcja A: Osobna zakładka w tym samym arkuszu (rekomendowane)
   - Opcja B: Osobny arkusz Google
   - Opcja C: Script Properties (mniej elastyczne)

3. **Czy cache'ować mapowanie?**
   - Tak → szybsze response, wymaga invalidacji
   - Nie → zawsze świeże dane, minimalnie wolniejsze

**Rekomendacja:** Backwards compatible, Config w zakładce, bez cache (prostota > performance dla małej skali)

---

## Faza 4: Integracja z aplikacją SvelteKit

### Opcje integracji

| Opcja                     | Opis                             | Prywatność | Prostota     | User Value   |
| ------------------------- | -------------------------------- | ---------- | ------------ | ------------ |
| **1. Manual**             | Ręczne wywołanie URL do analizy  | ✅ Wysoka  | ✅ Najwyższa | ❌ Brak      |
| **2. Admin dashboard**    | `/admin/survey` z auth           | ✅ Wysoka  | ⚠️ Średnia   | ⚠️ Tylko dev |
| **3. Scheduled + static** | GitHub Actions + JSON w repo     | ✅ Wysoka  | ✅ Wysoka    | ✅ Wysoka    |
| **4. Server-side proxy**  | SvelteKit API endpoint           | ✅ Wysoka  | ⚠️ Średnia   | ✅ Wysoka    |
| **5. Client-side fetch**  | Bezpośredni fetch z przeglądarki | ❌ Niska   | ✅ Wysoka    | ✅ Wysoka    |

### Rekomendacja: Opcja 3 - Scheduled fetch + static data

```
┌─────────────────┐     cron (daily)     ┌──────────────────┐
│ Google Apps     │ ──────────────────▶  │ GitHub Actions   │
│ Script API      │                      │ fetch + process  │
└─────────────────┘                      └────────┬─────────┘
                                                  │
                                                  ▼
                                         ┌──────────────────┐
                                         │ surveyStats.json │
                                         │ (in repo)        │
                                         └────────┬─────────┘
                                                  │
                                                  ▼
                                         ┌──────────────────┐
                                         │ /feedback page   │
                                         │ (static import)  │
                                         └──────────────────┘
```

**Zalety:**

- URL Google Apps Script ukryty (nie eksponowany w przeglądarce)
- Możliwość pre-processingu i anonimizacji danych przed commitem
- Zero runtime overhead (statyczny JSON)
- "Set and forget" z GitHub Actions
- Strona "What users say" jako social proof

### Kroki implementacji (Faza 4)

- [ ] Deploy Google Apps Script jako Web App
- [ ] Utworzyć skrypt fetch (`scripts/fetch-survey-data.js`)
  - Pobiera dane z API
  - Przetwarza/anonimizuje wrażliwe dane
  - Zapisuje do `src/lib/data/surveyStats.json`
- [ ] Utworzyć GitHub Actions workflow (`.github/workflows/update-survey-data.yml`)
  - Cron: daily lub weekly
  - Uruchamia skrypt fetch
  - Commituje zaktualizowany JSON
- [ ] Utworzyć stronę `/feedback` w SvelteKit
  - Importuje statyczny JSON
  - Wyświetla rating, statystyki, feature requests
