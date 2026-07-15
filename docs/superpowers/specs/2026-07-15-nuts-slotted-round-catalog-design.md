# Slotted Round Nut Family Catalog — Design

**Date:** 2026-07-15
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Predecessors:** plain hex (#91), flange (#92), cap (#93), castle (#94), collar (#95),
square (#96/#97), wing (#98/#99), lock (#101), knurled (#102/#103)

## Goal

Add a **slotted round nut** family to the maintainer-only generative catalog: a round
cylindrical body with **N radial slots cut into the outer diameter, opening partway from one face** (for a hook
or face spanner) and a through bore. Covers `din981` (rolling-bearing locknut, KM type) and
`din70852` (groove nut) — the same OD-slotted shape at different dimensions. Ships M12.

This is the first sub-family of the "round nut" group (the other drive styles — face
pin-holes `din1816`, diametral face slot `din546` — are separate follow-up families). It
extends the round cylindrical body established by `knurled_nut` and reuses `castle_nut`'s
`PolarLocations` + `Box`-subtract slot pattern.

## Non-goals

- **No keyway modelled.** `din981` (bearing locknut) has a small internal keyway on the bore
  (for the MB tab washer). It is **not** modelled: it is a single notch that would break the
  body's rotational symmetry (complicating the profile-view orientation) and is a minor
  internal feature. The OD slots are the defining drive feature. Documented as not-modelled.
- **No knurl/thread/fine-chamfer drawn** — fine features, envelope-only (as the family rule).
- **No render/preset change.** Slotted round nuts are `hardwareType: "nut"` → existing
  `NUT_PRESET`. The body is rotationally symmetric at the N slot positions.
- **No other round-nut drive styles** (face holes `din1816`, face slot `din546`) — separate
  families. **No `din1804`** (slotted round nut for hook spanner) — it has no legacy raster,
  so there is nothing to replace.
- **No sizes beyond M12.** No user-facing toggle (epic END goal, gated on full coverage).

## Silhouettes to match

| Legacy raster   | Standard | Drive                                             |
| --------------- | -------- | ------------------------------------------------- |
| `din_981.png`   | din981   | round body, N radial slots in the OD (KM locknut) |
| `din_70852.png` | din70852 | round body, N radial slots in the OD (groove nut) |

Face (axial) view: the OD circle with N rim notches at the slot angles, plus the bore.
Profile view: a rectangle (`d` × `h`) with edge notches where the slots cut in.

## Architecture

New generator `catalog/models/slotted_round_nut.py`. Imports **only** `_MIN_WALL_MM` from
`hex_nut`; it does **not** touch `_chamfered_hex_solid` or any existing generator.

```python
def slotted_round_nut(d, h, bore, n_slots, slot_w, slot_depth, slot_h):
    ...
```

**Orientation.** Body axis is Z (bore along Z). Rotationally symmetric at the N slot
positions → NUT_PRESET renders it without any preset change. The first slot is centred on +X
(the view's up axis), matching the raster framing.

**Construction (subtractive, like `castle_nut`'s slots but on a plain cylinder OD):**

1. **Body:** `Cylinder(radius=d/2, height=h)` spanning z ∈ [−h/2, h/2] (default
   `Align.CENTER`, centred on the origin) — so the full-height slot boxes (also origin-centred
   on Z) overshoot both faces symmetrically.
2. **N radial slots (partial depth):** inside `Locations((0,0,h/2))` (the top face),
   `PolarLocations(d/2, n_slots, start_angle=0)` places a `Box(2*slot_depth, slot_w,
slot_h*2, mode=Mode.SUBTRACT)` at each position. Centred on the top face, each box removes
   a `slot_depth`-deep (radial), `slot_w`-wide (tangential) notch that opens from the top face
   and reaches `slot_h` down (its upper half overshoots above the nut). The DIN 981/70852
   grooves are partial-depth (tabulated axial t/c < h), NOT full-height.
3. **Bore:** subtract a through `Cylinder(radius=bore/2, height=h*3)` along Z **last**, like
   `hex_nut`.

Guard on `part.volume > 0` (net guard; not `is_valid`).

### Guards (ValueError)

1. `d, h, bore` all `> 0`; `slot_w > 0`; `slot_depth > 0`; `slot_h > 0`; `n_slots` a positive integer.
2. `bore < d - 2*_MIN_WALL_MM` (wall between the bore and the OD).
3. `slot_h <= h` (the slot opens from one face and cannot exceed the nut height).
4. `slot_depth < d/2 - bore/2 - _MIN_WALL_MM` (the slot floor leaves a wall to the bore, so
   the slot cannot cut through to the thread).
5. `n_slots * slot_w < math.pi * (d - 2*slot_depth)` (the slots fit around the slot-floor
   circumference; the towers between them survive) — the tightened `castle_nut` guard.
6. Final `part.volume > 0`.

## Data

New `catalog/dimensions/slotted_round_nuts.json`. Shape =
`{d, h, bore, n_slots, slot_w, slot_depth, slot_h}` (all explicit).

| id         | family            | d       | h       | bore    | n_slots | slot_w  | slot_depth |
| ---------- | ----------------- | ------- | ------- | ------- | ------- | ------- | ---------- |
| `din981`   | slotted_round_nut | sourced | sourced | sourced | sourced | sourced | sourced    |
| `din70852` | slotted_round_nut | sourced | sourced | sourced | sourced | sourced | sourced    |

Two distinct standards, no aliases. Every field sourced from **≥2 independent public tables**.
**`bore` is the fine-thread minor diameter** for each standard (din981 is KM/bearing-locknut
fine thread, din70852 is a fine-pitch groove nut), so `bore ≠ 10.1` (the coarse M12 constant)
— it is sourced per standard, not assumed. `n_slots`, `slot_w`, `slot_depth`, `slot_h` (axial groove depth t/c) and any top
chamfer are verified against the legacy raster **and** the tables before shipping (per the
DIN 467 boss lesson: a feature visible in the raster with its own tabulated dimension is
modelled, not dropped). Each `source` string states which fields are tabulated vs
representative and cites only public tables — never a private/internal catalogue.

## Registration & render

- `catalog/models/_registry.py`: add `"slotted_round_nut": slotted_round_nut` to
  `KNOWN_FAMILIES`.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("nut")` → `NUT_PRESET`.

## Testing

- `catalog/tests/test_slotted_round_nut.py` (generator; a 3D probe helper
  `_solid_at(part, x, y, z)` using `part.intersect(Pos(x,y,z)*Box(...)) is not None`):
  - **Envelope:** `bbox.size.Z == h`; the OD is present — material at a between-slot (tower)
    angle near radius `d/2`.
  - **Slots cut the OD:** at each of the N slot angles there is void near the OD (radius
    `d/2 - slot_depth/2`); at a between-slot angle there is solid at the same radius — this
    discriminates the notches from the towers and confirms the slot count.
  - **Slot floor leaves a wall:** solid between the slot floor and the bore (the slot does not
    reach the thread).
  - **Open bore:** void on the axis; wall present between bore and body.
  - **All guards raise** (each ValueError branch); a valid config builds with `volume > 0`.
- `catalog/tests/test_slotted_round_nuts_data.py` (data): each entry validates + builds,
  family/hardwareType correct, sourced + verified, no forbidden source token.
- Existing tests stay green; existing SVGs stay byte-identical (no shared code changed —
  `_MIN_WALL_MM` is only imported).

## Rollout / invariants

- **Opt-in 0/0.** In-container only (`./catalog/run`). Build produces 2 new drawings
  (`din981`, `din70852`); no existing drawing changes (byte-identical). `image-mappings.json`
  and `src/lib/data/standards-generated.ts` stay untouched (`grep -c '.svg'` → 0 for both).
- Build entrypoint in-container is `python -m catalog.build_catalog`.
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, new generator is a
  shared surface) → apply findings as additional commits → CI green → squash-merge (admin).

## Global constraints (verbatim)

- Representative size **M12**. Ships `din981` + `din70852`.
- Every committed dimension confirmed by **≥2 independent public tables**; any representative
  field documented as such, never fabricated as normative. Shape features (slot count/size)
  verified against the raster + tables, not just one table.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- New base shape — does **not** touch `_chamfered_hex_solid` or any existing generator;
  existing SVGs byte-identical.
- **No render/preset change.** Rotationally symmetric slotted body → NUT_PRESET unchanged.
- opt-in invariant 0/0 after build.
