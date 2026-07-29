# Hex Flange Bolt Coverage (screw gap, family 8) — Design

**Date:** 2026-07-29
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — increasing coverage; eighth screw-gap family
**Predecessors:** plain hex bolts #123 (85→73), structural/fit hex bolts #124 (73→63),
socket low-head + Torx cheese #125 (63→57), plain studs #126 (57→51), carriage/cup-head bolts
#127 (51→46), countersunk + button socket #128 (46→42), T-head prism bolts #129 (42→40)

## Context

`coverage.py` reports 40 app-served `screw` standards with no generated drawing. This spec covers the
**hex flange bolt** (DIN 6921, = ISO 4162): a hexagon-headed bolt with an integrated conical flange
(a wide dished washer face) under the hex, on a smooth shank. It is the hex-headed cousin of the
already-shipped `flange_nut`, and it composes entirely from parts already merged and reviewed:

- the **chamfered hex head** — `hex_nut._chamfered_hex_solid`, the same head `hex_bolt` uses;
- the **conical flange** — the revolved profile from `flange_nut` (flat bearing disc, thin rim, coning
  up to the hex across-corners circle);
- the **shank** — the shared `screw_common._screw_shank`.

So this is **one new generator** (`hex_flange_bolt`) that invents no geometry — it stacks three
existing primitives. Fusion is face-contact `add()` / revolve-union (the same seam the other screw
generators use), backstopped by a net `volume > 0` and single-solid guard.

## Shape fidelity (why the geometry is what it is)

DIN 6921 is the standard hex flange bolt: a vertex-up hexagon sitting on a round flange whose diameter
`dc` exceeds the hex across-corners, with a flat bearing underside. Verified against vendor drawings
(DIN 6921 = ISO 4162 datasheets) as this form.

- **Serrated bearing face omitted (flagged).** Most real DIN 6921 parts have radial ribs on the flange
  underside (the locking feature). The drawing omits them and draws a smooth conical flange — the same
  envelope convention `flange_nut` already uses for its serrations, and consistent with the catalog-wide
  "no drawn thread / no knurl" rule. Flagged in the source string.
- **Internal flange cone** — where a table does not publish the top-of-flange cone, the tapered
  transition from the rim up to the hex corner circle uses the representative
  `flange_nut._FLANGE_CONE_ANGLE_DEG` (20° from horizontal). The tabulated dimensions (`s`, `k`, `dc`,
  `c`, shank Ø) are always sourced; only this transition is representative, exactly as in `flange_nut`.

**Sourcing risk (low, flagged for Task 2):** DIN 6921 / ISO 4162 is heavily tabulated in public
fastener catalogs at M5–M16. The Task 2 sourcing gate confirms each committed dimension against ≥2
named public tables; any dimension that cannot be sourced is drawn at a sourceable representative size
(flagged) or dropped, never fabricated. Sourcing risk here is low relative to the T-head family.

## The ids (2)

| id         | standard | head         | maps to         |
| ---------- | -------- | ------------ | --------------- |
| `din6921`  | DIN 6921 | hex + flange | **NEW base**    |
| `din6921d` | DIN 6921 | hex + flange | alias `din6921` |

One new drawing (`din6921.svg`), one alias. The `…d` suffix is the app's image-variant key and aliases
its own base (no chaining). Screw gap **40 → 38**. No other hex-flange-bolt standard sits in the gap, so
this family is deliberately small.

## Generator design (`hex_flange_bolt.py`)

```
hex_flange_bolt(s, k, dc, c, d_shank, length,
                head_chamfer=None, tip_chamfer=None)
```

- `s` = hex across-flats, `k` = total head height (hex + flange, bearing face to top of hex),
  `dc` = flange diameter, `c` = flange edge (rim) thickness, `d_shank` = shank diameter,
  `length` = shank length.
- **Flange** (z ∈ [0, flange_top]): the `flange_nut` revolved profile — flat bearing disc of diameter
  `dc` on z=0, up the thin rim of thickness `c`, then coning inward and up at `_FLANGE_CONE_ANGLE_DEG`
  to the hex across-corners circle (circumradius `s/√3`). `flange_top = c + rise`.
- **Hex head** (z ∈ [flange_top, k]): `_chamfered_hex_solid(s, k − flange_top, head_chamfer)`, lifted to
  sit on the flange top plane. Height derived so the total head measures `k`.
- **Shank** (z ∈ [−length, 0]): `_screw_shank(d_shank, length, tip_chamfer)`, envelope-only, fuses at z=0.
- **Guards:** all of `s`, `k`, `dc`, `c`, `d_shank`, `length` > 0; `d_shank < s` (shank narrower than
  the hex, mirrors `hex_bolt`); `d_shank ≤ head flat-chamfer diameter` (shank does not overhang the
  bevelled head bottom, mirrors `hex_bolt`); `dc > 2·(s/√3)` (flange wider than the hex across-corners,
  else there is no flange, mirrors `flange_nut`); `flange_top < k` (the flange leaves room for the hex,
  mirrors `flange_nut`); net `volume > 0`; `len(part.solids()) == 1` (flange + hex + shank must fuse to
  one solid).
- Register `hex_flange_bolt` in `catalog/models/_registry.py`.

## Data (`hex_flange_bolts.json`, new file)

Each entry `family:"hex_flange_bolt"`, `hardwareType:"screw"`, `verified:true` (only after the sourcing
gate). The representative shape (`s, k, dc, c, d_shank, length, head_chamfer?, tip_chamfer?`) is set in
Task 2 from the sourcing gate at a well-tabulated size. `length` and `tip_chamfer` are flagged
representative. `din6921d` carries `alias_of:"din6921"` and targets the real non-alias base (no chaining).

## Design decisions / tradeoffs

- **Compose, don't reinvent (Approach A).** The hex head, the conical flange, and the shank are all
  merged, reviewed primitives. The new generator only stacks them and adds the guards — the same
  composition `hex_bolt` did for hex head + shank, extended with the `flange_nut` flange. No new
  geometry primitive is introduced.
- **Plain conical flange (serrations omitted, flagged).** Matches `flange_nut` and the catalog-wide
  envelope rule; keeps the small SVG readable and the geometry sourceable.
- **Small, single-standard family.** Only DIN 6921 sits in the gap for hex flange bolts; shipping it
  plus its alias is the whole family. No speculative extra ids.

## Invariants (verbatim, epic-wide)

- **Generate-only:** do NOT touch `data/image-mappings.json` or `src/lib/data/standards-generated.ts`;
  do NOT run `catalog/integrate.py`.
- **Additive:** manifest gains only the new base; all existing SVGs byte-identical after rebuild;
  manifest whitespace churn normalized with `pnpm exec prettier --write catalog/out/manifest.json`.
- **Sourcing:** every committed dimension confirmed by ≥2 named public tables; representative fields
  flagged; source strings contain NO `reyher` / `stalmut` tokens; `verified:true` only after cross-check.
- **Aliases never chain:** `din6921d` targets the real `din6921` base.
- **Container-only:** all build123d runs via `./catalog/run`.

## Testing

- **Generator (`test_hex_flange_bolt.py`):**
  - flange wider than the hex at the bearing plane (solid out to `dc/2` at z≈0⁺, void beyond);
  - hex flats present at mid-hex-head height (solid at the flat radius `s/2`, void past the corner
    circle where a flat is);
  - shank present below the bearing plane (solid at `d_shank/2`, void beyond) and nothing above `k`;
  - single fused solid (`len(part.solids()) == 1`) and `volume > 0`;
  - guards each raise: `d_shank ≥ s`, `d_shank` overhanging the head chamfer, `dc ≤` hex across-corners,
    flange consuming the whole head height, and non-positive dimensions.
- **Data (`test_hex_flange_bolts_data.py`):** family == hex_flange_bolt, hardwareType screw, shape valid
  and buildable, `din6921d` resolves to a real non-alias base (no chaining), every entry sourced +
  verified with a non-empty source, no forbidden tokens, designations `{DIN, 6921}`.

## Success criteria

- `din6921` renders a vertex-up hexagon on a round dished flange wider than the hex corners, over a
  round shank — visibly distinct from the plain `hex_bolt` (no flange) and the `flange_nut` (nut, not a
  bolt).
- `coverage.py` screw gap drops 40 → 38.
- Every existing SVG byte-identical after rebuild.
- Full catalog test suite green.
