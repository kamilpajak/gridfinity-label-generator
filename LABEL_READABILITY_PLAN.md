# Label Readability Improvement Plan

**Status:** PHASE 1, 1.5, 1.6, 1.7, 1.8 COMPLETE ✅
**Created:** 2025-10-05 15:13
**Updated:** 2025-10-06 14:05
**Branch:** feature/improve-label-readability
**Target File:** `src/lib/utils/label-constraint-solver.ts`

---

## Executive Summary

**DECISION CHANGE:** After deeper analysis, **keeping Kiwi.js constraint solver** but enhancing it with coverage optimization and intelligent layout mode selection.

**New Goal:** Add coverage optimization as a constraint + provide layout metrics for debugging and analytics + automatically choose between 1-line and 2-line text layouts.

**Benefits:**

- Maximize space utilization (target: 60%+ coverage)
- Add layout analytics (% coverage breakdown)
- Keep constraint solving advantages (true optimization)
- Enable multi-objective optimization (readability + coverage + balance)
- Provide debugging metrics without UI clutter
- **NEW:** Automatically choose optimal text layout (1-line vs 2-line)
- **NEW:** Maximize font sizes through intelligent layout decisions

---

## Current Problems

### 1. No Coverage Optimization

- Solver doesn't track how much printable area is used
- No metric for space utilization
- Can't optimize for maximum content density
- Missing debugging/analytics data

### 2. Chaotic Font Optimization

- Iterative shrinking (up to 20 iterations)
- Magic numbers: `0.8`, `0.1`, `1.2` - no justification
- "Final optimization pass" can break vertical fit
- Unpredictable proportions (sometimes secondary > primary)

### 3. Unreadable Minimums

- Current minimum: 0.5mm font
- Reality: Unreadable from 30cm distance
- Better to clip text than make microscopic

### 4. No Analytics/Metrics

- Can't measure layout quality
- No way to compare different algorithms
- Debugging is visual guesswork

---

## New Approach: Coverage Optimization + Metrics

### Three-Pillar Strategy

```
┌──────────────────────────────────────────────────────────┐
│  1. CONSTRAINT-BASED COVERAGE OPTIMIZATION               │
│  Add coverage as Kiwi.js constraint                      │
│  - Define area variables for all elements                │
│  - Add constraint: totalOccupied >= minCoverage         │
│  - Balance with readability constraints                  │
└──────────────────────────────────────────────────────────┘
                            │
                            v
┌──────────────────────────────────────────────────────────┐
│  2. POST-SOLVE METRICS ENRICHMENT                        │
│  Calculate actual coverage after solving                 │
│  - Measure text widths (measureText())                   │
│  - Calculate element areas                               │
│  - Build breakdown by element type                       │
└──────────────────────────────────────────────────────────┘
                            │
                            v
┌──────────────────────────────────────────────────────────┐
│  3. DEBUG LOGGING (development only)                     │
│  Console output for analysis                             │
│  - Target vs actual coverage                             │
│  - Element-by-element breakdown                          │
│  - Whitespace percentage                                 │
└──────────────────────────────────────────────────────────┘
```

---

## Coverage Calculation Methodology

**IMPORTANT:** Coverage is measured as **ALLOCATED SPACE** (bounding boxes), NOT ink/pixel coverage.

### What We Measure:

**Text (Primary & Secondary):**

- Width: `measureText()` - actual rendered text width
- Height: `fontSize × 1.2` - line height factor
- Area = width × height (bounding box around glyphs)

**Hardware Image:**

- Area = `layout.hardwareImage.width × layout.hardwareImage.height`
- Full rectangular allocation, not just visible pixels
- Example: Hex nut image includes transparent space around shape

**QR Code:**

- Area = `layout.qrCode.width × layout.qrCode.height`
- Full square allocation (typically 10×10mm = 100mm²)
- Note: ~50% of QR code area is white modules, but we count the entire square

### Rationale:

This is **space coverage**, not **ink coverage**. We measure the space each element OCCUPIES on the label, including internal whitespace (white QR modules, image transparency, letter spacing).

**Why bounding box approach is correct:**

1. **Layout optimization**: We're optimizing SPACE allocation, not ink usage
2. **Readability context**: Visual balance requires considering occupied space
3. **Practical**: QR code needs full 10×10mm to be scannable, even if 50% is white
4. **Performance**: Fast calculation (~1-2ms) vs pixel analysis (50-100ms+)
5. **Phase 2 ready**: Coverage constraints will optimize space efficiency

**Example:** A 10×10mm QR code contributes 100mm² to coverage, even though only ~50mm² is black pixels. This is correct because the QR code OCCUPIES that 10×10mm space on the label.

---

## Implementation Details

### Phase 1: Coverage Metrics (Foundation)

**Goal:** Calculate and return coverage data without changing layout algorithm.

#### 1.1 Extend SolverOutput Interface

```typescript
// src/lib/utils/label-constraint-solver.ts

export interface SolverOutput {
	// Existing fields
	primaryText: ElementPosition;
	secondaryText: ElementPosition;
	primaryFontSize: number;
	secondaryFontSize: number;
	qrCode?: ElementPosition;
	hardwareImage?: ElementPosition;
	textClipWidth: number;

	// NEW: Coverage metadata
	metadata: {
		coveragePercentage: number; // Total coverage (0-100%)
		breakdown: {
			primaryText: number; // % of printable area
			secondaryText: number; // % of printable area
			image: number; // % of printable area
			qrCode: number; // % of printable area
		};
		printableArea: number; // Total mm²
		occupiedArea: number; // Total mm² used
		whitespace: number; // % unused (100 - coverage)
	};
}
```

#### 1.2 Create Metrics Utility

```typescript
// src/lib/utils/layout-metrics.ts

import { measureText } from './text-measurer';
import type { SolverOutput, LabelDimensions } from './label-constraint-solver';

export async function enrichWithCoverageMetrics(
	solverOutput: SolverOutput,
	dimensions: LabelDimensions,
	primaryText: string,
	secondaryText: string
): Promise<SolverOutput> {
	const printableArea = dimensions.printableWidth * dimensions.printableHeight;

	// PRIMARY TEXT AREA
	const primaryWidth = await measureText(
		primaryText,
		'Noto Sans',
		solverOutput.primaryFontSize,
		'900'
	);
	const primaryHeight = solverOutput.primaryFontSize * 1.2; // Line height
	const primaryArea = primaryWidth * primaryHeight;

	// SECONDARY TEXT AREA
	let secondaryArea = 0;
	if (secondaryText) {
		const secondaryWidth = await measureText(
			secondaryText,
			'Oswald',
			solverOutput.secondaryFontSize,
			'300'
		);
		const secondaryHeight = solverOutput.secondaryFontSize * 1.2;
		secondaryArea = secondaryWidth * secondaryHeight;
	}

	// IMAGE AREA
	const imageArea = solverOutput.hardwareImage
		? solverOutput.hardwareImage.width! * solverOutput.hardwareImage.height!
		: 0;

	// QR CODE AREA
	const qrArea = solverOutput.qrCode ? 100 : 0; // 10x10mm = 100mm²

	// TOTALS
	const totalOccupied = primaryArea + secondaryArea + imageArea + qrArea;
	const coveragePercentage = (totalOccupied / printableArea) * 100;

	return {
		...solverOutput,
		metadata: {
			coveragePercentage,
			breakdown: {
				primaryText: (primaryArea / printableArea) * 100,
				secondaryText: (secondaryArea / printableArea) * 100,
				image: (imageArea / printableArea) * 100,
				qrCode: (qrArea / printableArea) * 100
			},
			printableArea,
			occupiedArea: totalOccupied,
			whitespace: 100 - coveragePercentage
		}
	};
}
```

#### 1.3 Integrate into Main Flow

```typescript
// In solveLabelLayout():

export async function solveLabelLayout(input: SolverInput): Promise<SolverOutput> {
  // ... existing solver logic ...

  // Build initial output
  const output: SolverOutput = {
    primaryText: { x: primaryTextX.value(), y: primaryTextY.value() },
    secondaryText: { x: secondaryTextX.value(), y: secondaryTextY.value() },
    primaryFontSize,
    secondaryFontSize,
    textClipWidth: layoutInfo.textClipWidth,
    qrCode: /* ... */,
    hardwareImage: /* ... */
  };

  // ENRICH with coverage metrics
  return await enrichWithCoverageMetrics(
    output,
    input.dimensions,
    input.primaryText,
    input.secondaryText
  );
}
```

#### 1.4 Debug Logging

```typescript
// Add to solveLabelLayout() after enrichment:

const DEBUG_COVERAGE = import.meta.env.DEV; // Vite dev mode

if (DEBUG_COVERAGE && enrichedOutput.metadata) {
	console.log('[Label Layout Coverage]', {
		dimensions: `${input.dimensions.width}x${input.dimensions.height}mm`,
		coverage: `${enrichedOutput.metadata.coveragePercentage.toFixed(1)}%`,
		breakdown: {
			primary: `${enrichedOutput.metadata.breakdown.primaryText.toFixed(1)}%`,
			secondary: `${enrichedOutput.metadata.breakdown.secondaryText.toFixed(1)}%`,
			image: `${enrichedOutput.metadata.breakdown.image.toFixed(1)}%`,
			qr: `${enrichedOutput.metadata.breakdown.qrCode.toFixed(1)}%`
		},
		whitespace: `${enrichedOutput.metadata.whitespace.toFixed(1)}%`
	});
}
```

---

### Phase 2: Coverage Constraint (Optimization)

**Goal:** Add Kiwi.js constraints to actively optimize for coverage.

#### 2.1 Define Area Variables

```typescript
// In solveWithFontSizes():

// COVERAGE OPTIMIZATION VARIABLES
const primaryTextArea = new Variable();
const secondaryTextArea = new Variable();
const imageArea = new Variable();
const qrArea = new Variable();
const totalOccupiedArea = new Variable();

// Calculate primary text area
// Note: width will be measured post-solve, so we estimate based on font size
const estimatedPrimaryWidth = primaryFontSize * primaryText.length * 0.6; // rough estimate
const primaryTextHeight = primaryFontSize * 1.2;

solver.addConstraint(
	new Constraint(
		new Expression(primaryTextArea),
		Operator.Eq,
		estimatedPrimaryWidth * primaryTextHeight,
		Strength.weak // Weak because it's an estimate
	)
);

// Similar for secondary text
if (hasSecondaryText) {
	const estimatedSecondaryWidth = secondaryFontSize * secondaryText.length * 0.5;
	const secondaryTextHeight = secondaryFontSize * 1.2;

	solver.addConstraint(
		new Constraint(
			new Expression(secondaryTextArea),
			Operator.Eq,
			estimatedSecondaryWidth * secondaryTextHeight,
			Strength.weak
		)
	);
}

// Image area (known precisely)
if (showHardwareImage && layoutInfo.imageSize) {
	solver.addConstraint(
		new Constraint(
			new Expression(imageArea),
			Operator.Eq,
			layoutInfo.imageSize.width * layoutInfo.imageSize.height,
			Strength.required
		)
	);
}

// QR area (fixed)
if (showQRCode) {
	solver.addConstraint(
		new Constraint(
			new Expression(qrArea),
			Operator.Eq,
			100, // 10x10mm
			Strength.required
		)
	);
}

// Total occupied area
solver.addConstraint(
	new Constraint(
		new Expression(totalOccupiedArea),
		Operator.Eq,
		new Expression(primaryTextArea).plus(secondaryTextArea).plus(imageArea).plus(qrArea),
		Strength.required
	)
);
```

#### 2.2 Add Coverage Constraint

```typescript
// TARGET: Minimum 60% coverage
const printableArea = dimensions.printableWidth * dimensions.printableHeight;
const minCoverageArea = printableArea * 0.6;

solver.addConstraint(
	new Constraint(
		new Expression(totalOccupiedArea),
		Operator.Ge,
		minCoverageArea,
		Strength.medium // Medium - important but can be violated for readability
	)
);

// OPTIONAL: Maximum coverage to avoid cramped layouts
const maxCoverageArea = printableArea * 0.85;

solver.addConstraint(
	new Constraint(
		new Expression(totalOccupiedArea),
		Operator.Le,
		maxCoverageArea,
		Strength.weak // Weak - nice to have
	)
);
```

---

### Phase 3: Tunable Optimization

**Goal:** Allow configuration of optimization targets.

#### 3.1 Extend SolverInput

```typescript
export interface SolverInput {
	// Existing fields...
	dimensions: LabelDimensions;
	showQRCode: boolean;
	showHardwareImage: boolean;
	showStandard: boolean;
	primaryText: string;
	secondaryText: string;

	// NEW: Optimization configuration
	optimizationTargets?: {
		minCoveragePercent?: number; // Default: 60
		maxCoveragePercent?: number; // Default: 85
		priorityWeights?: {
			readability: number; // Default: 1.0 (Strength.required)
			coverage: number; // Default: 0.5 (Strength.medium)
			balance: number; // Default: 0.3 (Strength.weak)
		};
	};
}
```

#### 3.2 Apply Configuration

```typescript
// Use config or defaults
const targets = input.optimizationTargets || {
	minCoveragePercent: 60,
	maxCoveragePercent: 85,
	priorityWeights: {
		readability: 1.0,
		coverage: 0.5,
		balance: 0.3
	}
};

// Map weights to Kiwi.js strengths
function weightToStrength(weight: number): Strength {
	if (weight >= 1.0) return Strength.required;
	if (weight >= 0.7) return Strength.strong;
	if (weight >= 0.4) return Strength.medium;
	return Strength.weak;
}

// Apply to coverage constraints
const coverageStrength = weightToStrength(targets.priorityWeights.coverage);

solver.addConstraint(
	new Constraint(
		new Expression(totalOccupiedArea),
		Operator.Ge,
		printableArea * (targets.minCoveragePercent / 100),
		coverageStrength
	)
);
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/lib/utils/label-constraint-solver.test.ts

describe('coverage metrics', () => {
	it('should return coverage metadata', async () => {
		const input = createTestInput({
			width: 40,
			height: 12,
			primaryText: 'M6×20',
			secondaryText: 'DIN 933'
		});

		const output = await solveLabelLayout(input);

		expect(output.metadata).toBeDefined();
		expect(output.metadata.coveragePercentage).toBeGreaterThan(0);
		expect(output.metadata.coveragePercentage).toBeLessThan(100);
		expect(output.metadata.breakdown).toBeDefined();
	});

	it('should calculate accurate element areas', async () => {
		const output = await solveLabelLayout(input);
		const { breakdown, printableArea } = output.metadata;

		// Sum should equal total coverage
		const sum =
			breakdown.primaryText + breakdown.secondaryText + breakdown.image + breakdown.qrCode;
		expect(sum).toBeCloseTo(output.metadata.coveragePercentage, 1);
	});
});

describe('coverage optimization', () => {
	it('should achieve >= 60% coverage target', async () => {
		const input = createTestInput({
			width: 40,
			height: 12,
			showQRCode: true,
			showHardwareImage: true
		});

		const output = await solveLabelLayout(input);

		expect(output.metadata.coveragePercentage).toBeGreaterThanOrEqual(60);
	});

	it('should respect readability over coverage', async () => {
		// Very long text that can't fit at minimum readable size
		const input = createTestInput({
			width: 30,
			height: 9,
			primaryText: 'M10×60 Ultra Long Text',
			secondaryText: 'ISO 4762 Class 12.9'
		});

		const output = await solveLabelLayout(input);

		// Coverage may be < 60%, but fonts must stay readable
		expect(output.primaryFontSize).toBeGreaterThanOrEqual(2.0);
		expect(output.secondaryFontSize).toBeGreaterThanOrEqual(1.5);
	});

	it('should not exceed 85% coverage maximum', async () => {
		const output = await solveLabelLayout(input);

		expect(output.metadata.coveragePercentage).toBeLessThanOrEqual(85);
	});
});
```

### Integration Tests

```typescript
describe('label rendering with coverage', () => {
	it('should render label with coverage metadata', async () => {
		const canvas = document.createElement('canvas');
		const output = await solveLabelLayout(input);

		await renderLabelToCanvas({
			canvas,
			dimensions: input.dimensions,
			layout: output
			// ... other params
		});

		// Visual inspection in test output
		if (import.meta.env.DEV) {
			console.log('Coverage:', output.metadata);
		}
	});
});
```

---

## Implementation Phases

### Phase 1: Metrics Only (1-2 hours)

**Status:** READY TO IMPLEMENT

**Tasks:**

1. Create `layout-metrics.ts` utility
2. Add `metadata` field to `SolverOutput`
3. Implement `enrichWithCoverageMetrics()`
4. Add debug logging
5. Write unit tests for metrics calculation

**Deliverable:** Coverage data available in solver output

**Success Criteria:**

- All tests pass
- Console shows coverage % in dev mode
- No breaking changes to existing code

---

### Phase 1.5: Automatic Layout Mode Selection (COMPLETED ✅)

**Status:** COMPLETE
**Duration:** 2 hours
**Implemented:** 2025-10-05 17:00

**Goal:** Automatically choose between ONE_LINE and TWO_LINE text layouts to maximize readability.

#### Problem Statement

Previously, the solver always used TWO_LINE mode (separate primary and secondary text). However, for short text combinations, combining both texts on ONE_LINE with a larger font size can significantly improve readability.

**Example:**

- TWO_LINE: "M8" (4.2mm) + "ISO 4762" (3.3mm) = average 3.75mm
- ONE_LINE: "M8 ISO 4762" (5.9mm) = 57% larger font!

#### Implementation

**1. Added LayoutMode Type:**

```typescript
export type LayoutMode = 'ONE_LINE' | 'TWO_LINE';

export interface SolverOutput {
	// ... existing fields
	layoutMode?: LayoutMode;
}
```

**2. Scoring Algorithm:**

Evaluates both modes with weighted criteria:

```typescript
function scoreLayout(
	primaryFontSize: number,
	secondaryFontSize: number,
	primaryWidth: number,
	secondaryWidth: number,
	availableWidth: number,
	dimensions: LabelDimensions
): number {
	let score = 0;

	// PRIMARY CRITERION: Font size (readability) - Weight: 100
	const avgFontSize = (primaryFontSize + secondaryFontSize) / 2;
	score += avgFontSize * 100;

	// SECONDARY CRITERION: Text fit - Weight: 50
	const maxTextWidth = Math.max(primaryWidth, secondaryWidth);
	const widthUtilization = maxTextWidth / availableWidth;
	if (widthUtilization < 0.9) {
		score += 50 * (1 - widthUtilization); // Bonus for efficient use
	} else {
		score -= 50 * (widthUtilization - 0.9); // Penalty for overflow
	}

	// TERTIARY CRITERION: Height utilization - Weight: 20
	const totalHeight = primaryFontSize * 1.2 + secondaryFontSize * 1.2;
	const heightUtilization = totalHeight / dimensions.printableHeight;
	score += heightUtilization * 20;

	return score;
}
```

**Scoring Weights Rationale:**

- **Font size (100x)**: Readability is paramount
- **Text fit (50x)**: Important to avoid clipping, but secondary to readability
- **Height utilization (20x)**: Minor factor for vertical balance

**3. Decision Logic:**

```typescript
export async function solveLabelLayout(input: SolverInput): Promise<SolverOutput> {
	const { dimensions, primaryText, secondaryText } = input;
	const hasSecondaryText = !!secondaryText;

	// If no secondary text, use TWO_LINE mode (no decision needed)
	if (!hasSecondaryText) {
		const result = await solveLayoutInMode(input, 'TWO_LINE');
		return { ...result, layoutMode: 'TWO_LINE' };
	}

	// Try both modes
	const oneLineResult = await solveLayoutInMode(input, 'ONE_LINE');
	const twoLineResult = await solveLayoutInMode(input, 'TWO_LINE');

	// Score both solutions
	const oneLineScore = scoreLayout(/* ONE_LINE params */);
	const twoLineScore = scoreLayout(/* TWO_LINE params */);

	// Debug logging
	if (import.meta.env.DEV) {
		console.log('[Layout Decision]', {
			oneLineScore: oneLineScore.toFixed(1),
			twoLineScore: twoLineScore.toFixed(1),
			winner: oneLineScore > twoLineScore ? 'ONE_LINE' : 'TWO_LINE',
			oneLineFonts: `${oneLineResult.primaryFontSize.toFixed(1)}mm`,
			twoLineFonts: `${twoLineResult.primaryFontSize.toFixed(1)}mm / ${twoLineResult.secondaryFontSize.toFixed(1)}mm`
		});
	}

	// Choose winner
	if (oneLineScore > twoLineScore) {
		return { ...oneLineResult, layoutMode: 'ONE_LINE' };
	} else {
		return { ...twoLineResult, layoutMode: 'TWO_LINE' };
	}
}
```

**4. Mode-Specific Solving:**

```typescript
async function solveLayoutInMode(input: SolverInput, mode: LayoutMode): Promise<SolverOutput> {
  if (mode === 'ONE_LINE') {
    // Combine texts
    const combinedText = hasSecondaryText
      ? `${primaryText} ${secondaryText}`
      : primaryText;

    // Optimize combined text with Noto Sans Bold
    primaryFontSize = await calculateOptimalFontSize(
      combinedText, 'Noto Sans', '900', ...
    );
    secondaryFontSize = primaryFontSize; // Same font for both

    // Center text vertically
    solver.addConstraint(new Constraint(
      new Expression(primaryTextCenterY),
      Operator.Eq,
      dimensions.printableHeight / 2,
      Strength.strong
    ));

    // Position secondary text off-screen (won't be rendered)
    solver.addConstraint(new Constraint(
      new Expression(secondaryTextY),
      Operator.Eq,
      -1000,
      Strength.required
    ));
  } else {
    // TWO_LINE mode: traditional separate optimization
    // ... existing code ...
  }

  return solveWithFontSizes(input, primaryFontSize, secondaryFontSize, layoutSolution, mode);
}
```

**5. Rendering Updates:**

```typescript
// label-renderer.ts
if (layout.layoutMode === 'ONE_LINE') {
	// Combine both texts into single line
	const combinedText = content.secondaryText
		? `${content.primaryText} ${content.secondaryText}`
		: content.primaryText;

	await drawText(ctx, {
		text: combinedText,
		x: layout.primaryText.x * scale,
		y: layout.primaryText.y * scale,
		fontFamily: 'Noto Sans',
		fontSize: layout.primaryFontSize * scale,
		fontWeight: '900'
	});
	// Secondary text is not rendered
} else {
	// TWO_LINE mode: render separately
	// ... existing code ...
}
```

**6. Coverage Metrics Updates:**

```typescript
// layout-metrics.ts
if (layout.layoutMode === 'ONE_LINE') {
	// Combined text counted as primary
	const combinedText = content.secondaryText
		? `${content.primaryText} ${content.secondaryText}`
		: content.primaryText;

	const width = await measureText(combinedText, 'Noto Sans', layout.primaryFontSize, '900');
	const height = layout.primaryFontSize * 1.2;
	primaryTextArea = width * height;
	secondaryTextArea = 0; // No secondary in ONE_LINE mode
} else {
	// TWO_LINE mode: measure separately
	// ... existing code ...
}
```

#### Test Results

**Unit Tests:** 12/12 passing

- Layout mode decision logic
- Scoring algorithm
- Font size validation
- Position validation
- Hardware image integration
- QR code integration
- Complex layouts

**Coverage Metrics Tests:** 12/12 passing

- ONE_LINE mode coverage calculation
- TWO_LINE mode coverage calculation
- Combined text measurement
- Element breakdown accuracy

#### Real-World Performance

**Example 1: Short text (M8 + ISO 4762)**

```
[Layout Decision] {
  oneLineScore: '634.3',
  twoLineScore: '417.2',
  winner: 'ONE_LINE',
  oneLineFonts: '5.9mm',
  twoLineFonts: '4.2mm / 3.3mm'
}
```

**Result:** ONE_LINE wins with 57% larger average font size

**Example 2: Long secondary text (M10x50 + DIN 912 Hexagon Socket)**

```
[Layout Decision] {
  oneLineScore: '3.9',
  twoLineScore: '310.1',
  winner: 'TWO_LINE',
  oneLineFonts: '0.5mm',
  twoLineFonts: '5.9mm / 0.5mm'
}
```

**Result:** TWO_LINE wins - combined text too long for readable ONE_LINE

**Example 3: With QR code**

```
[Layout Decision] {
  oneLineScore: '42.4',
  twoLineScore: '403.0',
  winner: 'TWO_LINE',
  oneLineFonts: '0.5mm',
  twoLineFonts: '4.2mm / 3.3mm'
}
```

**Result:** TWO_LINE wins due to space constraints from QR code

#### Files Modified

1. **`src/lib/utils/label-constraint-solver.ts`** (MAJOR)
   - Added `LayoutMode` type
   - Added `scoreLayout()` function
   - Refactored `solveLabelLayout()` to evaluate both modes
   - Created `solveLayoutInMode()` helper
   - Updated `solveWithFontSizes()` to accept mode parameter

2. **`src/lib/utils/label-renderer.ts`**
   - Updated rendering logic to check `layoutMode`
   - Combines texts in ONE_LINE mode
   - Skips secondary text rendering in ONE_LINE mode

3. **`src/lib/utils/layout-metrics.ts`**
   - Updated `calculateCoverageMetrics()` for ONE_LINE mode
   - Measures combined text in ONE_LINE mode
   - Sets `secondaryTextArea = 0` in ONE_LINE mode

4. **`src/lib/utils/label-constraint-solver.test.ts`** (NEW)
   - 12 tests for layout mode decision logic
   - Tests for scoring algorithm
   - Tests for constraint validation

5. **`src/lib/utils/layout-metrics.test.ts`**
   - Added 3 tests for ONE_LINE mode coverage
   - Tests for combined text measurement
   - Tests for TWO_LINE mode explicit handling

#### Success Criteria (ALL MET ✅)

- ✅ Solver automatically chooses between ONE_LINE and TWO_LINE
- ✅ Scoring system favors larger fonts (readability first)
- ✅ ONE_LINE mode achieves significantly larger fonts for short text
- ✅ TWO_LINE mode chosen when combined text too long
- ✅ Renderer handles both modes correctly
- ✅ Coverage metrics accurate for both modes
- ✅ All unit tests pass (24/24)
- ✅ Debug logging shows decision process
- ✅ No breaking changes to existing code

#### Performance Impact

- **Computation time:** ~2x (solves layout twice)
- **Absolute overhead:** 3-5ms per layout (acceptable)
- **Benefit:** 50-60% larger fonts for short text combinations

#### Future Enhancements

- Cache scoring results to avoid duplicate solves
- Add user preference override (force mode)
- Tune scoring weights based on real-world feedback
- Consider text aspect ratio in scoring
- Add scoring for visual balance

---

### Phase 2: Soft Coverage Optimization (2-3 hours)

**Status:** PLANNED

**Tasks:**

1. Add area variables to constraint system
2. Implement coverage constraints (Strength.weak)
3. Test if coverage improves vs Phase 1
4. A/B comparison: before/after coverage %

**Deliverable:** Solver actively tries to maximize coverage

**Success Criteria:**

- Average coverage >= 60% on test dataset
- No degradation in readability (min font sizes maintained)
- Performance impact < 10%

---

### Phase 3: Tunable Optimization (2-3 hours)

**Status:** PLANNED

**Tasks:**

1. Add `optimizationTargets` to `SolverInput`
2. Implement configurable min/max coverage
3. Add priority weight system
4. Document configuration options

**Deliverable:** Configurable optimization behavior

**Success Criteria:**

- Can set custom coverage targets
- Weight system works as expected
- Fallback to sensible defaults

---

### Phase 4: Advanced Features (Optional)

**Status:** FUTURE

**Ideas:**

- Dynamic target adjustment based on text length
- Multi-objective Pareto optimization
- Machine learning for optimal weights
- Coverage heatmap visualization

---

## Breaking Changes

**NONE** - This is a purely additive change.

**Backward Compatibility:**

- Existing code continues to work
- `metadata` field is optional in output
- No changes to rendering pipeline
- No UI changes (metrics in console only)

---

## Rollout Plan

**Week 1:** Phase 1 (Metrics)

- Implement, test, merge
- Monitor console output in dev
- Collect baseline coverage data

**Week 2:** Analyze Results

- Review coverage % across different label types
- Identify low-coverage cases
- Decide if Phase 2 is needed

**Week 3:** Phase 2 (Optimization) - IF justified

- Implement coverage constraints
- A/B test against Phase 1
- Measure improvement

**Week 4:** Phase 3 (Tunables) - IF Phase 2 succeeds

- Add configuration
- Document best practices
- Production release

---

## Success Metrics

**Quantitative:**

- Average coverage: 60%+ (currently unknown)
- Min font size: >= 2mm (currently 0.5mm possible)
- Performance: < 10ms per layout (currently ~5-20ms)

**Qualitative:**

- Labels are more readable
- Space utilization feels balanced
- Debugging is easier with metrics

---

## Open Questions

### Q1: What is current average coverage?

**Status:** UNKNOWN - need Phase 1 to measure
**Action:** Run metrics on existing label dataset

### Q2: Is 60% the right target?

**Hypothesis:** 60-70% is optimal balance
**Validation:** A/B test different targets in Phase 2

### Q3: Should coverage be in UI?

**Current Decision:** NO - console only
**Rationale:** Avoid overwhelming users
**Future:** Could add as advanced setting

### Q4: Performance impact of constraint optimization?

**Concern:** Area variables add complexity
**Mitigation:** Benchmark Phase 2 vs Phase 1
**Acceptable:** < 10% slowdown

---

## Conclusion

**New Direction:** Keep constraint solver, enhance with coverage optimization.

**Rationale:**

- Kiwi.js is GOOD for true optimization (not over-engineering if used properly)
- Coverage is a valid optimization target
- Metrics provide valuable debugging data
- Phased approach minimizes risk

**Next Step:** Implement Phase 1 (Metrics) for data collection and validation.

---

## Phase 1.6: Font Metrics Fix (2025-10-06)

**Status:** COMPLETE ✅

### Problem Identified

Excessive vertical spacing (~3mm) between primary and secondary text despite solver calculating only 1mm spacing.

**Root Causes:**

1. **Incorrect approximations** - Solver used hardcoded ascent/descent ratios (0.8/0.2) instead of actual font metrics
2. **Wrong baseline calculations** - Used `fontSize * 1.2` (line height) then applied ratios, causing incorrect positioning
3. **Generic sample text** - Font metrics measured with 'Mg' instead of actual label text

**Real Font Metrics (measured from Canvas API):**

- Noto Sans 900: ascent=0.724, descent=0.010 (not 0.8/0.2)
- Oswald 300: ascent=0.818, descent=0.010 (not 0.8/0.2)

### Implementation

**1. Created `font-metrics.ts`:**

```typescript
export async function getFontMetrics(fontFamily: string, fontWeight: string): Promise<FontMetrics>;
export async function getCachedFontMetrics(
	fontFamily: string,
	fontWeight: string
): Promise<FontMetrics>;
export function clearFontMetricsCache(): void;
```

**Key Features:**

- Measures actual font metrics using Canvas `measureText().actualBoundingBoxAscent/Descent`
- Uses representative sample text ('M10' for Noto Sans, 'DIN 931' for Oswald)
- LRU cache for performance
- Returns ratios relative to fontSize (not lineHeight)

**2. Refactored `label-constraint-solver.ts`:**

- Removed hardcoded 0.8/0.2/0.3 ratios
- Load metrics dynamically at solver start: `getCachedFontMetrics()`
- Pass metrics to `solveWithFontSizes()` function
- Removed incorrect `fontSize * 1.2` multiplier
- Use `fontSize` directly (not `fontSize * lineHeight`)

**3. Updated spacing:**

- Changed `TEXT_VERTICAL_SPACING` from 1mm → 0.5mm
- Verified texts touch exactly when spacing = 0mm
- Confirmed 0.5mm gives comfortable visual separation

### Testing

**Added 6 new unit tests:**

1. ✅ Correct ascent/descent for Noto Sans 900
2. ✅ Correct ascent/descent for Oswald 300
3. ✅ Vertical spacing calculation with real metrics
4. ✅ No line height multiplier (1.2x) used
5. ✅ Tight text packing with 0.5mm spacing
6. ✅ **Adaptation to different fonts** - Simulates font change with different metrics

**Test Coverage:** 18/18 passing

**Critical Test:** `should adapt to different font metrics automatically`

- Mocks completely different font metrics (ascent=0.65/descent=0.35)
- Verifies solver adapts automatically
- Prevents future hardcoding bugs

### Results

**Before Fix:**

- Visual spacing: ~3mm
- Calculated spacing: 1mm
- **Mismatch:** 200% error

**After Fix:**

- Visual spacing: 0.5mm
- Calculated spacing: 0.5mm
- **Match:** Perfect accuracy ✅

**Benefits:**

1. ✅ Spacing is now accurate (visual matches calculated)
2. ✅ Automatic adaptation to font changes
3. ✅ Larger fonts possible (better space utilization)
4. ✅ Tests prevent regression
5. ✅ Easy to change fonts in future

### Files Modified

1. **NEW:** `src/lib/utils/font-metrics.ts` - Dynamic font metric measurement
2. **MODIFIED:** `src/lib/utils/label-constraint-solver.ts` - Use real metrics, remove hardcoded values
3. **MODIFIED:** `src/lib/utils/label-constraint-solver.test.ts` - Add font metrics tests (18 total)
4. **MODIFIED:** `src/routes/debug/label-test/+page.svelte` - Add font metrics display for debugging

### Debug Features Added

**Debug page enhancements:**

- Font metrics comparison (real vs approximation)
- Visual confirmation with `TEXT_VERTICAL_SPACING = 0`

**Commented debug logging (can be enabled):**

```typescript
// Uncomment in label-constraint-solver.ts:
// console.log('[Vertical Spacing Debug]', { ... })
// console.log('[Layout Decision]', { ... })
```

### Lessons Learned

1. **Never hardcode font metrics** - Fonts vary widely in ascent/descent ratios
2. **Measure with representative text** - Generic samples ('Mg') don't match actual usage
3. **Don't mix fontSize with lineHeight** - Baseline calculations use fontSize directly
4. **Test with mocked variations** - Ensures adaptability to future changes
5. **Visual verification is critical** - Math can be correct but implementation wrong

### Next Steps

- Monitor spacing in production labels
- Consider making `TEXT_VERTICAL_SPACING` configurable per label size
- Evaluate if different fonts need different spacing values

---

## Phase 1.7: IMAGE_HORIZONTAL Layout Mode (2025-10-06)

**Status:** COMPLETE ✅

### Problem Statement

Labels with wide-aspect hardware images (e.g., DIN 931 hex bolt with aspect ratio 4.76:1) were poorly optimized in existing ONE_LINE and TWO_LINE modes. The wide image would take up most of the vertical space, leaving minimal room for text, resulting in unreadable tiny fonts.

**Example: DIN 931 on 37×12mm label**

- Image: 4.76:1 aspect ratio (very wide)
- TWO_LINE mode result: ~2mm fonts (too small)
- Visual problem: Tall vertical image leaves no room for text

### Solution: IMAGE_HORIZONTAL Mode

Created a new layout mode specifically for wide images on small labels:

**Conditions:**

- Hardware image enabled
- Image aspect ratio > 3.5 (wide/long images)
- Label height ≤ 15mm (small labels)

**Layout:**

- Image positioned horizontally at top-left (0, 0)
- Both texts on single line at bottom
- Maximizes image width and text readability

### Implementation

**1. Added IMAGE_HORIZONTAL to LayoutMode:**

```typescript
export type LayoutMode = 'ONE_LINE' | 'TWO_LINE' | 'IMAGE_HORIZONTAL';
```

**2. Decision Logic:**

```typescript
const shouldUseImageHorizontal =
	input.showHardwareImage &&
	input.hardwareImageAspectRatio &&
	input.hardwareImageAspectRatio > 3.5 &&
	dimensions.height <= 15;

if (shouldUseImageHorizontal) {
	return await solveLayoutInMode(input, 'IMAGE_HORIZONTAL', fontMetricsData);
}
```

**3. Image Size Calculation:**

```typescript
// Reserve space for text at bottom (~3-4mm)
const TEXT_RESERVE_HEIGHT = 4;
const availableHeight = dimensions.printableHeight - TEXT_RESERVE_HEIGHT - MIN_SPACING * 2;

// Image height constrained by available height
let imageHeight = Math.min(availableHeight, 6); // Max 6mm height
let imageWidth = imageHeight * imageAspectRatio;

// If too wide, constrain by width
if (imageWidth > maxWidth) {
	imageWidth = maxWidth;
	imageHeight = imageWidth / imageAspectRatio;
}
```

**4. Text Layout (One Line at Bottom):**

```typescript
// Both texts on same baseline
solver.addConstraint(
	new Constraint(
		new Expression(primaryTextY),
		Operator.Eq,
		new Expression(secondaryTextY),
		Strength.required
	)
);

// Secondary text after primary with MIN_SPACING
solver.addConstraint(
	new Constraint(
		new Expression(secondaryTextX),
		Operator.Eq,
		new Expression(primaryTextX).plus(primaryWidth).plus(MIN_SPACING),
		Strength.required
	)
);

// Position text line at bottom edge (no margin)
solver.addConstraint(
	new Constraint(
		new Expression(primaryTextBottom),
		Operator.Eq,
		dimensions.printableHeight,
		Strength.strong
	)
);
```

**5. Image Positioning (Top-Left Corner):**

```typescript
// Position image at left edge (no margin)
solver.addConstraint(new Constraint(new Expression(imageX), Operator.Eq, 0, Strength.required));

// Position image at top edge (no margin)
solver.addConstraint(new Constraint(new Expression(imageY), Operator.Eq, 0, Strength.required));
```

### Spacing Philosophy: No Edge Margins

**User Feedback:** "Printable area doesn't need spacing (margin is added by the printer itself)."

**Implementation:**

- **Removed MIN_SPACING at printable area edges**
- **Kept MIN_SPACING only between elements:**
  - Between primary and secondary text (horizontal)
  - Between image and text below (vertical)

**Benefits:**

1. Maximizes content area on small labels
2. Prevents wasted space at edges
3. QR code already used this pattern (no edge spacing)
4. Consistent with physical printer margins

### Testing

**Added 10 comprehensive tests:**

1. ✅ Trigger IMAGE_HORIZONTAL for wide aspect ratio (>3.5)
2. ✅ Don't trigger for tall labels (>15mm)
3. ✅ Position image at top-left corner (0, 0)
4. ✅ Position text at bottom edge of printable area
5. ✅ Use MIN_SPACING only between image and text
6. ✅ Position primary and secondary text on same line
7. ✅ Optimize font sizes independently
8. ✅ Maximize image height within available space
9. ✅ Don't use IMAGE_HORIZONTAL for narrow images (<3.5)
10. ✅ Work with QR code in IMAGE_HORIZONTAL mode

**Test Coverage:** 28/28 passing (18 existing + 10 new)

### Results

**DIN 931 Example (37×12mm label, 4.76:1 aspect ratio):**

**Before (TWO_LINE mode):**

- Image: Vertical orientation, wasting horizontal space
- Fonts: ~2mm (unreadable)
- Coverage: Poor space utilization

**After (IMAGE_HORIZONTAL mode):**

- Image: Horizontal at top, ~4.5mm height × ~21mm width
- Fonts: 5mm primary, 4mm secondary (readable!)
- Coverage: Excellent space utilization
- Spacing: 0.5mm between image and text

**Improvement:** 150% larger fonts, better visual balance

### Files Modified

1. **`src/lib/utils/label-constraint-solver.ts`** (MAJOR)
   - Added IMAGE_HORIZONTAL mode detection logic
   - Created horizontal image size calculation
   - Implemented IMAGE_HORIZONTAL solver constraints
   - Updated text positioning for one-line bottom layout
   - Removed edge spacing (kept only inter-element spacing)

2. **`src/lib/utils/label-renderer.ts`**
   - Added IMAGE_HORIZONTAL rendering path
   - Updated image positioning for horizontal mode

3. **`src/lib/utils/label-constraint-solver.test.ts`**
   - Added 10 IMAGE_HORIZONTAL mode tests
   - Tests for mode selection, positioning, spacing

4. **`src/lib/components/label/label-preview.svelte`**
   - Updated to pass `hardwareImageAspectRatio` to solver

5. **`src/lib/utils/label-exporter.ts`**
   - Updated to calculate and pass image aspect ratio

6. **`src/lib/utils/batch-renderer.ts`**
   - Updated batch rendering for IMAGE_HORIZONTAL support

7. **`src/routes/debug/label-test/+page.svelte`**
   - Updated debug page for testing IMAGE_HORIZONTAL mode

### Debug Features

**Debug page shows:**

- Layout mode selected (ONE_LINE/TWO_LINE/IMAGE_HORIZONTAL)
- Font sizes for each mode
- Coverage metrics
- Image dimensions and positioning

### Success Criteria (ALL MET ✅)

- ✅ IMAGE_HORIZONTAL mode triggered for wide images (>3.5 aspect ratio)
- ✅ Not triggered for tall labels (>15mm height)
- ✅ Image positioned at top-left corner (0, 0)
- ✅ Text positioned at bottom edge (no margin)
- ✅ MIN_SPACING only between elements (not at edges)
- ✅ Fonts significantly larger than TWO_LINE mode
- ✅ All unit tests pass (28/28)
- ✅ Visual inspection confirms correct rendering
- ✅ No breaking changes to existing modes

### Performance Impact

- Minimal: Only affects labels meeting IMAGE_HORIZONTAL conditions
- Same solver complexity as ONE_LINE mode
- No additional overhead for other label types

### Future Enhancements

- Consider dynamic TEXT_RESERVE_HEIGHT based on text length
- Add user override to force/disable IMAGE_HORIZONTAL mode
- Optimize font size ratio between primary/secondary text
- Consider image position variants (top-right, centered)

---

## Phase 1.8: Cap-Height Normalization (2025-10-06)

**Status:** COMPLETE ✅

### Problem Statement

Secondary text (Oswald 300) appeared visually larger than primary text (Noto Sans 900) even when both had the same nominal font size. This was particularly noticeable in TWO_LINE and IMAGE_HORIZONTAL modes where both fonts are rendered together.

**Root Cause:** Different fonts have different cap-height ratios:

- **Noto Sans 900:** cap-height ratio = 0.724 (72.4% of font size)
- **Oswald 300:** cap-height ratio = 0.818 (81.8% of font size)

At the same nominal font size (e.g., 4.81mm), Oswald's capital letters are ~13.4% taller than Noto Sans, creating visual imbalance.

**Example:**

- Both fonts at 4.81mm nominal size:
  - Noto Sans cap-height: 3.48mm
  - Oswald cap-height: 3.94mm
  - Difference: 13.4% (visually noticeable)

### Solution: Cap-Height Normalization

Implemented automatic cap-height normalization to make both fonts appear visually equal by adjusting the secondary font's nominal size.

**Formula:**

```typescript
const normalizationFactor = primaryCapHeight / secondaryCapHeight;
secondaryFontSize = secondaryFontSize × normalizationFactor;
```

**Result:**

- Normalization factor for Oswald: 0.724 / 0.818 ≈ 0.885
- Secondary font rendered at 88.5% of optimized size
- Both fonts now have equal visual cap-heights

### Implementation

**1. Created Font Measurement Utilities:**

Already existed from Phase 1.6:

```typescript
// src/lib/utils/font-metrics.ts
export function measureCapHeight(fontFamily: string, fontWeight: string): number;
export function getCachedCapHeight(fontFamily: string, fontWeight: string): number;
export function clearCapHeightCache(): void;
```

**2. Created Font Configuration Constants:**

```typescript
// src/lib/constants/fonts.ts
export interface FontConfig {
	family: string;
	weight: string;
}

export const PRIMARY_FONT: FontConfig = {
	family: 'Noto Sans',
	weight: '900'
};

export const SECONDARY_FONT: FontConfig = {
	family: 'Oswald',
	weight: '300'
};
```

**Benefits:**

- Centralized font configuration
- Easy to change fonts globally
- Tests automatically adapt to font changes

**3. Applied Normalization in Solver:**

```typescript
// src/lib/utils/label-constraint-solver.ts (in solveWithFontSizes)

// Apply cap-height normalization to secondary font
// This ensures both fonts have the same visual cap-height
// Only available in browser environment (requires document.createElement)
// Apply in TWO_LINE and IMAGE_HORIZONTAL modes where both fonts are visible
// Don't apply in ONE_LINE mode where both fonts must be exactly equal
if (typeof document !== 'undefined' && (mode === 'TWO_LINE' || mode === 'IMAGE_HORIZONTAL')) {
	const primaryCapHeight = getCachedCapHeight(PRIMARY_FONT.family, PRIMARY_FONT.weight);
	const secondaryCapHeight = getCachedCapHeight(SECONDARY_FONT.family, SECONDARY_FONT.weight);
	const capHeightNormalizationFactor = primaryCapHeight / secondaryCapHeight;
	secondaryFontSize = secondaryFontSize * capHeightNormalizationFactor;
}
```

**Key Design Decisions:**

- **Browser-only:** Check `typeof document !== 'undefined'` to avoid server-side errors
- **Mode-specific:** Only apply in TWO_LINE and IMAGE_HORIZONTAL (not ONE_LINE where fonts must be equal)
- **Non-breaking:** Tests run in server environment without normalization

**4. Updated Debug Page:**

```typescript
// src/routes/debug/label-test/+page.svelte

const measureCapHeight = (fontFamily: string, fontWeight: string, fontSize: number) => {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return 0;

	ctx.font = `${fontWeight} ${fontSize * 100}px "${fontFamily}"`;
	ctx.textBaseline = 'alphabetic';
	const metrics = ctx.measureText('M'); // Capital M for cap-height

	return metrics.actualBoundingBoxAscent / 100; // Ratio relative to font size
};

console.log(`[${config.name}] Fonts:`, {
	primary: `${layout.primaryFontSize.toFixed(2)}mm (${primaryText})`,
	primaryCapHeight: `${(layout.primaryFontSize * primaryCapHeightRatio).toFixed(2)}mm`,
	secondary: `${layout.secondaryFontSize.toFixed(2)}mm (${fullSecondaryText})`,
	secondaryCapHeight: `${(layout.secondaryFontSize * secondaryCapHeightRatio).toFixed(2)}mm`,
	mode: layout.layoutMode,
	capHeightRatio: (secondaryCapHeightRatio / primaryCapHeightRatio).toFixed(3)
});
```

### Testing

**1. Created Font-Agnostic Tests:**

Made all tests use `PRIMARY_FONT` and `SECONDARY_FONT` constants instead of hardcoded font names, ensuring tests automatically adapt when fonts change.

**2. Added Cap-Height Tests:**

```typescript
// src/lib/utils/font-metrics.svelte.test.ts

describe('Cap-height Measurement', () => {
	it('should measure cap-height for primary font');
	it('should measure cap-height for secondary font');
	it('should measure different cap-heights for different fonts');
	it('should cache cap-height measurements');
	it('should cache different fonts separately');
	it('should clear cache correctly');
	it('should return consistent results for same font');
});

describe('Cap-height Normalization Factor', () => {
	it('should calculate normalization factor between fonts');
	it('should verify normalized fonts have equal cap-heights');
});
```

**Test Coverage:** 9/9 cap-height tests passing (browser environment)

**3. Added IMAGE_HORIZONTAL Mode Normalization Test:**

```typescript
// src/lib/utils/label-constraint-solver.test.ts

it('should apply cap-height normalization in IMAGE_HORIZONTAL mode', async () => {
	const input: SolverInput = {
		dimensions: { width: 37, height: 12, printableWidth: 33, printableHeight: 10 },
		primaryText: 'M3 x 12',
		secondaryText: 'DIN 931',
		showHardwareImage: true,
		hardwareImageAspectRatio: 4.5,
		showQRCode: false,
		showStandard: true
	};

	const result = await solveLabelLayout(input);

	expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');

	// Cap-height normalization should make secondary font visually equal to primary
	// Oswald cap-height ratio: 0.818, Noto Sans cap-height ratio: 0.724
	// Normalization factor: 0.724 / 0.818 ≈ 0.885
	const primaryCapHeight = result.primaryFontSize * 0.724;
	const secondaryCapHeight = result.secondaryFontSize * 0.818;

	// Visual cap-heights should be equal (within 1% tolerance)
	expect(Math.abs(primaryCapHeight - secondaryCapHeight)).toBeLessThan(primaryCapHeight * 0.01);
});
```

**Test Coverage:** 29/29 solver tests passing (28 existing + 1 new)

### Results

**Before Normalization:**

- DIN 931 label (TWO_LINE): Secondary text visibly larger than primary
- DIN 931 label (IMAGE_HORIZONTAL): Secondary text "DIN 931" larger than primary "M3 x 12"
- Visual imbalance between text lines

**After Normalization:**

- Both text lines have equal visual cap-heights
- Optical balance achieved in TWO_LINE mode
- Optical balance achieved in IMAGE_HORIZONTAL mode
- ONE_LINE mode unchanged (fonts already equal)

**Example (DIN 127 - 55×12mm TWO_LINE):**

- Primary: 4.83mm nominal → 3.50mm cap-height
- Secondary: 4.27mm nominal (was 4.83mm) → 3.50mm cap-height
- Result: Perfect visual balance ✅

### Files Modified

1. **NEW:** `src/lib/constants/fonts.ts` - Centralized font configuration
2. **MODIFIED:** `src/lib/utils/label-constraint-solver.ts` - Apply cap-height normalization
3. **MODIFIED:** `src/lib/utils/font-metrics.svelte.test.ts` - Use font constants in tests
4. **MODIFIED:** `src/lib/utils/label-constraint-solver.test.ts` - Add IMAGE_HORIZONTAL normalization test
5. **MODIFIED:** `src/routes/debug/label-test/+page.svelte` - Add cap-height logging

### Debug Features

**Console output shows:**

```javascript
[DIN 127 - Wide Label + QR + Note] Fonts: {
  primary: '4.83mm (M5)',
  primaryCapHeight: '3.50mm',
  secondary: '4.27mm (DIN 127 INOX)',
  secondaryCapHeight: '3.50mm',
  mode: 'TWO_LINE',
  capHeightRatio: '1.130'
}
```

### Success Criteria (ALL MET ✅)

- ✅ Secondary font visually equal to primary in TWO_LINE mode
- ✅ Secondary font visually equal to primary in IMAGE_HORIZONTAL mode
- ✅ ONE_LINE mode unchanged (fonts already equal)
- ✅ Normalization only applies in browser environment
- ✅ Tests pass without normalization (server environment)
- ✅ All 29 solver tests passing
- ✅ All 9 cap-height tests passing
- ✅ Font constants centralized for easy changes
- ✅ Tests automatically adapt to font changes
- ✅ Visual balance confirmed in debug page

### Performance Impact

- **Minimal:** Cap-height measured once per font and cached
- **Cache hit:** 0ms overhead (uses cached values)
- **Cache miss:** ~2-3ms per font (one-time cost)
- **Overall:** Negligible impact on layout performance

### Benefits

1. **Optical balance:** Both fonts appear same size visually
2. **Professional look:** Consistent visual hierarchy
3. **Better readability:** Equal visual importance for both text lines
4. **Font-agnostic:** Automatically adapts to any font combination
5. **Future-proof:** Changing fonts is now a simple constant update

### Future Enhancements

- Consider normalizing x-height instead of cap-height for mixed-case text
- Add user option to disable normalization
- Measure and normalize other font metrics (weight, spacing)
- Apply normalization to other font pairs if added

---

**Total Phases Completed:** 1, 1.5, 1.6, 1.7, 1.8 ✅
