# Analiza Feedbacku Użytkowników

> Data analizy: 2026-01-25
> Liczba odpowiedzi: 46
> Średnia ocena: 4.5/5 (52% ocen 5/5, 43% ocen 4/5, 4% ocen 3/5)

## Podsumowanie

Użytkownicy wysoko oceniają aplikację (4.5/5), doceniając głównie:

- Łatwość użycia i intuicyjny interfejs
- Szybkie generowanie etykiet
- Brak konieczności instalacji
- Profesjonalne obrazy sprzętu

Główne obszary do poprawy dotyczą rozszerzenia bazy standardów oraz usprawnień w trybie batch.

---

## Status Implementacji

### ✅ Już Zaimplementowane

| Funkcja                     | Wersja | Uwagi                                            |
| --------------------------- | ------ | ------------------------------------------------ |
| Batch Processing            | 2.0.1  | Generowanie wielu etykiet naraz                  |
| QR Code Support             | 2.0.0  | Kody QR na etykietach                            |
| Custom Image Upload         | 2.3.0  | PNG, JPG, SVG z kompresją                        |
| Descriptive Filenames       | 2.2.0  | Nazwy plików z parametrami                       |
| Wood Screw Support          | 2.1.0  | Wkręty do drewna                                 |
| Standards Database          | 2.0.0  | ISO, DIN, ANSI, ASME, PN, GB, JIS                |
| Hardware Types              | 2.0.0  | Screw, Bolt, Nut, Washer, Pin, Ring, Rivet       |
| Real-time Preview           | 2.0.0  | Podgląd na żywo                                  |
| Heat set / Threaded inserts | 2.3.0  | Poprzez Custom Image w General Item              |
| Batch Mode - Duplikowanie   | 2.0.1  | Opcja powielania etykiety (⚠️ słabo odkrywalna?) |
| Materiał (A2, SS304, etc.)  | -      | Poprzez opcjonalne pole "Note"                   |
| Minimalna szerokość 35mm    | -      | Już zaimplementowane (min=35mm)                  |
| Thread Pitch Selection      | 2.0.1  | UNC/UNF (imperial), coarse/fine (metric)         |
| Rozmiary #0, #2 (imperial)  | 2.5.0  | Standardowe ANSI/ASME dla elektroniki            |

---

## Priorytetyzacja Nowych Funkcji

### 🔴 Wysoki Priorytet (częste zgłoszenia, duży wpływ)

#### ~~1. Thread Pitch Selection (8+ zgłoszeń)~~ ✅ DONE

**Problem:** Użytkownicy potrzebują rozróżnienia między gwintami o różnym skoku

- Imperial: #10-24 UNC vs #10-32 UNF
- Metric: coarse vs fine pitch

**Status:** ✅ Zaimplementowane w wersji 2.0.1 - UI wyboru pitch w formularzu (single + batch mode)

---

#### 2. Więcej Standardów i Ikon (7+ zgłoszeń)

**Najczęściej żądane - status (zweryfikowane przez search):**

| Standard            | W bazie  | Obrazek | Search test                                  |
| ------------------- | -------- | ------- | -------------------------------------------- |
| DIN 7985 / ISO 7045 | ✅       | ✅      | `7985` → ✅ znajduje                         |
| DIN 965             | ✅       | ✅      | `965` → ✅ znajduje                          |
| DIN 7997            | ✅       | ✅      | `7997` → ✅ obrazek dodany                   |
| DIN 916             | ❌       | ❌      | `916` → 0 wyników (ISO 4029 wycofane)        |
| DIN 6916            | ✅       | ✅      | `6916` → ✅ washer (naprawione!)             |
| ISO 14580           | ✅       | ⚠️ BUG  | `14580` → ✅ ale obrazek hex zamiast Torx    |
| Torx heads          | ❌       | ❌      | `torx` → 0 wyników                           |
| Grub screw          | ❌ alias | -       | `grub` → 0 wyników                           |
| Hex nut             | ❌ alias | -       | `hex nut` → 0 wyników (wymaga "hexagon nut") |

**Wnioski z analizy search:**

- Search **działa poprawnie** - problem to brakujące dane i zbyt dokładne dopasowanie
- **Nowy feedback:** Użytkownicy oczekują mniej precyzyjnego wyszukiwania (np. "hex nut" zamiast "hexagon nut")
- ~~DIN 6916 ≠ DIN 916~~ ✅ NAPRAWIONE - DIN 6916 teraz poprawnie jako washer
- DIN 916 (set screw) = ISO 4029 - standard wycofany, brak w bazie ISO
- Brak aliasów: "grub screw" = "set screw", "torx" = "hexalobular"

**Akcja:**

1. ~~Dodać obrazek dla DIN 7997~~ ✅ DONE (scraper fix)
2. ~~Naprawić DIN 6916 klasyfikację~~ ✅ DONE (było screw → teraz washer)
3. Rozważyć aliasy i fuzzy search (grub→set screw, torx→hexalobular, hex nut→hexagon nut)

---

#### 3. Ułamki w Batch Mode (5+ zgłoszeń)

**Problem:** Batch mode nie obsługuje imperial fractions (1/4", 3/8")

**Cytaty użytkowników:**

> "Can't add fractions on batch labels"
> "Batch mode doesn't work with Imperial fractions"

**Root cause zidentyfikowany:**

- Lokalizacja: `src/lib/components/batch/batch-label-row.svelte:273`
- Kod: `length: parseFloat(length) || undefined`
- Bug: `parseFloat("1/4")` zwraca `1` (parsuje tylko do `/`)

**Test dokumentujący:** `src/lib/utils/fraction-parser.test.ts`

**Status:** ✅ NAPRAWIONE

- Utworzono `src/lib/utils/fraction-parser.ts` z funkcjami `parseFraction()` i `decimalToFraction()`
- Zaktualizowano `batch-label-row.svelte` - używa `parseFraction()` zamiast `parseFloat()`
- Zaktualizowano `batch-renderer.ts` - wyświetla ułamki dla imperial system

---

#### ~~4. Więcej Rozmiarów Imperial (4+ zgłoszenia)~~ ✅ DONE

**Żądane rozmiary:**

| Rozmiar | Status       | Uzasadnienie                                                                      |
| ------- | ------------ | --------------------------------------------------------------------------------- |
| #0, #2  | ✅ Dodane    | Standardowe rozmiary ANSI/ASME, używane w elektronice (Arduino, RPi, sensory, RC) |
| M3.5    | ❌ Odrzucone | Nie jest standardem ISO, ekstremalny edge case, może mylić użytkowników           |

**Szczegóły analizy:**

- **#0** (80 TPI UNC) i **#2** (56 UNC, 64 UNF) - standardowe imperial, wypełniają lukę poniżej #4/#6
- **M3.5** - nie istnieje w standardowej serii ISO (M2→M3→M4→M5), występuje tylko w niszowych zastosowaniach

---

#### 5. ⚠️ Discoverability: Batch Mode Duplicate

**Problem:** Użytkownicy nie zauważają istniejącej funkcji duplikowania w batch mode

**Cytaty:**

> "In Batchmode the settings from the last label maybe could be transferred to the new label"
> "Batch processing by default copying the previous selections"

**Akcja:** Poprawić UX - bardziej widoczny przycisk duplicate lub domyślne kopiowanie

---

### 🟡 Średni Priorytet

#### 6. Eksport Wektorowy (SVG/PDF)

**Problem:** PNG nie jest ostry na drukarkach etykiet

**Cytaty:**

> "I would like to have vector graphics. On my Brother P-Touch the icons are not really sharp"
> "Export formats like svg or pdf so the images and fonts are vector graphics"

**Korzyści:** Lepsza jakość wydruku, skalowalność

---

#### 7. Zapisywanie Ustawień / Ulubione

**Żądania:**

- Zapisywanie konfiguracji w cookie/URL
- Eksport/import ustawień
- Lista ulubionych fastenerów

**Cytat:**

> "Save your setup! These settings take some time to dial in"

---

#### 8. Kontrola Marginesów

**Problem:** Drukarki etykiet dodają własne marginesy (często 3mm)

**Cytat:**

> "I'd like to be able to set the margins, my label printer adds 3mm on each side"

---

#### 9. Szerokość Etykiety < 35mm (6 zgłoszeń!)

**Problem:** Wielu użytkowników chce mniejsze etykiety (20-30mm)

**Cytaty (z pola "Inne" w pytaniu o problemy z rozmiarem):**

> "Just smaller widths"
> "37mm is too large, label making program add 2mm of margin so i need to cut them smaller"
> "i sometimes want half bin label."
> "Minimum width was too long (I use 30 mm usually)"
> "i'd love to have it go down to 20mm length"
> "Could you allow the label width to be 20mm?"

**Status:** Min 35mm już zaimplementowane. **6/8 odpowiedzi "Inne" dotyczy tego problemu** - wymaga ponownej oceny priorytetu

---

#### 10. Wyższe Etykiety (nowe zgłoszenie)

**Problem:** Użytkownicy potrzebują znacznie wyższych etykiet niż obecny limit

**Cytat:**

> "Please allow taller labels. I am looking to make 1.5"x4" labels - otherwise this generator is exactly what I'm looking for."

**Wymiar:** 1.5" × 4" ≈ 38mm × 101mm

**Status:** Do oceny - wymaga analizy wpływu na layout

---

#### ~~10. Rozmiary ST dla Self-Tapping~~ ✅ DONE

**Problem:** Self-tapping screws używały tej samej listy rozmiarów co metryczne (M3, M4...).

**Rozwiązanie:** Zaimplementowano `ThreadSizeSystem` z czterema typami:

| System       | Standard                 | Rozmiary                | Użycie                          |
| ------------ | ------------------------ | ----------------------- | ------------------------------- |
| `iso_metric` | ISO 68-1, ISO 261        | M3, M4, M5...           | Standardowe śruby metryczne     |
| `uts`        | ANSI/ASME B1.1           | #4, #6, 1/4"...         | Śruby calowe (Unified Thread)   |
| `tapping`    | ISO 1478, DIN 7970       | ST2.2, ST3.5, ST4.2...  | Wkręty samogwintujące do blachy |
| `nominal`    | _(brak - średnica nom.)_ | 3, 3.5, 4, 4.5, 5, 6... | Wkręty do drewna                |

Smart defaults: DIN 571, DIN 7997, DIN 95-97 → `nominal`, inne self-tapping → `tapping`

**Uwaga:** ST3.5 to standardowy rozmiar (inaczej niż odrzucony M3.5!)

---

### 🐛 Zgłoszone Bugi

#### Bug: Tekst obcięty przy rozmiarze 12×35

**Cytat:**

> "When set to 12x35 the PNG generated clips off the right side of the text"
> "the text is cut off on the right side: https://share.cleanshot.com/TXPsgLXFq4yWXqHplFg0"

**Status:** Do zbadania - problem z renderowaniem tekstu przy małych rozmiarach

---

#### Bug: ISO 14580 - błędny obrazek (hex zamiast Torx)

**Cytat:**

> "Iso 14580 shows the picture of a hex screw but actually it should be Torx"

**Analiza:** Potwierdzone - `data/image-mappings.json` mapuje ISO 14580 na `din_7984.png` (hex socket), a powinien być Torx (hexalobular).

**Status:** Do naprawy - wymaga utworzenia obrazka Torx

---

#### UX: Niski kontrast zaznaczonych opcji

**Cytat:**

> "for me its hard to identify the selected options, the contrast is too low"

**Status:** Do oceny - sprawdzić accessibility (WCAG contrast ratio)

---

### 🟢 Niski Priorytet / Nice-to-Have

| Funkcja                 | Opis                              |
| ----------------------- | --------------------------------- |
| Dark Mode               | Pojedyncze zgłoszenie             |
| Nawigacja TAB           | Dostępność - nawigacja klawiaturą |
| API do Bulk Requests    | Dla power userów                  |
| Bulk Import z Excel/CSV | Generowanie z pliku               |
| Etykiety Tylko Tekstowe | Dla nie-fastenerów                |
| Pozycjonowanie QR Code  | QR w centrum etykiety             |
| Pogrubione Ikony        | Ikony za jasne przy 12mm          |
| Etykiety z Zakresem     | "M3 × 6-12mm"                     |

---

## Statystyki Elementów Etykiet

| Element                 | Użycie      |
| ----------------------- | ----------- |
| Tekst (rozmiary, opisy) | 98% (45/46) |
| Obrazy                  | 96% (44/46) |
| Kody QR                 | 13% (6/46)  |

## Popularne Rozmiary Etykiet

| Rozmiar  | Liczba |
| -------- | ------ |
| 35×12mm  | 6      |
| 55×12mm  | 5      |
| 36×12mm  | 3      |
| 37×9mm   | 3      |
| 30×12mm  | 2      |
| 38×13mm  | 2      |
| 100×50mm | 2      |
| 35×9mm   | 2      |

**Średnie:** 41.4mm × 13.6mm

---

## Pozytywne Komentarze

> "Great tool - consider a GitHub page to track issues/enhancements"

> "Please put this on something like Github so it can be maintained by the open-source community"

> "This is a fantastic tool, thank you for creating it. It's really a great offering to the gridfinity community."

> "I'll buy you a coffee!"

> "This generator is exactly what I'm looking for."

---

## Rekomendacje Priorytetowe

### Krótkoterminowe (Quick Wins)

1. ~~**Naprawić ułamki w batch mode**~~ ✅ DONE
2. ~~**Dodać rozmiary #0, #2 (imperial)**~~ ✅ DONE
3. **Poprawić discoverability duplicate w batch** - UX fix

> ℹ️ M3.5 odrzucony - nie jest standardem ISO, edge case

### Średnioterminowe

4. ~~**Dodać UI dla thread pitch**~~ ✅ DONE - już zaimplementowane
5. ~~**Obrazek DIN 7997 + fix DIN 6916**~~ ✅ DONE - scraper fix + washer classification
6. **Dodać aliasy do search** (grub→set screw, torx→hexalobular)
7. ~~**Rozmiary ST dla self-tapping**~~ ✅ DONE - ThreadSizeSystem (`tapping`, `nominal`)

### Długoterminowe

8. **Eksport SVG/PDF** - wymaga przepisania renderera
9. **System ulubionych/zapisywania** - nowa funkcjonalność
10. **API publiczne** - dla integracji zewnętrznych

---

## Metryki Sukcesu

- **Ocena:** 4.5/5 (bardzo dobra)
- **Problemy z rozmiarem:** 11% użytkowników (wzrost z 8%)
- **Powtarzające się żądania:** ~~Thread pitch~~ ✅, więcej standardów, batch improvements

Aplikacja jest dobrze przyjmowana. Główny focus powinien być na poprawie discoverability istniejących funkcji i dodaniu aliasów search (grub→set screw, torx→hexalobular).

> **Ostatnia aktualizacja:** 2026-01-25 - Zaktualizowano statystyki (44→46), dodano sekcję bugów (ISO 14580, tekst obcięty, kontrast UI), rozszerzono analizę szerokości etykiet (6 zgłoszeń)
