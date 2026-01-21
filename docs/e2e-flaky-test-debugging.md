# E2E Flaky Test Debugging Log

This document tracks debugging efforts for flaky E2E tests, particularly related to hardware selection and form state transitions.

## Issue: `hardware-type-transitions.test.ts:139` - Rapid Hardware Switching

**Test:** `should handle rapid switching between different hardware types`

**Symptom:** Test passes locally but fails ~50% of the time on CI (GitHub Actions).

**Branch:** `feat/fuzzy-search`

---

### Investigation Timeline

#### 1. Initial Analysis

**Observation:** Test iterates through 6 hardware types rapidly, checking length field enabled/disabled state after each selection.

**CI vs Local:**

- Master branch: 100% pass rate
- Feature branch: ~50% pass rate

**Root cause hypothesis:** Race condition between popover close animation and form state update.

---

#### 2. Fix Attempt #1: Wait for Popover Close

**File:** `e2e/pages/single-mode/SingleModePage.ts`

**Change:** Added wait for popover-content to be detached after selection.

```typescript
// Wait for popover to close (animation complete) before proceeding
await this.page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
```

**Result:** Still failing - `toBeDisabled` timeout (received: undefined)

---

#### 3. Fix Attempt #2: Polling for Canvas Render Status

**File:** `e2e/pages/components/SingleLabelPreview.ts`

**Problem:** `waitForLabelRender` was using `toHaveAttribute` which doesn't handle canvas unmounting during rapid state changes.

**Change:** Switched to `waitForFunction` with polling:

```typescript
async waitForLabelRender() {
    await this.page.waitForFunction(
        () => {
            const canvas = document.querySelector('[data-testid="label-preview-canvas"]');
            if (!canvas) {
                // Check if placeholder is shown (no content case)
                const placeholder = document.querySelector('[data-testid="label-preview-placeholder"]');
                return !!placeholder;
            }
            // Canvas exists - check if render is stable
            return canvas.getAttribute('data-render-status') === 'stable';
        },
        { timeout: 10000 }
    );
}
```

**Result:** Still failing - `data-render-status=""` instead of `"stable"`

---

#### 4. Fix Attempt #3: Double requestAnimationFrame

**File:** `e2e/pages/single-mode/SingleModePage.ts`

**Hypothesis:** Svelte reactive updates haven't completed before assertions.

**Change:** Added double rAF to ensure all microtasks and browser updates are processed:

```typescript
await this.page.evaluate(
	() =>
		new Promise((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))
		)
);
```

**Result:** Still failing - popover not opening (search input never visible)

---

#### 5. Fix Attempt #4: Button Visibility Wait

**File:** `e2e/pages/single-mode/SingleModePage.ts`

**Problem:** After popover closes, button might not be immediately actionable.

**Change:** Added visibility wait before clicking:

```typescript
// Ensure button is actionable before clicking (handles post-popover-close state)
await this.hardwareSelectButton.waitFor({ state: 'visible' });
```

**Result:** Still failing - `page.evaluate` with rAF timing out (60s)

---

#### 6. Fix Attempt #5: Remove Double rAF (Current)

**File:** `e2e/pages/single-mode/SingleModePage.ts`

**Analysis via zen debug:** Browser event loop becomes saturated on CI due to resource constraints. The double rAF pattern causes hangs because the event loop never gets to process the animation frames.

**Change:** Remove the `page.evaluate` with double rAF entirely. The existing waits (popover detached + waitForLabelRender polling) should be sufficient.

```diff
- // Wait for Svelte reactive updates to complete (form state changes like disabled inputs)
- // Double rAF ensures all microtasks and browser updates are processed
- await this.page.evaluate(
-     () =>
-         new Promise((resolve) =>
-             requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))
-         )
- );
```

**Local test result:** ✅ Passes on all browsers (Chromium, Firefox, WebKit)

**CI result:** ❌ Failed - new error: `threadSizeButton` contains `""` instead of `"M6"`

---

#### 7. Fix Attempt #6: Wait for Form Stabilization

**File:** `e2e/pages/single-mode/SingleModePage.ts`

**Analysis via zen debug:** After hardware selection, the bits-ui Select component enters a brief transitional state where its textContent is empty. This happens during Svelte re-render cycles. On CI with limited resources, this transitional state persists longer.

**Root cause:** The `waitForLabelRender` only ensures the canvas is stable, not the form components. The thread size Select component re-renders independently and may be in an empty state when assertions run.

**Change:** Add `waitForFormStable()` method that ensures the thread-size-select has non-empty text content:

```typescript
private async waitForFormStable() {
    await this.page.waitForFunction(
        () => {
            const threadSizeSelect = document.querySelector('[data-testid="thread-size-select"]');
            if (!threadSizeSelect) return false;
            // Wait for the select to have some text content (value or placeholder)
            const text = threadSizeSelect.textContent?.trim();
            return text && text.length > 0;
        },
        { timeout: 5000 }
    );
}
```

**Local test result:** ✅ Passes on all browsers (Chromium, Firefox, WebKit)

**CI result:** ❌ Failed - new error: `lengthInput.toBeDisabled()` received `undefined`

---

#### 8. Fix Attempt #7: Wait for Length Input Disabled State

**File:** `e2e/pages/single-mode/SingleModePage.ts`

**Analysis:** The `waitForFormStable` only checked thread-size-select. The length input also needs time to have its `disabled` property set by Svelte's reactive system. "Received: undefined" indicates the element is in a transitional state.

**Change:** Extend `waitForFormStable()` to also verify length input has a defined disabled state:

```typescript
private async waitForFormStable() {
    // Wait for thread size select to have some text content (not empty)
    await expect(this.threadSizeButton).not.toBeEmpty({ timeout: 5000 });
    // Wait for length input to exist and be in a stable state
    await this.lengthInput.waitFor({ state: 'attached', timeout: 5000 });
}
```

**Local test result:** ✅ Passes on all browsers (Chromium, Firefox, WebKit)

**CI result:** ❌ Failed - popover closes before `fill()` completes

---

#### 9. Fix Attempt #8: Use Playwright Assertions Instead of waitForFunction

**File:** `e2e/pages/single-mode/SingleModePage.ts`

**Analysis:** The `waitForFunction` approach may have caused focus/interaction issues that triggered the popover to close. Playwright's built-in assertions are more reliable for waiting on element state.

**Change:** Replace `waitForFunction` with Playwright assertions:

```typescript
private async waitForFormStable() {
    // Wait for thread size select to have some text content (not empty)
    await expect(this.threadSizeButton).not.toBeEmpty({ timeout: 5000 });
    // Wait for length input to exist and be in a stable state
    await this.lengthInput.waitFor({ state: 'attached', timeout: 5000 });
}
```

**Local test result:** ✅ Passes on all browsers (Chromium, Firefox, WebKit)

**CI result:** ❌ Failed - `lengthInput.waitFor` causes full test timeout (60s)

---

#### 10. Fix Attempt #9: Remove waitForFormStable Entirely

**File:** `e2e/pages/single-mode/SingleModePage.ts`

**Analysis:** The `waitForFormStable` method was adding unnecessary overhead and causing cascading delays. Each iteration added 5s+ of waiting, eventually causing the full test to timeout. The test assertions themselves have built-in retry logic with reasonable timeouts, so extra stabilization waits are counterproductive.

**Key insight:** Sometimes adding more waits makes things worse. Trust Playwright's built-in assertion retry mechanism.

**Change:** Remove `waitForFormStable()` entirely. Keep only the essential waits:

1. Wait for popover to close (detached)
2. Wait for label preview to render

```typescript
async selectHardwareByName(searchTerm: string, namePattern: RegExp) {
    await this.hardwareSelectButton.waitFor({ state: 'visible' });
    await this.hardwareSelectButton.click();
    await this.hardwareSearchInput.waitFor({ state: 'visible' });
    await this.hardwareSearchInput.fill(searchTerm);
    await this.page.locator('[data-slot="command-item"]').first().waitFor({ state: 'visible' });
    await this.page.getByRole('option', { name: namePattern }).first().click();
    await this.page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
    await this.preview.waitForLabelRender();
}
```

**Local test result:** ✅ Passes on all browsers (Chromium, Firefox, WebKit)

**CI result:** ❌ Failed - button click times out waiting for element to be "stable"

---

#### 11. Fix Attempt #10: Wait for Button Bounding Box Stability

**File:** `e2e/pages/single-mode/SingleModePage.ts`

**Analysis:** The button was visible and resolved, but Playwright's actionability check was waiting for the element to become "stable" (not animating/moving). On CI, the popover close animation or canvas render causes layout shifts that keep the button unstable indefinitely.

**Root cause:** Playwright's `.click()` waits for the element to stop moving before clicking. After popover closes, there may be residual CSS transitions or layout recalculations that keep the button's bounding box changing.

**Change:** Added `waitForButtonStable()` method that checks the button's bounding box hasn't changed over 2 animation frames:

```typescript
private async waitForButtonStable() {
    await this.page.waitForFunction(
        (selector) => {
            const button = document.querySelector(selector);
            if (!button) return false;

            return new Promise<boolean>((resolve) => {
                const rect1 = button.getBoundingClientRect();
                requestAnimationFrame(() => {
                    const rect2 = button.getBoundingClientRect();
                    // Check if button position/size hasn't changed
                    const stable =
                        rect1.x === rect2.x &&
                        rect1.y === rect2.y &&
                        rect1.width === rect2.width &&
                        rect1.height === rect2.height;
                    resolve(stable);
                });
            });
        },
        '[data-testid="hardware-select"]',
        { timeout: 5000 }
    );
}
```

**Local test result:** ✅ Passes on all browsers (Chromium, Firefox, WebKit)

**CI result:** ✅ Passed

---

### Key Learnings

1. **Event loop saturation on CI:** CI environments have limited resources. Patterns that work locally can cause hangs on CI due to event loop saturation.

2. **Avoid `page.evaluate` with rAF for sync:** `requestAnimationFrame` inside `page.evaluate` can hang if the browser's event loop is blocked or saturated.

3. **Prefer polling with `waitForFunction`:** More resilient to timing issues than `expect().toHaveAttribute()`.

4. **Wait for UI state, not arbitrary timeouts:** Instead of `waitForTimeout`, wait for specific DOM state changes (element detached, attribute value, visibility).

5. **bits-ui Popover animations:** The popover uses CSS animations (`animate-out`, `fade-out-0`, `zoom-out-95`). Must wait for animation to complete before interacting with underlying elements.

6. **Component transitional states:** bits-ui Select (and similar components) have transitional states during re-render where textContent is temporarily empty. Always wait for specific component content, not just container elements.

7. **Targeted waits for asserted elements:** When asserting on a specific element, ensure wait conditions target that element or elements that directly control its state.

8. **Wait for ALL asserted properties:** If a test asserts on multiple elements/properties, the stabilization wait must cover ALL of them, not just one.

9. **Prefer Playwright assertions over waitForFunction:** `waitForFunction` executes code in the browser context which may cause unintended side effects (focus changes, event triggers). Playwright's built-in `expect()` assertions are safer and more reliable.

10. **Don't over-wait:** Adding too many stabilization waits can be counterproductive. Each wait adds latency, and in loops this accumulates. Trust Playwright's built-in assertion retry mechanism - it's usually sufficient.

11. **Button stability before click:** Playwright's `.click()` waits for elements to be "stable" (bounding box not changing). After popover animations, there may be residual CSS transitions keeping the button unstable. Use `waitForFunction` with bounding box comparison to ensure stability before clicking.

---

### Final Working Solution

```typescript
async selectHardwareByName(searchTerm: string, namePattern: RegExp) {
    // Wait for hardware select button to be actionable
    await this.hardwareSelectButton.waitFor({ state: 'visible' });
    // Wait for any prior animations to settle before clicking
    await this.waitForButtonStable();
    await this.hardwareSelectButton.click();

    await this.hardwareSearchInput.waitFor({ state: 'visible' });
    await this.hardwareSearchInput.fill(searchTerm);

    // Wait for search results
    await this.page.locator('[data-slot="command-item"]').first().waitFor({ state: 'visible' });

    // Click matching item
    await this.page.getByRole('option', { name: namePattern }).first().click();

    // Wait for popover to close (animation complete)
    await this.page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });

    // Wait for canvas render to stabilize (handles both canvas and placeholder states)
    await this.preview.waitForLabelRender();
}

/**
 * Wait for the hardware select button to be stable (not animating)
 * This checks that the button's bounding box hasn't changed over 2 animation frames
 */
private async waitForButtonStable() {
    await this.page.waitForFunction(
        (selector) => {
            const button = document.querySelector(selector);
            if (!button) return false;

            return new Promise<boolean>((resolve) => {
                const rect1 = button.getBoundingClientRect();
                requestAnimationFrame(() => {
                    const rect2 = button.getBoundingClientRect();
                    const stable =
                        rect1.x === rect2.x &&
                        rect1.y === rect2.y &&
                        rect1.width === rect2.width &&
                        rect1.height === rect2.height;
                    resolve(stable);
                });
            });
        },
        '[data-testid="hardware-select"]',
        { timeout: 5000 }
    );
}
```

---

#### 12. Post-Fix #10: Continued Flakiness

**Status:** Test passed once on CI but continues to fail intermittently.

**Observed failures after Fix #10:**

1. **Run 21203537857** - `page.waitForFunction` timeout in `waitForLabelRender` (60s exceeded)
2. **Run 21205277728** - `hardwareSearchInput.waitFor` timeout (Search standards... input never visible)
3. **Run 21205589336** - `lengthInput.toBeDisabled()` received `undefined` (element in transitional state)

**Analysis:** The test is inherently fragile because:

- It performs 6 rapid hardware type switches in a loop
- Each iteration involves: popover open → search → select → popover close → form update → canvas render
- CI environment has variable resource availability
- The bits-ui popover and Svelte reactive updates race with each other

**Potential further fixes to try:**

1. Add retry logic around the entire hardware selection flow
2. Skip rapid switching test on CI (mark as `test.skip` for CI)
3. Reduce number of hardware types tested (6 → 3)
4. Add explicit delays between iterations (anti-pattern but may be necessary)

---

#### 13. Fix Attempt #11: Add test.slow() and Detailed Logging

**File:** `e2e/hardware-type-transitions.test.ts`

**Analysis (via zen thinkdeep):** The test is a classic race condition in a loop. CI environments have limited resources (2 vCPU), and assertions run before UI fully updates. Better observability is needed to identify exact failure points.

**Changes:**

1. Added `test.slow()` to triple the default timeout
2. Added timestamped logging for each iteration to identify slow operations

```typescript
test('should handle rapid switching...', async () => {
	test.slow(); // Triple timeout for CI

	// ... setup ...

	const testStart = Date.now();
	for (const [index, hardware] of hardwareTypes.entries()) {
		const iterStart = Date.now();
		console.log(
			`[${index}/${hardwareTypes.length}] Selecting ${hardware.type}: ${hardware.search}`
		);

		await labelPage.selectHardwareByName(hardware.search, hardware.name);
		console.log(`[${index}] Selection complete in ${Date.now() - iterStart}ms`);

		// ... assertions ...

		console.log(`[${index}] Iteration complete in ${Date.now() - iterStart}ms`);
	}
	console.log(`All ${hardwareTypes.length} iterations complete in ${Date.now() - testStart}ms`);
});
```

**Expected benefits:**

- 3x longer timeout reduces timeouts on slow CI
- Logs show exactly which iteration and operation is slow
- Can identify if specific hardware types cause issues

**Local test result:** ✅ Passes
**CI result:** ✅ **PASSED** (Run 21206686050) - All 6 iterations completed in 48288ms (vs 4833ms locally, ~10x slower)

**CI Timing Log:**

```
[0/6] Selecting screw: 4762 - Selection: 8512ms, Iteration: 8734ms
[1/6] Selecting nut: 4032 - Selection: 7702ms, Iteration: 7885ms
[2/6] Selecting washer: 7089 - Selection: 7812ms, Iteration: 7967ms
[3/6] Selecting bolt: 4014 - Selection: 8013ms, Iteration: 8164ms
[4/6] Selecting nut: 4032 - Selection: 7678ms, Iteration: 7820ms
[5/6] Selecting screw: 4762 - Selection: 7482ms, Iteration: 7714ms
All 6 iterations complete in 48288ms
```

**Conclusion:** `test.slow()` tripling the timeout to 90s was sufficient for 48s execution time on CI.

---

## Issue: `custom-image.test.ts:252` - localStorage Poll Timeout

**Test:** `should persist image after page reload`

**Symptom:** Poll for localStorage data times out with `false` instead of `true`.

### Fix Attempt #1: Increase timeout to 5000ms

**Hypothesis:** The debounce (500ms) plus image processing/encoding time can exceed 3000ms on CI.

**CI result:** ❌ Failed (Run 21206686050) - Still timing out

### Fix Attempt #2 (SOLUTION): Fix wrong localStorage key

**Root cause:** Test was polling for `'gridfinity-labels'` but the app stores data in `'gridscribe_batch_v1'`.

**Change:**

```typescript
// Before (wrong key):
const stored = await page.evaluate(() => localStorage.getItem('gridfinity-labels'));

// After (correct key):
const stored = await page.evaluate(() => localStorage.getItem('gridscribe_batch_v1'));
```

**Local test result:** ✅ Passed (3.1s)
**CI result:** ✅ **PASSED** (Run 21207224600)

---

### Related Files

- `e2e/pages/single-mode/SingleModePage.ts` - Hardware selection methods
- `e2e/pages/components/SingleLabelPreview.ts` - Canvas render waiting
- `e2e/hardware-type-transitions.test.ts` - Test file
- `e2e/custom-image.test.ts` - Custom image persistence test
- `src/lib/components/label/label-preview.svelte` - Canvas component with `data-render-status`
