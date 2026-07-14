# Wing Nut Family Catalog — Design

**Date:** 2026-07-13
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Predecessors:** plain hex (#91), flange (#92), cap (#93), castle (#94), collar (#95),
square (#96/#97)

## Goal

Add a **wing nut** family (DIN 315, German Form D — "rounded wings") to the
maintainer-only generative catalog. New geometry: a cylindrical threaded boss with two
rounded finger wings. It does **not** reuse `_chamfered_hex_solid`. Ship DIN 315 at M12
(`din315`).

## Non-goals

- **No American Form A** (the smaller rectangular-wing sub-form: span ~47–49, height
  ~22–24). Sources disagree between revisions on Form A numbers; we ship one representative
  size, the common German Form D, like every other family.
- **No DIN 314** (edged/pointed wings — a separate standard, not a form of DIN 315).
- No render/preset change (wing nuts are `hardwareType: "nut"` → existing `NUT_PRESET`; the
  wing orientation is set by the generator).
- No modelling of the disputed inner step (`d3`/`ds`) or root fillet (`r`) — representative
  form only, not asserted geometry.
- No user-facing toggle. No sizes beyond M12.

## Sourcing (DIN 315 German Form D, M12)

Two independent sourcings agreed. DIN 315 is **current** (edition DIN 315:2016-12,
"Wing nuts — Rounded wings"; no ISO equivalent). Every **envelope** dimension is confirmed
by 4+ independent public tables (fasteners.eu, Fuller Fasteners, schrauben-lexikon,
ITA Fasteners, globalfastener, fasten.it). The **form and profile** features are flagged
as representative, not fabricated:

| Field    | Value | Symbol | Status                                                    |
| -------- | ----- | ------ | --------------------------------------------------------- |
| `bore`   | 10.1  | D₁     | M12 thread minor — from ISO 724, **not** DIN 315's table  |
| `height` | 33.5  | h/k    | tabulated (max; min 31)                                   |
| `boss_d` | 23.0  | d2/dk  | tabulated (max; min 20)                                   |
| `span`   | 65.0  | e/L    | tabulated (max; min 62) — tip-to-tip across wings         |
| `wing_t` | 4.9   | g1/y   | tabulated (max; min 4.1) — blade thickness                |
| `tip_r`  | 10.0  | R/r1   | tabulated but **approximate** (reference radius, no tol.) |
| `boss_h` | 14.0  | (m)    | **representative** hub height — see note                  |

- **`boss_h` note:** no source tabulates a standalone boss/hub height. The DIN `m` symbol
  (10–14) is read inconsistently across reproductions (one calls it hub height, another
  wing thickness), so `boss_h=14.0` is used as a **representative** hub height (the `m`-max
  reading), documented as form — not asserted as a normative dimension.
- **Wing depth / wing rise / exact rounded profile:** not tabulated by any source. The wing
  is a form feature manufacturers draw freely; the model uses the tabulated envelope
  (`span`, `height`, `wing_t`, `tip_r`) and treats the neck-to-hub blend and the exact arc
  as representative form.
- Source strings cite only public tables — never any private/internal catalogue.

## Architecture

New generator `catalog/models/wing_nut.py`:

```python
def wing_nut(bore, boss_d, boss_h, span, height, wing_t, tip_r):
    ...
```

**Orientation.** The boss axis is Z (bore drilled along Z, so the axial "front" view shows
the boss circle + bore). The two wings live in the **XZ plane** — they spread along ±X
(the view's shared up axis) and rise toward +Z, with the blade thickness along Y. This is
the only orientation where the iconic butterfly silhouette lands in a rendered view: the
**side/profile view** (looks along −Y, sees XZ). Because the boss axis is Z, that profile
draws the butterfly with the **axis horizontal and the wings up/down** — consistent with
every other nut's profile view (axis always horizontal here), so **no preset change** is
needed. The axial "front" view then shows the boss circle, the bore, and the two wings
edge-on as bars. The framing is confirmed visually at build time (as with the square nut);
no new preset is introduced in this family.

**Construction (union, like `collar_nut`):**

1. **Boss:** `Cylinder(radius=boss_d/2, height=boss_h)` aligned `Z=MIN` at z=0 — the hub
   from the bearing face up.
2. **Two rounded wings:** for each side (+X and −X), a flat rounded lobe of thickness
   `wing_t` extruded along Y (centered on Y=0), built in the XZ plane as a rounded outer
   lobe (outer arc of radius `tip_r`, its outer edge at `x = ±span/2`, its top at
   `z = height`) on a neck that blends inward and down to the boss. The two lobes are
   mirror images across x=0 and do **not** meet at the center: the gap between them leaves
   the hub top exposed as the **central dip** of the German Form D. Unioned to the boss.
3. **Bore:** subtract a through `Cylinder(radius=bore/2, height=height*3)` along Z **last**,
   like `hex_nut`.

Derived lobe placement (from the tabulated envelope): lobe radius `tip_r`, lobe center at
`x_c = span/2 - tip_r`, `z_c = height - tip_r`; with the shipped M12 values the lobe bottom
(`z_c - tip_r = height - 2*tip_r = 13.5`) sits at the boss top (`boss_h = 14`), so the wings
perch on the hub and rise above it — the expected proportion.

### Guards (ValueError)

1. `bore > 0`; `boss_d`, `boss_h`, `span`, `height`, `wing_t`, `tip_r` all `> 0`.
2. `boss_d > bore + 2*_MIN_WALL_MM` (a wall between the bore and the boss outer wall;
   reuse `hex_nut`'s `_MIN_WALL_MM = 0.1`, the only import from `hex_nut`).
3. `span > boss_d` (wings must reach beyond the hub, else there is nothing to grip).
4. `height > boss_h` (wings must rise above the hub).
5. `tip_r <= height / 2` (the outer lobe fits below the top face: `z_c - tip_r >= 0`).
6. `span/2 - tip_r > boss_d/2` (the two lobes clear the hub center, leaving the central
   dip — else the wings would merge into a single fin).
7. Final `part.volume > 0` net guard (matches the family; not `is_valid`).

## Data

New `catalog/dimensions/wing_nuts.json`. Shape =
`{bore, boss_d, boss_h, span, height, wing_t, tip_r}` (all explicit — no optional keys).

| id       | family   | bore | boss_d | boss_h | span | height | wing_t | tip_r |
| -------- | -------- | ---- | ------ | ------ | ---- | ------ | ------ | ----- |
| `din315` | wing_nut | 10.1 | 23.0   | 14.0   | 65.0 | 33.5   | 4.9    | 10.0  |

Single distinct entry (German Form D, M12). No aliases. `source` string records which
fields are tabulated vs representative (verbatim from the sourcing), citing only public
tables.

## Registration & render

- `catalog/models/_registry.py`: add `"wing_nut": wing_nut` to `KNOWN_FAMILIES`.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("nut")` → `NUT_PRESET`. The butterfly framing is confirmed at
  build (visually), like the square nut.

## Testing

- `catalog/tests/test_wing_nut.py` (generator):
  - **Envelope extents:** the plan bounding box spans `span` across the wings and `height`
    along the axis (axis is Z; wings along X); thickness reads `wing_t` along Y.
  - **Two distinct wings / central dip:** at the top of the part (`z ≈ height`) there is
    material out at both wing tips (`|x| ≈ span/2`) but a gap over the hub center
    (no wing material at `x ≈ 0`, `z` near the top) — the two lobes are separate.
  - **Rounded lobe:** the wing outline is rounded (the outer/top corner is not a sharp
    right angle) — a vertex sample near the tip sits inside the square corner the envelope
    would give.
  - **Boss + open bore:** the hub diameter reads `boss_d`; the bore removes material
    (holed volume < solid-bore volume).
  - **All guards raise** (each ValueError branch).
- `catalog/tests/test_wing_nuts_data.py` (data): the entry validates + builds,
  family/hardwareType correct, sourced + verified, no forbidden source token.
- Existing hex/flange/cap/castle/collar/square/washer tests stay green; existing SVGs stay
  byte-identical (no shared code changed — `_MIN_WALL_MM` is only imported).

## Rollout / invariants

- **Opt-in 0/0.** In-container only. Build produces 1 new drawing (`din315`); no existing
  drawing changes (byte-identical).
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, new generator is a
  shared surface) → apply findings as additional commits → CI green → squash-merge (admin).

## Global constraints (verbatim)

- Representative size **M12**. Ships German Form D (`din315`).
- Every committed **envelope** dimension confirmed by **≥2 independent public tables**;
  representative form fields (`boss_h`, wing profile) documented as such, never fabricated
  as normative.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- New base shape — does **not** touch `_chamfered_hex_solid` or any existing generator;
  existing SVGs byte-identical.
- **No render/preset change.** Wing orientation set by the generator (wings in the XZ plane).
- opt-in invariant 0/0 after build.
