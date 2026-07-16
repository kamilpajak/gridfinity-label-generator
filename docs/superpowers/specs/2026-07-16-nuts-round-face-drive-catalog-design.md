# Round-Nut Face/Cross-Drive Family Catalog — Design

**Date:** 2026-07-16
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Predecessors:** plain hex (#91), flange (#92), cap (#93), castle (#94), collar (#95),
square (#96/#97), wing (#98/#99), lock (#101), knurled (#102/#103),
slotted-round / OD-slots (#104)

## Goal

Complete the **round-nut group** with its two remaining face/cross drive styles, on the
same plain round cylinder + bore base as `knurled_nut` and `slotted_round_nut`. Covers:

- **`din546`** (Schlitzmutter / slotted round nut) — one straight screwdriver **slot across
  the top face**, partial depth.
- **`din1816`** (Kreuzlochmutter / cross-hole round nut) — N **radial holes drilled into the
  outer cylindrical wall**, perpendicular to the axis, for a pin / tommy-bar spanner (ISO
  fine thread).

The round-nut group was decomposed by drive style during the OD-slots brainstorm; OD-slots
(`din981`, `din70852`) shipped in #104. This family ships the other two styles. Ships M12.

**Shape correction (recorded).** An earlier decomposition labelled `din1816` "face-holes"
(blind holes in the top face). Verification against tables (fasteners.eu, Definite Metal,
Vital Parts, McMaster, Theo-Schrauben) shows the holes are **radial, in the outer wall**, not
axial in the face — the DIN 467 boss lesson again. The design below models radial wall holes.

## Non-goals

- **One drive style per generator.** Two small single-responsibility generators
  (`slotted_face_nut`, `cross_hole_nut`), NOT one `drive_style` switch — a face slot and
  radial wall holes share nothing but the base cylinder, so a switch would only bundle two
  mutually-exclusive param sets behind one signature. (Contrast `lock_nut`'s `top_style`,
  where both styles were a top-crown feature.)
- **No thread / knurl / fine-chamfer drawn** — fine features, envelope-only (family rule).
- **No render/preset change.** Both bodies are `hardwareType: "nut"` → existing `NUT_PRESET`,
  axisymmetric at their feature positions (first feature on +X to match raster framing).
- **No other round-nut drive styles.** OD-slots (`din981`, `din70852`) already shipped.
  **No `din1804`** (hook-spanner slotted round nut) — it has no legacy raster to replace.
- **No sizes beyond M12.** No user-facing toggle (epic END goal, gated on full coverage).

## Silhouettes to match

| Legacy raster  | Standard | Drive                                                     |
| -------------- | -------- | --------------------------------------------------------- |
| `din_546.png`  | din546   | round body, one diametral slot across the top face        |
| `din_1816.png` | din1816  | round body, N radial holes in the outer wall (cross-hole) |

- `din546` — face view: OD circle with a straight band across a diameter (the slot) + the
  bore. Profile: rectangle (`d` × `h`) with a rectangular notch in the top face (the slot
  groove), partial depth.
- `din1816` — face view: OD circle with N rim features where the radial holes break the
  outer surface + the bore. Profile: rectangle with the holes shown in the wall.

## Architecture

Two new generators, each importing **only** `_MIN_WALL_MM` from `hex_nut`; neither touches
`_chamfered_hex_solid` or any existing generator.

### `catalog/models/slotted_face_nut.py` (DIN 546)

```python
def slotted_face_nut(d, h, bore, slot_w, slot_depth):
    ...
```

**Construction (subtractive):**

1. **Body:** `Cylinder(radius=d/2, height=h)` — default `Align.CENTER`, spans z ∈ [−h/2, h/2].
2. **Slot:** inside `Locations((0, 0, h/2))` (the top face), one `Box(2*d, slot_w,
2*slot_depth, mode=Mode.SUBTRACT)` running the full diameter along X. Centred on the top
   face, its lower half removes exactly the top `slot_depth`; its length `2*d` overshoots both
   rim edges so the slot spans the whole face; its upper half overshoots above the nut. The
   slot is **partial depth** (opens from the top face only) — like `slotted_round_nut`.
3. **Bore:** through `Cylinder(radius=bore/2, height=h*3, mode=Mode.SUBTRACT)`, **last**.

**Orientation:** slot runs along X (visible across the face in the top view). First (only)
slot on the X axis.

**Guards (ValueError):**

1. `d, h, bore, slot_w, slot_depth` all `> 0`.
2. `slot_depth < h - _MIN_WALL_MM` (the slot floor leaves material below it; the slot does
   not open through the bottom face).
3. `slot_w < d - 2*_MIN_WALL_MM` (the slot leaves an OD rim on each side).
4. `bore < d - 2*_MIN_WALL_MM` (wall between bore and OD).
5. Final `part.volume > 0` (net guard, not `is_valid` — sewn-shell gotcha).

Note: the diametral slot crosses the central bore mouth. That is correct — a DIN 546 slot
does span the bore opening on the top face; the guard set does not forbid it.

### `catalog/models/cross_hole_nut.py` (DIN 1816)

```python
def cross_hole_nut(d, h, bore, n_holes, hole_d, hole_depth):
    ...
```

**Construction (subtractive):**

1. **Body:** `Cylinder(radius=d/2, height=h)` — `Align.CENTER`, spans z ∈ [−h/2, h/2].
2. **Radial holes:** `n_holes` cylinders subtracted at **mid-height** (z = 0), each with its
   axis **horizontal and pointing radially**, drilled from the OD inward to depth
   `hole_depth`. Implemented with `PolarLocations` at the OD placing a `Cylinder(radius=
hole_d/2, height=..., mode=Mode.SUBTRACT)` rotated so its axis is radial (the
   `PolarLocations` local frame already rotates each location; the drill cylinder is oriented
   along the local radial axis). First hole on +X to match the raster framing.
3. **Bore:** through `Cylinder(radius=bore/2, height=h*3, mode=Mode.SUBTRACT)`, **last**.

**Orientation:** first hole on +X; `n_holes` equally spaced (360/n_holes). Rotationally
symmetric at the N hole positions → `NUT_PRESET` unchanged.

**Guards (ValueError):**

1. `d, h, bore, hole_d, hole_depth` all `> 0`; `n_holes` a positive integer.
2. `hole_d < h - 2*_MIN_WALL_MM` (the radial hole fits within the height, leaving a wall band
   above and below it).
3. `hole_depth < d/2 - bore/2 - _MIN_WALL_MM` (the hole floor stays outside the bore wall —
   the hole does not break into the thread). If the sourced geometry is a full diametral
   through-hole rather than a blind radial hole, `hole_depth` is set so the drill spans the
   wall without reaching the bore, and this guard still holds; the exact value is resolved at
   the data task (see below).
4. `n_holes * hole_d < math.pi * d` (the holes fit around the OD circumference).
5. `bore < d - 2*_MIN_WALL_MM` (wall between bore and OD).
6. Final `part.volume > 0`.

### Shape questions resolved at the data (sourcing) task

The generators are parametric; two `din1816` shape details are pinned by the SDD **sourcing
pass** (≥2 independent public tables + the legacy raster), NOT assumed here:

1. **Hole axial position** — mid-height unless a table dimensions it otherwise. The raster's
   profile hints the holes may sit off-centre; the sourcer confirms before the data task
   writes. If off-centre, the generator gains a `hole_z` offset (documented then).
2. **Concentric top-face step** — the raster face view shows a heavy inner ring. The sourcer
   checks whether DIN 1816 carries a tabulated top-face step/boss (a real feature, per the
   DIN 467 lesson) or whether the ring is only the pin-hole pitch circle (envelope-only). If a
   real step is tabulated, it is modelled; if not, it is dropped. This decision and its
   sourcing are written to `.superpowers/sdd/sourcing-decision.md`.

## Data

New `catalog/dimensions/round_face_nuts.json`. Two entries, distinct families, no aliases.

| id        | family           | fields (all sourced ≥2 tables)            | bore               |
| --------- | ---------------- | ----------------------------------------- | ------------------ |
| `din546`  | slotted_face_nut | `d, h, bore, slot_w, slot_depth`          | M12 coarse minor   |
| `din1816` | cross_hole_nut   | `d, h, bore, n_holes, hole_d, hole_depth` | M12×1.5 fine minor |

- `din546` bore = M12 coarse minor (~10.1); `din1816` bore = **M12×1.5 fine minor** (~10.4) —
  sourced per standard, not the coarse constant.
- Every dimension confirmed by **≥2 independent public tables**. Shape features (slot depth,
  hole count/diameter/axial position, any top step) verified against the legacy raster **and**
  the tables before shipping (DIN 467 boss lesson). Each `source` string states which fields
  are tabulated vs representative and cites only public tables — never a private/internal
  catalogue (no `reyher`, `stalmut`).
- `verified: true`; `designations` per standard.

## Registration & render

- `catalog/models/_registry.py`: add `"slotted_face_nut": slotted_face_nut` and
  `"cross_hole_nut": cross_hole_nut` to `KNOWN_FAMILIES` (+ imports). 22 families total.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("nut")` → `NUT_PRESET`.

## Testing

- `catalog/tests/test_slotted_face_nut.py` (generator; `_solid_at(part, x, y, z)` 3D probe via
  `part.intersect(Pos*Box) is not None`):
  - **Envelope:** `bbox.size.Z == h`; OD present at a point off the slot axis near `d/2`.
  - **Slot notches the top face:** void along the slot band near the top face on the X axis;
    solid at the same X below the slot floor (partial depth — the slot does not reach the
    bottom). Void off-axis in Y only within `slot_w/2`.
  - **Open bore:** void on the axis; wall present between bore and body off the slot.
  - **Guards** each raise; a valid config builds `volume > 0`.
- `catalog/tests/test_cross_hole_nut.py` (generator):
  - **Envelope:** `bbox.size.Z == h`; OD present between holes.
  - **Holes notch the wall:** at each of the N hole angles there is void near the OD at
    mid-height (radius `d/2 - hole_depth/2`); at a between-hole angle there is solid at the
    same radius — discriminates holes from the wall and confirms the hole count.
  - **Wall band above/below:** solid at a hole angle near the OD at the top and bottom faces
    (the radial hole leaves a wall band above and below it).
  - **Hole floor leaves a wall to the bore:** solid between the hole floor and the bore.
  - **Open bore:** void on the axis; wall present between bore and body.
  - **Guards** each raise; a valid config builds `volume > 0`.
- `catalog/tests/test_round_face_nuts_data.py` (data): each entry validates + builds,
  family/hardwareType correct, sourced + verified, no forbidden source token.
- Existing tests stay green; existing SVGs stay byte-identical (no shared code changed —
  `_MIN_WALL_MM` is only imported).

Generator geometry tests use **synthetic** fixtures (not any real standard); real dimensions
come from the controller sourcing pass at the data task (as with lock/knurled/slotted-round).

## Rollout / invariants

- **Opt-in 0/0.** In-container only (`./catalog/run`). Build produces 2 new drawings
  (`din546`, `din1816`); no existing drawing changes (byte-identical). `image-mappings.json`
  and `src/lib/data/standards-generated.ts` stay untouched (`grep -c '.svg'` → 0 for both).
- Build entrypoint in-container is `python -m catalog.build_catalog`.
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, thinking=high — two new
  generators are shared surfaces) → apply findings as additional commits → CI green →
  squash-merge (admin).

## Global constraints (verbatim)

- Representative size **M12**. Ships `din546` + `din1816`.
- Every committed dimension confirmed by **≥2 independent public tables**; any representative
  field documented as such, never fabricated as normative. Shape features (slot depth, hole
  count/size/axial position, any top step) verified against the raster + tables, not one
  table.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- Two new base shapes — do **not** touch `_chamfered_hex_solid` or any existing generator;
  existing SVGs byte-identical.
- **No render/preset change.** Both axisymmetric round bodies → NUT_PRESET unchanged.
- opt-in invariant 0/0 after build.
