# Nuts — Conical Flange Family: Generative Catalog Design

**Date:** 2026-07-13
**Epic:** Generative fastener-asset catalog (see `2026-07-08-fastener-asset-pipeline-design.md`, `2026-07-12-nuts-plain-hex-catalog-design.md`)
**Status:** Approved — ready for implementation plan

## Goal

Add the **conical flange nut** family to the maintainer-only generative drawing catalog as
two-view SVG technical drawings, reusing the plain-hex nut pipeline. Second nut family after
the plain hexagon family (PR #91). Proves the "hex body + an extra revolved feature" pattern.

## Non-negotiable epic constraints (carried forward)

- **Opt-in only.** Never edit `data/image-mappings.json` or `src/lib/data/standards-generated.ts`.
  After build, `grep -c '.svg'` on **both** returns **0**.
- **Model per FAMILY, standard = data entry.** One `flange_nut` generator; standards are rows
  in `catalog/dimensions/flange_nuts.json`.
- **Do not fabricate dimensions.** Every tabulated M12 value (`s`, `m`, `d_flange`,
  `flange_thickness`, `bore`) is confirmed against **≥2** manufacturer/standard tables and cited
  with `verified: true`. Only the internal flange-cone transition (rarely tabulated) may be a
  representative value, and the entry's `source` says so.
- **Never run `pnpm standards:build`.** Touch only files under `catalog/`.
- **In-container only** via `./catalog/run …` (Docker). Never host Python.
- **Representative size M12**, matching the rest of the catalog.
- **Vertex-up orientation** (a corner at top/bottom, flats on the sides), matching the legacy
  PNGs — inherited from the shared chamfered-hex construction.

## Scope

### In scope — the conical flange family (drawn at M12)

| Drawing                                | Standards                                                               |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Hex flange nut                         | **DIN 6923** (distinct base)                                            |
| Prevailing-torque flange, nylon insert | **DIN 6926** — distinct drawing or `alias_of` DIN 6923 per sourced dims |
| Prevailing-torque flange, all-metal    | **DIN 6927** — distinct or alias                                        |
| Hex weld nut with flange               | **ISO 21670** — distinct or alias                                       |

All four share the conical-flange silhouette. The nylon insert (DIN 6926), thread deformation
(DIN 6927), and weld projections (ISO 21670) are internal or sub-visible at label scale, so they
render as the same flange-nut drawing. The distinct-vs-alias split is decided from the sourced
dimensions (an entry is an `alias_of` only when its `(s, m, d_flange, flange_thickness, bore)`
match a rendered base within rounding), exactly as in the plain-hex batch.

### Out of scope (future specs)

- **DIN 6331 collar nut** — a _cylindrical_ collar (straight walls), a different silhouette.
- All other nut families (castle, cap/dome, square, wing, knurled, round/slotted-round, plain
  prevailing-torque).
- The user-facing "use generated drawings" toggle.
- Any change to shipped app data.

## Architecture

Reuse of the plain-hex nut pipeline, plus one small refactor:

| File                                     | Change                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog/models/hex_nut.py`              | Extract the chamfered-hex solid (revolve-∩-hex body, minus bore) into a module-level helper `_chamfered_hex_solid(s, m, chamfer)`; `hex_nut` becomes helper + bore subtract (behavior unchanged) |
| `catalog/models/flange_nut.py`           | New generator (helper + conical flange union + bore)                                                                                                                                             |
| `catalog/models/_registry.py`            | Register `"flange_nut"`                                                                                                                                                                          |
| `catalog/dimensions/flange_nuts.json`    | New data file (auto-globbed by build)                                                                                                                                                            |
| `catalog/tests/test_flange_nut.py`       | New generator unit tests                                                                                                                                                                         |
| `catalog/tests/test_flange_nuts_data.py` | New data tests                                                                                                                                                                                   |
| `catalog/tests/test_families.py`         | Add a `flange_nut` dispatch case                                                                                                                                                                 |

**No render change.** Flange nuts are `hardwareType: "nut"`, so they already receive `NUT_PRESET`
(vertex-up) via `preset_for_hardware_type`. The face view shows the hex inside the concentric
flange circle; the flange is concentric so the centerline cross (placed at the bbox center) stays
exact. Both views are height-aligned on the flange diameter.

## Component: `flange_nut` generator

**Interface** (`catalog/models/flange_nut.py`):

```python
def flange_nut(s: float, m: float, bore: float, d_flange: float,
               flange_thickness: float, chamfer: float | None = None):
    """Hex flange nut: across-flats `s`, total height `m`, drawn bore `bore`,
    conical flange of outer diameter `d_flange` and rim thickness `flange_thickness`.
    `chamfer` is the top chamfer-circle diameter (defaults to `s`)."""
```

**Construction:**

1. `hex = _chamfered_hex_solid(s, m, chamfer)` — the shared vertex-up chamfered hex body
   (full height, no bore). Its top chamfer is the visible nut top; its bottom is buried in the
   flange.
2. **Flange** — a revolved frustum at the base: a flat bearing bottom of diameter `d_flange` and
   rim thickness `flange_thickness`, whose top surface cones inward and up to meet the hex at the
   across-corners circle (`2s/√3`). Revolved 360° about Z (clean projection).
3. **Union** hex + flange, then **subtract the bore** through both.

The internal flange-cone rise is rarely tabulated; where a table omits it, use a representative
shallow cone and record that in the entry's `source`. The tabulated dimensions are never
fabricated.

**Guards:** `s, m, bore > 0`; `bore < s − _MIN_WALL_MM`; `d_flange > 2s/√3` (the flange must
extend past the hex corners); `0 < flange_thickness < m`; `volume > 0` (not `is_valid` — the
sewn-shell false-negative gotcha).

**Rendered result** (matches `static/images/standards/din_6923.png`):

- **Face view:** hexagon (vertex-up, chamfer arcs) inside the concentric flange circle
  (`d_flange`), bore circle, full centerline cross.
- **Side view:** hex body on top, conical flange skirt at the base with a flat bearing face,
  single horizontal centerline. Height-aligned with the face view on `d_flange`.

## Data: `catalog/dimensions/flange_nuts.json`

Same schema as the other dimension files. Each entry: `id`, `family: "flange_nut"`,
`shape: {s, m, bore, d_flange, flange_thickness, chamfer?}`, `hardwareType: "nut"`, `source`,
`verified: true`, optional `alias_of`.

- **Representative size M12.** Bore = M12 thread minor diameter (~10.1 mm), the drawn hole, as in
  the plain-hex family.
- Each of `s`, `m`, `d_flange`, `flange_thickness`, `bore` cross-checked against ≥2 tables
  (Fasteners.eu, distributor catalogues, DIN/ISO tables); `source` records where.
- Aliases (if any) point at a rendered non-alias base and reuse its SVG + sha (no duplicate file).

## Testing

- `catalog/tests/test_flange_nut.py` — generator units:
  - flange wider than the hex: max in-plane radius ≈ `d_flange/2`, strictly greater than the hex
    across-corners radius `s/√3`.
  - flange at the base: the widest cross-section is near `z = 0` (bearing face), not at the top.
  - hex present: the across-flats span appears in the hex region.
  - bore open; top chamfer present (top-face max radius < hex circumradius); `volume > 0`.
  - guards raise `ValueError`: bad `s`/`m`/`bore`, `d_flange ≤ 2s/√3`, `flange_thickness` ≤ 0 or
    ≥ `m`, `bore` too close to `s`.
- `catalog/tests/test_families.py` — a `flange_nut` dispatch case (a data-shaped dict routes to
  the generator and builds `volume > 0`).
- `catalog/tests/test_flange_nuts_data.py` — every entry validates + builds; aliases point at
  real non-alias bases; all entries sourced + verified.
- The `_chamfered_hex_solid` extraction is behavior-preserving: `hex_nut`'s existing tests stay
  green unchanged, and the committed plain-hex SVGs remain byte-identical after rebuild.

## Build & rollout

- **Build in-container:** `./catalog/run python -m catalog.build_catalog` → new flange SVGs +
  manifest entries; `./catalog/run pytest catalog/tests` green.
- **Opt-in gate:** after build, assert `grep -c '.svg'` on `image-mappings.json` **and**
  `standards-generated.ts` = `0/0`.
- **No regression:** only new flange SVGs added; existing nut and washer SVGs byte-identical
  (verify via `git status --porcelain catalog/out` — the helper refactor must not change them).
- **Review:** TDD; commit → push → PR → `zen codereview deepseek/deepseek-v4-pro thinking=high`
  (the new generator and the `hex_nut` refactor are shared surfaces) → fix findings as follow-up
  commits → CI green → squash-merge (admin bypass authorized).
- **Visual check:** compare generated-vs-legacy on `/dev/asset-compare`.

## Success criteria

1. The conical flange family renders as vertex-up chamfered hex bodies with a conical flange,
   matching the legacy flange-nut drawings.
2. DIN 6923 + the resolved distinct/alias set for DIN 6926/6927/ISO 21670 covered, all
   dimensions sourced and `verified: true`.
3. `hex_nut` refactor is behavior-preserving (existing tests green; plain-hex SVGs unchanged).
4. Full catalog test suite green in-container.
5. Opt-in invariant intact: `0/0` SVG references in shipped app data.
6. PR merged after zen review + CI green.
