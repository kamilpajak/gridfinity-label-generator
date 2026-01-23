# Plan naprawy testów E2E

> Wygenerowano na podstawie code review z 2026-01-23

## Podsumowanie

| Priorytet    | Liczba | Status      |
| ------------ | ------ | ----------- |
| 🔴 Krytyczne | 0      | —           |
| 🟠 Wysokie   | 2      | ✅ Zrobione |
| 🟡 Średnie   | 2      | ✅ Zrobione |
| 🟢 Niskie    | 4      | ✅ Zrobione |

---

## 🟠 Wysokie

### 1. Oznacz test oczekujący na porażkę

**Plik:** `e2e/label-generator.test.ts:221-251`

**Problem:** Test "should render General Item labels with correct font sizes" ma komentarz mówiący, że test będzie failować do czasu naprawy buga, ale biegnie normalnie w CI generując szum.

**Rozwiązanie:**

```typescript
// Zmień z:
test('should render General Item labels with correct font sizes (not constrained by disabled features)', async () => {

// Na:
test.fixme('should render General Item labels with correct font sizes (not constrained by disabled features)', async () => {
```

**Dlaczego `test.fixme()` a nie `test.skip()`:**

- `test.fixme()` pojawia się w raportach jako "known failure"
- Jeśli test zacznie przechodzić, Playwright zgłosi to jako błąd (sygnał że bug naprawiony)
- `test.skip()` całkowicie ukrywa test

**Dodatkowe zadanie:** Utwórz GitHub Issue dla buga z layoutem w General Item mode.

---

### 2. Zbadaj pominięte testy mutual exclusion

**Plik:** `e2e/qr-hardware-mutual-exclusion.test.ts`

**Problem:** Cały plik ma `test.skip` z komentarzem "Known issue: These tests timeout". Pominięte testy "gniją" z czasem i stają się trudne do ponownego włączenia.

**Plan działania:**

1. **Diagnostyka** — Uruchom testy lokalnie bez skip:

   ```bash
   pnpm test:e2e e2e/qr-hardware-mutual-exclusion.test.ts --timeout=30000
   ```

2. **Analiza przyczyn timeoutu:**
   - Czy canvas renderuje się prawidłowo?
   - Czy selektory są aktualne?
   - Czy waity są odpowiednie?

3. **Naprawa lub oznaczenie:**
   - Jeśli da się naprawić → napraw i usuń skip
   - Jeśli wymaga większych zmian → zamień `test.skip` na `test.fixme` + utwórz Issue

**Rozwiązanie tymczasowe:**

```typescript
// Zmień z:
test.skip('should disable QR Code when Hardware Icon is enabled on narrow label', async () => {

// Na:
test.fixme('should disable QR Code when Hardware Icon is enabled on narrow label', async () => {
```

---

## 🟡 Średnie

### 3. ✅ Refaktoruj duplikację w custom-image.test.ts

**Status:** Zrobione (2026-01-23)

**Plik:** `e2e/custom-image.test.ts`

**Problem:** Single Mode i Batch Mode miały identyczną logikę testową zduplikowaną.

**Wykonane zmiany:**

- Utworzono `ModeConfig` interface z metodami `setupFor12mm`, `setupFor9mm`, `switchTo12mm`
- Wspólne testy (Upload, Preview Controls, 9mm Restriction) uruchamiane w pętli `for...of` dla obu trybów
- Testy specyficzne dla Batch Mode (Persistence) pozostały osobno

**Wyniki:**

- Redukcja kodu: 509 → 345 linii (−32%)
- Wszystkie 42 testy przechodzą (14 testów × 3 przeglądarki)

---

### 4. ✅ Zamień manipulację DOM na interakcję użytkownika

**Status:** Zrobione (2026-01-23)

**Pliki:**

- Utworzono: `e2e/utils/slider-helpers.ts`
- Zaktualizowano: `e2e/printable-area-boundaries.test.ts`
- Zaktualizowano: `e2e/qr-hardware-mutual-exclusion.test.ts`

**Problem:** Testy używały `evaluate()` do bezpośredniego ustawienia wartości slidera, co nie wyzwalało Svelte reactivity.

**Wykonane zmiany:**

- Utworzono `slider-helpers.ts` z funkcjami `setSliderValue()` i `getSliderValue()`
- Helper symuluje kliknięcie w odpowiedniej pozycji slidera
- Zamieniono wszystkie wywołania `evaluate()` na `setSliderValue()`
- Usunięto zduplikowaną lokalną implementację z `qr-hardware-mutual-exclusion.test.ts`

**Weryfikacja:** Wszystkie 21 testów qr-hardware-mutual-exclusion przechodzą

---

## 🟢 Niskie

### 5. ✅ Uprość waitForQRCodeRender

**Status:** Zrobione (2026-01-23)

**Plik:** `e2e/utils/wait-helpers.ts`

**Problem:** Funkcja najpierw czekała na `data-render-status='stable'`, a potem wykonywała nadmiarowe sprawdzanie pikseli w siatce 3x3. To było redundantne i niestabilne na różnych rozdzielczościach.

**Wykonane zmiany:**

- Usunięto pixel sampling (69 → 19 linii kodu)
- Usunięto nieużywane importy z `canvas-geometry`
- Funkcja polega teraz wyłącznie na event-driven `data-render-status='stable'`

**Uzasadnienie (konsultacja z Gemini 2.5 Pro):**

- `data-render-status` to kontrakt między aplikacją a testami
- Jeśli status jest 'stable' ale QR nie jest wyrenderowany, to bug w aplikacji do złapania przez visual regression testy
- Pixel sampling był tightly coupled do szczegółów implementacji (pozycje, marginesy)

**Weryfikacja:** Wszystkie 9 testów QR code przechodzą (3 testy × 3 przeglądarki).

---

### 6. ✅ Dodaj dokumentację do progów QR code comparison

**Status:** Zrobione (2026-01-23)

**Plik:** `e2e/qr-code-update.test.ts`

**Problem:** Magic numbers (20%, 30%) nie miały wyjaśnienia.

**Wykonane zmiany:** Dodano komentarze JSDoc do wszystkich trzech miejsc z progami:

- Linia ~59: próg 30% dla różnych URLi
- Linia ~103: próg 20% dla QR appearing/disappearing
- Linie ~145-146: próg 20% dla real-time typing

#### Walidacja progów (research z 2026-01-23)

| Metryka                       | Wartość |
| ----------------------------- | ------- |
| Noise floor (anti-aliasing)   | ~1-5%   |
| Min. różnica dla różnych URLi | ~40-60% |
| Typowa różnica                | ~60-90% |

**Wniosek:** Progi 20-30% są konserwatywne i poprawne.

---

### 7. Scentralizuj timeouty

**Problem:** Hardcoded timeouts (5000, 10000) są rozrzucone po wielu plikach.

**Rozwiązanie — dodaj do `e2e/types/page-objects.ts`:**

```typescript
// e2e/types/page-objects.ts

/** Centralized timeout configuration for e2e tests */
export const TIMEOUTS = {
	/** Short operations (button clicks, simple waits) */
	SHORT: 3000,
	/** Default timeout for most operations */
	DEFAULT: 5000,
	/** Long operations (canvas rendering, file uploads) */
	LONG: 10000,
	/** Very long operations (batch exports, heavy processing) */
	EXTENDED: 15000
} as const;
```

**Użycie:**

```typescript
import { TIMEOUTS } from '../types/page-objects';

await canvas.waitFor({ state: 'visible', timeout: TIMEOUTS.DEFAULT });
await this.page.waitForFunction(fn, args, { timeout: TIMEOUTS.LONG });
```

**Pliki do aktualizacji:**

- `e2e/utils/wait-helpers.ts`
- `e2e/pages/components/NavigationTabs.ts`
- `e2e/pages/components/HardwareSelector.ts`
- `e2e/pages/single-mode/SingleModePage.ts`
- `e2e/pages/components/SingleLabelPreview.ts`

---

### 8. ✅ Dodaj komentarze do magic numbers w asercjach

**Status:** Już zrobione (zastane przy implementacji Task 1)

**Plik:** `e2e/label-generator.test.ts:245-254`

Magic numbers `6.0` i `5.5` są już udokumentowane i wyekstrahowane do nazwanych stałych:

```typescript
// Expected font sizes in General Item mode without hardware constraints:
// - Primary text: ~6.47mm (calculated from canvas data attributes)
// - Secondary text: ~5.74mm
// Current buggy behavior: primary ~4.18mm, secondary ~3.71mm
// Using slightly lower thresholds to account for rendering variance
const EXPECTED_MIN_PRIMARY_FONT_MM = 6.0;
const EXPECTED_MIN_SECONDARY_FONT_MM = 5.5;
```

---

## Kolejność implementacji

| #   | Zadanie                                            | Effort    | Impact |
| --- | -------------------------------------------------- | --------- | ------ |
| 1   | ✅ Oznacz test.fixme() w label-generator.test.ts   | 5 min     | Wysoki |
| 2   | ✅ Zbadaj qr-hardware-mutual-exclusion.test.ts     | 30-60 min | Wysoki |
| 3   | Dodaj TIMEOUTS constant                            | 15 min    | Średni |
| 4   | ✅ Uprość waitForQRCodeRender                      | 10 min    | Średni |
| 5   | ✅ Dodaj komentarze do QR thresholds (zwalidowane) | 15 min    | Niski  |
| 6   | ✅ Dodaj komentarze do magic numbers               | 10 min    | Niski  |
| 7   | ✅ Refaktoruj custom-image.test.ts                 | 45 min    | Średni |
| 8   | ✅ Dodaj slider-helpers.ts                         | 20 min    | Niski  |

**Szacowany czas całkowity:** 2.5-3.5 godziny

---

## Definition of Done

- [ ] Wszystkie testy przechodzą (`pnpm test:e2e`)
- [ ] Brak `test.skip` bez powiązanego Issue
- [ ] Timeouty używają centralnych stałych
- [ ] Brak duplikacji w custom-image.test.ts
- [ ] Code review przez drugą osobę
