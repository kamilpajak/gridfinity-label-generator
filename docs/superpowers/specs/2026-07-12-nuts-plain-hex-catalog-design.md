# Nuts — Plain Hexagon Family: Generative Catalog Design

**Date:** 2026-07-12
**Epic:** Generative fastener-asset catalog (see `2026-07-08-fastener-asset-pipeline-design.md`)
**Status:** Approved — ready for implementation plan

## Goal

Extend the generative catalog beyond washers to its first **nut** category by shipping
the **plain hexagon nut family** as generated 2D two-view SVG technical drawings. This is
the first of several nut specs; it proves the category end-to-end (data → generator →
render preset → tests → in-container build → merge) by reusing the washer pipeline, and
mirrors how the washer rollout started narrow.

## Non-negotiable epic constraints (carried forward)

- **Opt-in only.** Generated SVGs are a maintainer-only set. `data/image-mappings.json`
  and `src/lib/data/standards-generated.ts` stay untouched — legacy rasters remain the
  default. Post-build assertion: `grep -c '.svg'` on both returns **0**.
- **Model per FAMILY, standard = data entry.** One `hex_nut` generator serves the whole
  plain-hex family via parameters; each standard is a row in `catalog/dimensions/nuts.json`.
- **Do not fabricate dimensions.** Every M12 value is sourced from ≥2 manufacturer/standard
  tables (Fasteners.eu, distributor tables, DIN/ISO dimensional tables) and recorded in the
  entry's `source` string with `verified: true`. Skip a standard rather than invent numbers.
- **Never run `pnpm standards:build`** to integrate (lossy without the git-ignored
  `data/dinmedia-*.json` cache). Nuts touch only maintainer catalog files.
- **No user-facing change.** The "use generated drawings" toggle remains the epic's final,
  separate milestone.

## Scope

### In scope — the plain hexagon family (drawn at a representative M12 size)

| Drawing (distinct SVG)  | Standards covered                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Regular hex (style 1)   | ISO 4032 · ISO 8673 (fine pitch → alias)                                                                                                   |
| High hex (style 2)      | ISO 4033 · ISO 8674 (alias)                                                                                                                |
| Thin hex (style 0)      | ISO 4035 · ISO 8675 (alias) · DIN 936 (jam/lock → alias of thin) · DIN 80705 (thin, small across-flats — verify whether distinct or alias) |
| Tall hex (height 1.5 d) | DIN 6330                                                                                                                                   |
| Pipe-thread hex         | DIN 431                                                                                                                                    |

~11 standards from one chamfered generator plus a few data rows. Fine-pitch ISO 867x
variants are zero-cost `alias_of` the coarse twins (geometry identical; only thread pitch
differs, which is invisible at label scale). DIN 80705's across-flats is smaller than the
regular hex, so it is a **distinct drawing** unless a table proves it equals another base —
resolved during implementation from the sourced dimensions.

### Out of scope (each a future, separate spec)

- Non-hex nut families: **flange** (DIN 6923/6331/6926/6927, ISO 21670), **castle/slotted**
  (DIN 935/937/979/6334), **cap/dome** (DIN 1587/917/986), **square** (DIN 557/562/928/508),
  **wing** (DIN 315/80701), **knurled** (DIN 466/467), **round / slotted-round / bearing
  lock** (DIN 546/1804/1816/70852/981).
- **Prevailing-torque nuts** (ISO 7040/7041/7042/10511/10512/10513/7719/7720, DIN
  6925/6926/6927/986): their nylon-insert or deformed-top geometry deserves its own scoping
  rather than being force-fit as plain hex.
- The user-facing "use generated drawings" toggle.
- Any change to shipped app data (`image-mappings.json`, `standards-generated.ts`).

## Architecture

Pure reuse of the washer pipeline. New and changed maintainer-only files under `catalog/`:

| File                             | Change                                                            |
| -------------------------------- | ----------------------------------------------------------------- |
| `catalog/models/hex_nut.py`      | Upgrade the existing Phase-0 spike generator to model the chamfer |
| `catalog/dimensions/nuts.json`   | New data file (same schema as `washers.json`)                     |
| `catalog/render.py`              | Add a nut `CameraPreset` (hex face view + profile)                |
| `catalog/build_catalog.py`       | Pick up `nuts.json` alongside `washers.json`                      |
| `catalog/tests/test_hex_nut.py`  | New generator unit tests                                          |
| `catalog/tests/test_families.py` | Add a nut dispatch case                                           |

`hex_nut` is already registered in `catalog/models/_registry.py`; the dimensions
`_schema.json` already enumerates `"nut"`.

## Component: chamfered `hex_nut` generator

**Interface** (in `catalog/models/hex_nut.py`):

```python
def hex_nut(s: float, m: float, bore: float, chamfer: float | None = None):
    """Hex nut: across-flats `s`, height `m`, thread bore `bore`.

    chamfer: the chamfer-circle diameter the top/bottom bevel starts from
    (= across-flats `s` by ISO). None -> derived as `s`.
    """
```

**Construction — revolve ∩ hex (not an edge `chamfer()` op):**

1. Revolve the nut silhouette: a rectangle of radius `s/2` and height `m` whose top and
   bottom **outer** corners are cut at 30° (the standard hex-nut chamfer angle). This yields
   a cylinder-with-two-cones solid of revolution.
2. **Intersect** that solid with the hexagonal prism (across-flats `s`). The hex corners
   stick out past the inscribed chamfer circle, so the intersection bevels exactly those
   corners — producing the characteristic **arcs across each flat** in the face view and the
   angled corner lines in the side view.
3. Subtract the `bore` cylinder.

**Why intersect-with-a-revolve rather than build123d's edge `chamfer()`:** it matches real
hex-nut geometry exactly, and revolved surfaces give clean plan-view projections whereas
swept/filleted edges can leave a projector seam (documented render-pipeline note). This
keeps the family on the same safe path the revolved washer families use.

**Validation:** guard on `part.volume > 0`, not `is_valid` (which reports False for sewn
shells even when correct — documented gotcha).

**Chamfer default:** ISO hex nuts chamfer from the across-flats circle, so `chamfer`
diameter defaults to `s`; a data row may override if a specific table differs.

## Component: nut render preset

Nuts reuse `render_two_views` unchanged and add one preset (e.g. `NUT_PRESET`) next to
`DEFAULT_AXIS_Z` in `render.py`.

- **Front (face view):** look down Z → hexagonal outline + bore circle + chamfer arcs; full
  symmetry cross centerline.
- **Side (profile view):** look along −Y → rectangle of height `m`, chamfer bevels top and
  bottom, hidden bore lines (dashed); horizontal rotation-axis centerline only.
- **Orientation:** hex drawn **flats-horizontal** (a flat at top and bottom, engineering
  convention). The side view's width is then the across-corners dimension `e = 2s/√3` (the
  widest projection, the correct max width), and both views stay height-aligned under the
  existing X-vertical rule (#80). The generator/preset bakes the rotation that lands the hex
  flats-horizontal.
- **Centerlines:** the hex face bbox center coincides with the bore axis, so the existing
  `_centerline_coords` cross is exact with no special-casing.

## Data: `catalog/dimensions/nuts.json`

Same shape/schema as `washers.json`. Each entry: `id`, `family: "nut"`,
`generator: "hex_nut"`, `shape: {s, m, bore, chamfer?}`, `source`, `verified`, optional
`alias_of`.

- **Representative size: M12** across the family, matching the washer set for shelf
  consistency.
- **Bore:** the nominal thread through-hole shown as a plain circle at label scale (no thread
  modeling), exactly as washer bores are drawn.
- **Sourcing discipline:** each M12 figure cross-checked against ≥2 tables; `source` string
  records where; `verified: true` once confirmed. Exact numbers are pinned during
  implementation, not in this design.
- **Aliases:** ISO 8673→4032, 8674→4033, 8675→4035, DIN 936→ISO 4035 (thin) — each
  `alias_of` a rendered base, reusing its SVG + sha (no duplicate file), like the washer
  plated-variant aliases. Alias targets must be a rendered base, never another alias.

## Testing

Mirrors the washer test structure:

- `catalog/tests/test_hex_nut.py` — generator units: `volume > 0`; across-flats bbox equals
  `s`; height equals `m`; bore open (axis point is void); **chamfer present** — the top-face
  bbox is smaller than the mid-body bbox (catches a regression to the flat prism).
- `catalog/tests/test_families.py` — add a nut dispatch case (a `nuts.json`-shaped dict
  routes to `hex_nut`).
- Integration — one nut through `render_two_views` writes an SVG with all three layers
  (Visible / Hidden / Center); the face view carries hex + arc edges; the Center layer holds
  the expected centerlines.
- A validation-style guard so a bad nut id/dimension is caught.

## Build & rollout

- **Build in-container:** `./catalog/run python -m catalog.build_catalog` → new SVGs +
  `manifest.json` entries; `./catalog/run pytest catalog/tests` green.
- **Opt-in gate:** after build, assert `grep -c '.svg'` on `image-mappings.json` **and**
  `standards-generated.ts` is still `0/0`.
- **Review:** TDD throughout; commit → push → open PR → `zen codereview
deepseek/deepseek-v4-pro thinking=high` (generator + render preset are shared surfaces) →
  fix findings as follow-up commits → CI green → squash-merge (admin bypass authorized).
- **Visual check:** eyeball generated-vs-legacy on `/dev/asset-compare`, which joins
  `manifest.json` ↔ `image-mappings.json` and shows each generated nut SVG beside its legacy
  PNG.

## Success criteria

1. The plain-hex family renders as chamfered two-view SVGs with centerlines, visually
   matching the legacy hex-nut drawings.
2. ~11 standards covered (distinct drawings + fine-pitch/jam aliases) with all dimensions
   sourced and `verified: true`.
3. Full catalog test suite green in-container.
4. Opt-in invariant intact: `0/0` SVG references in shipped app data.
5. PR merged after zen review + CI green.
