# Washer Coverage-Gap Closure Catalog — Design

**Date:** 2026-07-26
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `washer` — closing the last coverage gap
**Predecessors:** the washer families (flat/spring/curved/toothed/tab/square/spherical/wave), and
the screw families (#110/#111/#115/#116/#117)

## Category context

`catalog/qa/coverage.py` gates each app-served hardware type: for a `hardwareType`, it reports the
standards listed in `data/image-mappings.json` that have **no** generated drawing in
`catalog/out/manifest.json`. The washer gate currently reports **five** missing standards:

```
COVERAGE GAP (washer): din137b, din25201, din440r, din440v, din74361c
```

This is the smallest concrete gap in the catalog. Closing it makes
`python -m catalog.qa.coverage` print `washer coverage: complete`. The washer generators already
cover most forms; three of the five reuse an existing generator, and only two need a small new one.

## Goal

Generate a catalog drawing for each of the five gap washers so the `coverage.py` washer check
returns an empty list. **Generate-only:** add dimension entries and build the SVGs; do **not**
modify `data/image-mappings.json` (the five are already listed there) or
`src/lib/data/standards-generated.ts`, and do not run `integrate.py`. Wiring the SVGs into the app
UI stays out of scope (the epic's user-facing toggle is deliberately last).

## The five washers

| id          | shape                                      | generator                  | new drawing?    |
| ----------- | ------------------------------------------ | -------------------------- | --------------- |
| `din137b`   | waved spring washer (gewellt)              | `wave_washer` (exists)     | yes (data-only) |
| `din440r`   | round-hole flat washer (= DIN 440 form R)  | alias of existing `din440` | no — alias      |
| `din440v`   | round disc with a **square** hole (form V) | `square_hole_washer` (new) | yes             |
| `din74361c` | conical Belleville spring washer (form C)  | `curved_washer` (exists)   | yes (data-only) |
| `din25201`  | wedge-lock washer (radial teeth + cam)     | `wedge_lock_washer` (new)  | yes             |

- **`din137b`** — DIN 137 Form B is the waved spring washer. The `wave_washer` generator already
  models exactly this ("DIN 137 B: waved spring washer"); the closed curved form (137 A) already
  ships via `curved_washer`. Data entry only.
- **`din440r`** — DIN 440 Form R is the round-hole large-series flat washer, geometrically the
  same envelope as the already-generated `din440` (`flat_washer`). Ships as an **alias** of
  `din440` (no new drawing).
- **`din440v`** — DIN 440 Form V is the same round disc but with a **square** hole (for
  square-neck bolts). No existing generator makes a round disc with a square bore (`square_washer`
  is the inverse — a square plate with a round bore), so this needs a small new generator.
- **`din74361c`** — DIN 74361 Form C is a **conical (Belleville-style) spring washer** for wheel
  bolts/nuts: a dished annular ring, uniform thickness, no spherical seat and no serrations. This
  is what `curved_washer` produces (a radial section tilted by a cone angle and revolved — already
  used for the `din2093` Belleville disc springs and `din137a`). Data entry only, at a
  representative wheel-bolt size.
- **`din25201`** — a wedge-lock washer: an annular ring with fine **radial serrations** on one
  face and a **circumferential cam saw-tooth** on the mating face (cam ramp angle greater than the
  thread pitch angle; the DIN 25201 pair uses two identical washers). The catalog ships the single
  representative washer (the repeating unit), not the assembled pair. Needs a new generator.

## Representative sizes

- **M12** for `din137b`, `din440v`, `din25201` (all define M12), matching the epic default.
- **`din74361c`** uses a representative **wheel-bolt** size (DIN 74361 is dimensioned for wheel
  bolts, not general M-sizes) — confirmed at the sourcing gate; documented as chosen.
- `din440r` inherits `din440`'s size (alias).

## Non-goals

- **No app integration.** `data/image-mappings.json` and `src/lib/data/standards-generated.ts`
  stay untouched; `integrate.py` is not run. Goal is the coverage gate only.
- **No dimensioned DIN 25201 cam curve.** The wedge-lock cam ramps and radial teeth are a
  **representative** icon (like the Torx lobular / cross recesses in the screw families), not the
  normative gauge geometry.
- **No modification to existing washer generators** (`wave_washer`, `curved_washer`,
  `flat_washer`, `square_washer`, …) — the two new generators are self-contained; existing SVGs
  stay byte-identical.
- **No new preset.** Washers render under the existing washer preset (unchanged).

## Architecture

### New generator 1 — `catalog/models/square_hole_washer.py`

```python
def square_hole_washer(d_outer, thickness, hole_side, hole_corner_r=None):
    ...
```

A plain round disc of diameter `d_outer` and `thickness` (centred on `z=0`, matching the other
washers) with a central **square** hole of side `hole_side` (optional small corner round
`hole_corner_r`). Built as `Cylinder(radius=d_outer/2, height=thickness)` minus a square prism
(`Box(hole_side, hole_side, > thickness, mode=SUBTRACT)`), the deterministic disc-minus-prism
idiom. Guards: `d_outer, thickness, hole_side > 0`; `hole_side * sqrt(2) < d_outer` (the square's
corners stay inside the disc with a wall left); `hole_corner_r` (when given) `> 0` and
`< hole_side/2`; net `volume > 0`.

### New generator 2 — `catalog/models/wedge_lock_washer.py`

```python
def wedge_lock_washer(d_inner, d_outer, thickness, teeth, cam_count,
                      cam_height, tooth_depth):
    ...
```

A representative wedge-lock washer, built by combining three deterministic features (no fragile
edge selection):

1. **Base ring** — `Cylinder(d_outer/2, thickness)` minus `Cylinder(d_inner/2, …)`, centred on
   `z=0`.
2. **Radial serrations** on the top (`+Z`) face — `teeth` shallow radial grooves cut with a
   `PolarLocations(teeth)` pattern of thin radial box cutters of depth `tooth_depth`. These read
   as the fine radial teeth in the end view.
3. **Circumferential cam saw-tooth** on the bottom (`−Z`) face — `cam_count` ramp facets removed
   with a `PolarLocations(cam_count)` pattern of wedge cutters of amplitude `cam_height`, giving a
   scalloped/saw-tooth bottom edge visible in the side elevation.

The cam ramps and radial teeth are a **representative** icon (documented in the docstring and the
`source` string), not the dimensioned DIN 25201 cam curve. Net guards: `volume > 0` and
`len(part.solids()) == 1`. Input guards: `0 < d_inner < d_outer`; `thickness`, `cam_height`,
`tooth_depth` all positive; `teeth` and `cam_count` each at least 3 (a meaningful pattern);
`cam_height < thickness` and `tooth_depth < thickness` (the features do not sever the ring).

Both new generators register in `catalog/models/_registry.py` (`"square_hole_washer"`,
`"wedge_lock_washer"`), after the existing washer entries.

## Data

All entries go in the existing `catalog/dimensions/washers.json` (all washers live in one file).

| id          | family               | shape source                                                                          |
| ----------- | -------------------- | ------------------------------------------------------------------------------------- |
| `din137b`   | `wave_washer`        | DIN 137 B M12: d_inner, d_outer, thickness, wave params                               |
| `din440r`   | alias → `din440`     | DIN 440 R = DIN 440 envelope (round hole)                                             |
| `din440v`   | `square_hole_washer` | DIN 440 V M12: d_outer, thickness, square hole side                                   |
| `din74361c` | `curved_washer`      | DIN 74361 C: d_inner, d_outer, thickness, cone_angle (wheel size)                     |
| `din25201`  | `wedge_lock_washer`  | DIN 25201 M12: d_inner, d_outer, thickness; cam/tooth counts + heights representative |

- **Sourcing gate (at the data task):** the **envelope** dims of each base (`d_inner`/`d_outer`/
  `thickness`, plus `hole_side` for din440v, `cone_angle` for din74361c) confirmed against **≥2
  independent public tables**; the wedge-lock cam/tooth counts and heights, and any wave amplitude,
  documented as **representative** where the standard's figure is paywalled. `din440r`'s alias
  `source` states it shares the DIN 440 envelope.
- `source` strings cite only public tables — never a private catalogue (no `reyher`, `stalmut`);
  `verified: true` only after the cross-check. Perplexity and the Playwright MCP may read tables.
- `hardwareType: "washer"` for every entry.

## Testing

- `catalog/tests/test_square_hole_washer.py` (synthetic fixtures): bbox extent = `d_outer`; the
  hole is square (void on the axis; void at a hole **corner** where a round hole of the same width
  would be solid; solid in the disc body); single solid; guards each raise.
- `catalog/tests/test_wedge_lock_washer.py` (synthetic fixtures): bbox; the central bore is open
  (void on the axis, solid in the ring body); the top face carries radial teeth (a probe in a
  groove is void where an adjacent tooth is solid); the bottom carries the cam saw-tooth (axial
  extent of the bottom face varies with angle); single solid; guards each raise.
- `catalog/tests/test_washers_data.py` (extend the existing washer data test, or add cases): the
  five new entries validate + build; `din440r` resolves to `din440`; `hardwareType` is `washer`;
  sourced + `verified`; no forbidden source token.
- **Coverage assertion:** a test (or the plan's build step) confirms
  `catalog.qa.coverage.check(manifest, image_mappings, "washer") == []` after the build — the gate
  is closed.
- Existing tests stay green; existing SVGs stay byte-identical (new self-contained generators; no
  existing generator touched).

## Rollout / invariants

- **Generate-only.** In-container (`./catalog/run`). Build produces **4 new drawings** (din137b,
  din440v, din74361c, din25201) + 1 alias (din440r, no new file); no existing drawing changes
  (byte-identical). `data/image-mappings.json` and `src/lib/data/standards-generated.ts` stay
  untouched (`grep -c '.svg'` on the diff of both → 0); `integrate.py` is not run.
- After the build, `./catalog/run python -m catalog.qa.coverage` prints `washer coverage:
complete` (exit 0).
- If `catalog/out/manifest.json` shows a whitespace-only rebuild reformat with content-identical
  entries, normalise it (the pre-commit prettier hook does this) so the committed manifest diff is
  only the new/changed entries.
- Convention: TDD → commit → push → PR → zen review (`deepseek/deepseek-v4-pro`, thinking=high — a
  new generator on a shared surface) → apply findings as additional commits → CI green →
  squash-merge (admin). Visual confirmation of all 4 new drawings before merge.

## Global constraints (verbatim)

- Closes the `coverage.py` washer gap: din137b, din440r, din440v, din74361c, din25201.
- **Generate-only** — do NOT modify `data/image-mappings.json` or
  `src/lib/data/standards-generated.ts`, and do not run `integrate.py`.
- Every committed **envelope** dimension confirmed by **≥2 independent public tables**; wedge-lock
  cam/tooth and other unpublished figures documented as representative, never fabricated as
  normative. Shapes verified against public drawings (DIN 137 B wave, DIN 440 V square hole, DIN
  74361 C Belleville cone, DIN 25201 wedge-lock).
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- Two new self-contained generators; do **not** modify any existing generator; existing SVGs
  byte-identical.
- **No render/preset change.**
