# Prevailing-Torque Lock Nut Family Catalog — Design

**Date:** 2026-07-14
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Predecessors:** plain hex (#91), flange (#92), cap (#93), castle (#94), collar (#95),
square (#96/#97), wing (#98/#99)

## Goal

Add a **prevailing-torque hexagon lock nut** family to the maintainer-only generative
catalog, covering both sub-forms in one generator: **nylon-insert (nyloc)** nuts and
**all-metal** deformed-crown nuts. Ship the M12 representative size. It reuses
`_chamfered_hex_solid` (the shared hex body) — it does **not** introduce a new base shape.

This family closes the largest remaining nut-coverage gap (~9 standards) on the road to
full SVG coverage, which is the gate for the user-facing "use generated drawings" toggle.

## Non-goals

- **No nylon ring drawn.** The renderer draws the metal solid's silhouette only. The metal
  collar OD projects as a circle in the face view; the polyamide ring's inner circle is
  **not** modelled (envelope-only — same rule as the din6926 nylon crown and the din6927
  all-metal flange nut).
- **No modelling of the locking mechanism internals** — the crimp slots, the deformed
  thread, the exact nylon geometry. Only the outer metal envelope is drawn.
- **No render/preset change.** Lock nuts are `hardwareType: "nut"` → existing `NUT_PRESET`
  (vertex-up). The top feature is unioned by the generator.
- **No sizes beyond M12.** No user-facing toggle (that is the epic END goal, gated on full
  coverage).
- **No DIN 562** (square thin) or other non-lock nuts — those belong to other families.

## Silhouettes to match

Four legacy rasters define the target silhouette. Each generated drawing replaces one of
them:

| Legacy raster                      | Form                      | Top feature                         |
| ---------------------------------- | ------------------------- | ----------------------------------- |
| `din_985.png` (nyloc regular/thin) | nylon insert              | plain **cylinder** collar (skirt)   |
| `din_982.png` (nyloc high)         | nylon insert, high        | plain **cylinder** collar (skirt)   |
| `din_980.png` (all-metal regular)  | all-metal, deformed       | shallow **truncated cone** crown    |
| `din_6925.png` (all-metal high)    | all-metal, deformed, high | pronounced **truncated cone** crown |

The hex body is the standard vertex-up chamfered hex (as every hex-derived nut). The top
feature sits on the hex top face and is narrower than the across-flats width, so in the
face (axial) view it reads as a circle inside the hexagon — matching the rasters.

## Architecture

New generator `catalog/models/lock_nut.py`. Imports **only** `_chamfered_hex_solid` and
`_MIN_WALL_MM` from `hex_nut` (same import discipline as the other hex-derived families).

```python
def lock_nut(s, m, bore, top_style, top_h, top_d, top_d2=None, chamfer=None):
    ...
```

**Orientation.** Vertex-up (a corner at top), like every nut family — `_chamfered_hex_solid`
already builds the hex with a vertex on +X (the view's up axis). No preset change.

**Construction (union on top, like `castle_nut`'s crown):**

1. **Hex body:** `_chamfered_hex_solid(s, m - top_h, chamfer)` — the hex portion, chamfered
   on both faces to the `s/2` circle (the shared helper). Its height is the total tabulated
   height `m` minus the top-feature height `top_h`, so the two stack to the full envelope `m`
   (the same total-height split used by `castle_nut`: hex `m1` + crown to `m`).
2. **Top feature**, unioned on the hex top face at `z = m - top_h`, `Align Z=MIN`:
   - `top_style == "cylinder"` (nyloc, din_985 / din_982): `Cylinder(radius=top_d/2,
height=top_h)` — the straight metal skirt that houses the nylon ring. `top_d2` unused.
   - `top_style == "cone"` (all-metal, din_980 / din_6925): revolve a trapezoid
     `[(0,0),(top_d/2,0),(top_d2/2,top_h),(0,top_h)]` about `Axis.Z` translated to the hex
     top — a truncated cone tapering from `top_d` (base) to `top_d2` (top) over `top_h`.
     Revolve handles the cone uniformly (the same reason `wing_nut` revolves its hub rather
     than using the `Cone` primitive, which rejects equal radii).
3. **Bore:** subtract a through `Cylinder(radius=bore/2, height=m*3)` along Z **last**, like
   `hex_nut` — the bore runs through the hex body and the collar/crown.

Guard on `part.volume > 0` (net guard, matches the family; not `is_valid`).

### Guards (ValueError)

1. `s, m, bore, top_h, top_d` all `> 0`; when `top_style == "cone"`, `top_d2 > 0`.
2. `top_h < m` — the hex portion `m - top_h` must be positive (a real hex body below the
   top feature).
3. `bore < s - _MIN_WALL_MM` (wall between bore and the hex flats) **and**
   `bore < top_d - 2*_MIN_WALL_MM` (wall through the collar/crown).
4. `top_style` in `{"cylinder", "cone"}`; when `"cone"`: `0 < top_d2 < top_d` (truncated,
   tapering inward) and `top_d2 > bore + 2*_MIN_WALL_MM` (the narrow top ring keeps a wall).
5. `top_d <= s` — the top feature is no wider than across-flats, so it sits within the hex
   face (reads as a circle inside the hexagon, as the rasters show).
6. `_chamfered_hex_solid(s, m - top_h, chamfer)` validates `s`, the hex height, and `chamfer`
   (delegated — same as the other hex-derived families).
7. Final `part.volume > 0`.

## Data

New `catalog/dimensions/lock_nuts.json`. Shape per entry =
`{s, m, bore, top_style, top_h, top_d, top_d2?, chamfer?}` (`top_d2` present only for cone
entries; `chamfer` optional, defaults to `s` in the helper as elsewhere).

Standards grouped by target silhouette (distinct drawing vs alias resolved during sourcing —
each envelope confirmed by ≥2 independent public tables):

| Legacy raster | top_style | Standard candidates       |
| ------------- | --------- | ------------------------- |
| din_985       | cylinder  | iso10511, iso10512        |
| din_982       | cylinder  | iso7040, iso7041, iso7720 |
| din_980       | cone      | iso7719, iso10513         |
| din_6925      | cone      | iso7042, din6925          |

- **Aliasing:** fine-pitch variants (iso10512, iso10513) alias their coarse twins where the
  M12 metal envelope matches — pitch is invisible at label scale (precedent: iso8673/8674/
  8675 → their coarse twins). Standards that share a silhouette **and** an identical M12
  envelope collapse to one drawing + aliases; standards whose envelope differs by ≥1 field
  ship a distinct drawing. The exact distinct-vs-alias split is determined by the sourcing
  step, not asserted here.
- **Sourced vs representative:** the envelope fields (`s`, `m`, `bore`, `top_d`) are
  tabulated (≥2 tables). The crown/skirt profile fields (`top_h`, and `top_d2` for cones)
  are **representative** where not tabulated — the crimp/crown taper is rarely dimensioned;
  each entry's `source` string states which fields are tabulated and which are
  representative form. `bore = 10.1` (M12 minor, ISO 724), the family constant.
- Source strings cite only public tables — never any private/internal catalogue.

## Registration & render

- `catalog/models/_registry.py`: add `"lock_nut": lock_nut` to `KNOWN_FAMILIES`.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("nut")` → `NUT_PRESET`.

## Testing

- `catalog/tests/test_lock_nut.py` (generator):
  - **Envelope extents:** bounding box is across-corners `2s/√3` on X (vertical, vertex-up),
    across-flats `s` on Y, total `m` on Z.
  - **Hex body below the top feature:** material out to the hex circumradius at a low z
    (inside the hex portion), confirming a real hex body under the collar/crown.
  - **Top feature narrower than the hex:** near the top (`z` just below `m`) there is
    material within `top_d/2` but none beyond `top_d/2` — the collar/crown sits inside the
    flats, as the rasters show.
  - **Cone tapers (cone config):** for a `top_style="cone"` part, material at the base
    radius `top_d/2` near the join but empty at the base radius near the top (the crown
    narrows to `top_d2`).
  - **Open bore:** the through bore removes material (holed volume < solid-bore volume);
    hub wall present between bore and flats.
  - **All guards raise** (each ValueError branch).
  - **Valid boundary configs (parametrized):** at least one cylinder and one cone config
    build with `volume > 0` and pass the top-feature checks.
- `catalog/tests/test_lock_nuts_data.py` (data): every entry validates + builds,
  family/hardwareType correct, sourced + verified, no forbidden source token.
- Existing hex/flange/cap/castle/collar/square/wing/washer tests stay green; existing SVGs
  stay byte-identical (no shared code changed — `_chamfered_hex_solid`/`_MIN_WALL_MM` are
  only imported).

## Rollout / invariants

- **Opt-in 0/0.** In-container only (`./catalog/run`). Build produces the new lock-nut
  drawings; no existing drawing changes (byte-identical). `image-mappings.json` and
  `src/lib/data/standards-generated.ts` stay untouched (`grep -c '.svg'` on both returns 0).
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, new generator is a
  shared surface) → apply findings as additional commits → CI green → squash-merge (admin).

## Global constraints (verbatim)

- Representative size **M12**.
- Every committed **envelope** dimension confirmed by **≥2 independent public tables**;
  representative form fields (`top_h`, `top_d2` crown taper) documented as such, never
  fabricated as normative.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- Reuses `_chamfered_hex_solid` — does **not** modify it or any existing generator; existing
  SVGs byte-identical (rebuild → `git status catalog/out` shows no change to existing files).
- **No render/preset change.** Top feature unioned by the generator; hardwareType nut →
  NUT_PRESET vertex-up.
- opt-in invariant 0/0 after build.
