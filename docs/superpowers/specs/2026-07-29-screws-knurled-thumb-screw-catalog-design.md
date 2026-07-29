# Knurled Thumb Screw Coverage (screw gap, family 9) — Design

**Date:** 2026-07-29
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — increasing coverage; ninth screw-gap family
**Predecessors:** plain hex bolts #123 (85→73), structural/fit hex bolts #124 (73→63),
socket low-head + Torx cheese #125 (63→57), plain studs #126 (57→51), carriage/cup-head bolts
#127 (51→46), countersunk + button socket #128 (46→42), T-head prism bolts #129 (42→40),
hex flange bolt #130 (40→38)

## Context

`coverage.py` reports 38 app-served `screw` standards with no generated drawing. This spec covers the
**knurled thumb screw** (DIN 464 high type, DIN 653 low type): a knurled cylindrical grip head on a
threaded shank, turned by hand. It is the screw cousin of the already-shipped `knurled_nut`, and it
composes entirely from parts already merged and reviewed:

- the **knurled cylinder head** — a revolved cylinder, the same envelope `knurled_nut` draws (the knurl
  is a fine feature and is NOT drawn, exactly like the thread);
- the **shank** — the shared `screw_common._screw_shank`.

So this is **one new generator** (`knurled_screw`) that invents no geometry — it stacks a revolved
cylinder head onto the shared shank. Fusion is face-contact `add()` at the z=0 bearing plane (the
`screw_common` stacking seam), backstopped by a net `volume > 0` and single-solid guard.

## Shape fidelity (why the geometry is what it is)

DIN 464 and DIN 653 are both a knurled cylindrical head over a threaded shank; they differ only in head
height (DIN 464 "high"/tall, DIN 653 "low"/flat). The head is one straight-walled knurled cylinder with
a flat top and a small chamfer breaking the top rim. Verified against vendor drawings (DIN 464 / DIN 653
datasheets) as this form.

- **Knurl omitted (flagged).** The defining feature of a real DIN 464/653 is the axial or diamond knurl
  on the head's cylindrical wall (the grip). The drawing omits the knurl teeth and draws a smooth
  cylinder — the same envelope convention `knurled_nut` already uses, and consistent with the
  catalog-wide "no drawn thread / no knurl" rule. Flagged in the source string.
- **Top-rim chamfer.** The head top edge carries a small 45° chamfer (`head_chamfer`), matching the
  real drawings which break the sharp top knurl edge. Where a table does not publish the chamfer leg it
  is drawn at a representative value (flagged); the tabulated dimensions (head Ø `d`, head height `k`,
  thread Ø, length) are always sourced.

**Sourcing risk (low, flagged for Task 2):** DIN 464 / DIN 653 are tabulated in public fastener
catalogs at common thumb-screw sizes (roughly M2.5–M10). The Task 2 sourcing gate confirms each
committed dimension against ≥2 named public tables; any dimension that cannot be sourced is drawn at a
sourceable representative size (flagged) or dropped, never fabricated.

## The ids (2 bases + 2 aliases)

| id        | standard | head          | maps to        |
| --------- | -------- | ------------- | -------------- |
| `din464`  | DIN 464  | knurled, high | **NEW base**   |
| `din464p` | DIN 464  | knurled, high | alias `din464` |
| `din653`  | DIN 653  | knurled, low  | **NEW base**   |
| `din653p` | DIN 653  | knurled, low  | alias `din653` |

Two new drawings (`din464.svg`, `din653.svg`), two aliases. The `…p` suffix is the app's image-variant
key and aliases its own base (no chaining). Screw gap **38 → 34**. DIN 464 (high) and DIN 653 (low) are
the same envelope at different `k`, so both are data rows on the one generator.

## Generator design (`knurled_screw.py`)

```
knurled_screw(d, k, d_shank, length, head_chamfer=None, tip_chamfer=None)
```

- `d` = knurled head diameter, `k` = head height (bearing face to top), `d_shank` = shank/thread major
  diameter, `length` = shank length.
- **Head** (z ∈ [0, k]): a revolved meridian profile in the XZ plane about Z (the deterministic
  `_screw_shank` idiom — no fragile edge selection). Flat-top cylinder, with a top-rim chamfer of leg
  `c` when `head_chamfer` is given:
  - chamfer: `[(0,0), (d/2,0), (d/2,k−c), (d/2−c,k), (0,k)]`
  - no chamfer: `[(0,0), (d/2,0), (d/2,k), (0,k)]`
- **Shank** (z ∈ [−length, 0]): `_screw_shank(d_shank, length, tip_chamfer)`, envelope-only, fuses at
  the z=0 bearing plane.
- **Guards:** all of `d`, `k`, `d_shank`, `length` > 0; `d_shank < d` (the knurled head is the grip and
  is always wider than the thread); `head_chamfer` (if given) `0 < c < d/2` and `c < k`; net
  `volume > 0`; `len(part.solids()) == 1` (head + shank must fuse to one solid).
- Register `knurled_screw` in `catalog/models/_registry.py`.

## Data (`knurled_screws.json`, new file)

Each entry `family:"knurled_screw"`, `hardwareType:"screw"`, `verified:true` (only after the sourcing
gate). The representative shape (`d, k, d_shank, length, head_chamfer?, tip_chamfer?`) is set in Task 2
from the sourcing gate at a well-tabulated size (same representative size for both types so DIN 464 vs
DIN 653 differ only by `k`, the defining high-vs-low distinction). `length`, `tip_chamfer`, and
`head_chamfer` are flagged representative where not tabulated. `din464p`/`din653p` carry
`alias_of:"din464"`/`alias_of:"din653"` and target the real non-alias bases (no chaining).

## Design decisions / tradeoffs

- **Compose, don't reinvent (Approach A).** The knurled cylinder head and the shank are both merged,
  reviewed idioms. The new generator only stacks a revolved cylinder onto `_screw_shank` and adds the
  guards — the same composition `hex_bolt`/`prism_head_bolt` did for head + shank. No new geometry
  primitive is introduced.
- **Chamfered top rim (envelope refinement).** The revolved head profile draws a small top chamfer,
  more faithful than a bare flat-top cylinder while staying deterministic. The knurl itself is omitted
  and flagged, matching `knurled_nut` and the catalog-wide envelope rule.
- **Two-standard cluster, one generator.** DIN 464 and DIN 653 differ only in head height, so both ship
  on the one generator as data rows — the coverage win of this family (gap 38 → 34).
- **No collar/neck.** DIN 464/653 heads sit directly on the shank (unlike the DIN 466 knurled nut which
  has a reduced boss). The generator draws no collar; if the sourcing gate finds a defining neck feature
  it is flagged, not fabricated.

## Invariants (verbatim, epic-wide)

- **Generate-only:** do NOT touch `data/image-mappings.json` or `src/lib/data/standards-generated.ts`;
  do NOT run `catalog/integrate.py`.
- **Additive:** manifest gains only the new bases; all existing SVGs byte-identical after rebuild;
  manifest whitespace churn normalized with `pnpm exec prettier --write catalog/out/manifest.json`.
- **Sourcing:** every committed dimension confirmed by ≥2 named public tables; representative fields
  flagged; source strings contain NO `reyher` / `stalmut` tokens; `verified:true` only after cross-check.
- **Aliases never chain:** `din464p` targets the real `din464` base; `din653p` targets `din653`.
- **Container-only:** all build123d runs via `./catalog/run`.

## Testing

- **Generator (`test_knurled_screw.py`):**
  - bounding box — head Ø `d` is the widest feature, height spans `−length` to `k`;
  - head present above the bearing plane (solid out to `d/2` at mid-head, void beyond) and the head is
    wider than the shank;
  - top-rim chamfer — void at the head's top outer corner `(d/2, 0, k)` (chamfered away), solid just
    inboard/below it;
  - shank present below the bearing plane (solid at `d_shank/2`, void beyond) and nothing above `k`;
  - single fused solid (`len(part.solids()) == 1`) and `volume > 0`;
  - guards each raise: `d_shank ≥ d`, `head_chamfer ≥ d/2`, `head_chamfer ≥ k`, and non-positive
    dimensions.
- **Data (`test_knurled_screws_data.py`):** family == knurled_screw, hardwareType screw, shape valid and
  buildable, `din464p`/`din653p` resolve to real non-alias bases (no chaining), every entry sourced +
  verified with a non-empty source, no forbidden tokens, designations `{DIN, 464}` / `{DIN, 653}`.

## Success criteria

- `din464` and `din653` each render a knurled cylindrical head (smooth envelope, chamfered top rim) over
  a round shank — `din464` visibly taller-headed than `din653` — and visibly distinct from the
  `knurled_nut` (a nut with a through bore, no shank).
- `coverage.py` screw gap drops 38 → 34.
- Every existing SVG byte-identical after rebuild.
- Full catalog test suite green.
