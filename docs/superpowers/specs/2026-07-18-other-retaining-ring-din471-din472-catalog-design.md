# DIN 471 / DIN 472 Retaining-Ring Family Catalog — Design

**Date:** 2026-07-18
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `other` / `ring` — first family in this category (nut category complete)
**Predecessors:** plain hex (#91) … slotted-round (#104), round face/cross-drive (#105),
coupling hex (#106), T-slot (#107), nut-skip docs (#108)

## Goal

Add a **retaining-ring** family covering `din471` (external circlip, for a shaft) and
`din472` (internal circlip, for a bore) at **nominal size 12**. A retaining ring is a flat
stamped split ring (a C with a gap) whose radial section **tapers** from the enlarged eared
lugs at the free ends to the narrower back opposite the gap, with a **plier hole** in each
lug. It snaps into a groove to axially locate a shaft or bore.

One new generator; imports only `_MIN_WALL_MM` from `hex_nut`; `hardwareType: "other"` →
the existing default preset `DEFAULT_AXIS_Z` (there is no separate "washer preset" —
`preset_for_hardware_type` returns `NUT_PRESET` only for `"nut"` and `DEFAULT_AXIS_Z` for
everything else, and washers already render through it). Flat part: face view down the axis +
thin edge view. No preset change.

## Non-goals

- **No thread** — a circlip has none.
- **No render/preset change.** It is a flat part; the default preset `DEFAULT_AXIS_Z` already
  renders flat parts (face + thin edge), like every washer family. No new preset.
- **No sizes beyond nominal 12.** No user-facing toggle (epic END goal, gated on full coverage).
- **No `din1479` turnbuckle** — an elongated rigging body, a distinct shape; its own family later.
- **No `din_6921` flange-bolt group** (`iso4162`, `din6915`, `iso15071`, `iso15072`) — these
  share the hex-flange-bolt raster and need the screw head+shank preset; they belong to the
  screw category, not here.
- **No other retaining-ring standards** (DIN 6799 E-clip, circlips for other sizes/forms) —
  out of scope for this family.

## Silhouette to match

| Legacy raster | Standard | Shape                                                             |
| ------------- | -------- | ----------------------------------------------------------------- |
| `din_471.png` | din471   | external circlip: tapered split C, two outward eared lugs + holes |
| `din_472.png` | din472   | internal circlip: tapered split C, two eared lugs + holes         |

- **Face view** (front, looking down the Z axis, with X rendered as up): the iconic tapered
  **C** — a near-complete ring with a gap, widest section at one end, narrowing to the other,
  with the two eared lugs each carrying a round plier hole. External: material grows outward
  from the seated inner edge, lugs point out. Internal: material grows inward from the seated
  outer edge, lugs point in.
- **Edge view** (side, looking along −Y): a thin flat rectangle (axial thickness `s`) — a
  stamped part, like a washer edge.

## Architecture

New generator `catalog/models/retaining_ring.py`. Imports **only** `_MIN_WALL_MM` from
`hex_nut`; does not touch any existing generator.

```python
def retaining_ring(d_seat, thickness, w_lug, w_back, gap_deg,
                   lug_hole_d, lug_project, internal=False):
    ...
```

**Parameters**

- `d_seat` — diameter of the **constant-radius seated edge** (the groove-contact circle).
  External (471): this is the ring's **inner** edge (grips the shaft groove `d2`).
  Internal (472): the ring's **outer** edge (grips the bore groove `d2`).
- `thickness` — axial thickness `s` (the stamped strip thickness).
- `w_lug` — radial section width at the free ends (the lug region).
- `w_back` — radial section width 180° opposite the gap. The taper interpolates linearly
  between `w_back` (at the back) and `w_lug` (at the ends) by angular distance from the back.
- `gap_deg` — angular opening between the two free ends (the split).
- `lug_hole_d` — plier-hole diameter (one hole per lug).
- `lug_project` — how far each eared lug projects radially past the tapered body at the free
  ends (the enlarged ear).
- `internal` — `False` (default) grows the section **outward** from `d_seat`, lugs point out
  (DIN 471). `True` grows it **inward** toward the axis, lugs point in (DIN 472).

**Single generator with an `internal` flag** (not two functions): external and internal are a
pure radial mirror — a sign flip on the direction the width and lugs grow from `d_seat`. This
mirrors `tab_washer`'s `internal` tab flag rather than the two-function split the toothed
washers use, since here nothing but the sign changes.

**Construction (flat part, built in XY, thin `Z` extrude — same convention as every washer):**

Let `sign = +1` external / `-1` internal, `r_seat = d_seat / 2`. The default preset renders X
as up (front_up = X), so center the gap on the `+X` axis: the two lugs then straddle the top of
the face view, matching the raster. Measuring `θ` from `+X`, the material arc runs from
`θ = +gap_deg/2` to `θ = 360° − gap_deg/2` (the back, at minimum width, sits at `θ = 180°`, the
`−X` axis).

1. **Tapered C body:** sample the material arc. At each `θ`, the seated edge is at `r_seat`
   (constant) and the other edge is at `r_seat + sign * width(θ)`, where
   `width(θ) = w_back + (w_lug − w_back) * (angular distance of θ from the back) / (180° − gap_deg/2)`
   (so `width = w_back` at the back, `width = w_lug` at each free end). Build the closed C-face
   from a `BuildLine`: outer spline (sampled), a cap line at one free end, the inner spline
   back, a cap line at the other free end; `make_face`.
2. **Extrude:** `extrude(amount=thickness/2, both=True)` — thin body centered on `z = 0`.
3. **Eared lugs:** at each free end, fuse a rounded ear — a `Cylinder` (axis `Z`, height
   `thickness`) of radius `(w_lug + lug_project)/2`, centered on the free-end section so its
   outer reach is `r_seat + sign*(w_lug + lug_project)` — the enlarged eyelet in the raster.
4. **Plier holes:** subtract a through `Cylinder(lug_hole_d/2, thickness*3)` along `Z` at each
   lug center, **last**.

Net guard on `part.volume > 0` (not `is_valid` — sewn-shell gotcha, per wave_washer).

### Orientation (default preset reuse)

The ring lies in the XY plane, thickness along Z. Under `DEFAULT_AXIS_Z` the front view looks
down Z (the tapered C + lugs + holes — matches the raster) and the side view looks along −Y,
showing the thin Z extent (a flat rectangle — matches the stamped-part edge). Same "flat part
in XY" convention as every washer family; the default preset is reused, **no preset change**.

### Guards (ValueError)

1. `d_seat, thickness, w_lug, w_back, lug_hole_d, lug_project` all `> 0`.
2. `0 < gap_deg < 180` (a real opening, but still a C-ring, not a bare arc).
3. **Internal only** — inner radius must stay positive: `max(w_lug, w_back) + lug_project <
d_seat/2 − _MIN_WALL_MM` (growing inward cannot cross the axis or leave a sliver).
4. `lug_hole_d < w_lug + lug_project − 2*_MIN_WALL_MM` (the plier hole leaves a wall inside the
   ear on each side).
5. Final `part.volume > 0`.

## Data

New `catalog/dimensions/retaining_rings.json`. Two entries, no aliases. Shape =
`{d_seat, thickness, w_lug, w_back, gap_deg, lug_hole_d, lug_project, internal}`.

| id       | family         | internal | fields (all sourced ≥2 tables)                           |
| -------- | -------------- | -------- | -------------------------------------------------------- |
| `din471` | retaining_ring | false    | d_seat(=d2 shaft groove), thickness s, widths, gap, hole |
| `din472` | retaining_ring | true     | d_seat(=d2 bore groove), thickness s, widths, gap, hole  |

**Sourcing gate (controller, before the data task).** DIN 471 and DIN 472 publish extensive
size tables. For **nominal size 12** confirm from **≥2 independent public tables**: shaft/bore
`d1 = 12`, groove diameter `d2`, thickness `s`, the section widths (the standard tabulates a
width at the lugs `a` and a width `b`; **which is the wider end / the taper direction is
resolved at the gate against the raster**), the lug plier-hole diameter, and a representative
`gap` (the free-state opening; tabulated less consistently — documented as representative if
resolved from the raster/drawing rather than a number). `d_seat` maps to `d2` (the groove the
ring seats in). `lug_project` (ear projection past the body) is representative if not cleanly
tabulated — documented as such. Each `source` string cites only public tables — **never** a
private/internal catalogue (no `reyher`, `stalmut`). If the tables cannot agree on the taper
direction or a width, adjudicate against the raster and state the choice (DIN 467 boss / DIN
1816 flip-side rule: model a feature the raster **and** tables both show; do not fabricate one
they disagree on).

## Registration & render

- `catalog/models/_registry.py`: add `"retaining_ring": retaining_ring` to `KNOWN_FAMILIES`
  (+ import). 24 families total.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("other")`, which returns `DEFAULT_AXIS_Z` (confirmed: only `"nut"`
  gets `NUT_PRESET`; everything else, washers included, uses `DEFAULT_AXIS_Z`). No preset change.

## Testing

- `catalog/tests/test_retaining_ring.py` (generator; `_solid_at(part, x, y, z)` 3D probe via
  `part.intersect(Pos*Box) is not None`, SYNTHETIC fixtures):
  - **Envelope / thickness:** bbox Z ≈ `thickness`; `volume > 0`; face extent within the
    seated + widened radius.
  - **Taper (defining feature):** the section is wider at the free ends than at the back (or
    vice-versa, per the sourced direction) — probe solid extent at the lug angle vs the back
    angle and assert they differ in the modeled direction. Discriminates a tapered ring from a
    constant-width one.
  - **Gap is void:** no material across the gap wedge (probe on the seated circle at the gap
    center angle → void).
  - **Lug + hole:** solid at each lug ear (beyond the body reach) AND void on the hole axis
    through the thickness, with a wall between hole and the ear edge.
  - **External vs internal flip:** external → material **outside** `d_seat` and void just
    inside; internal → material **inside** `d_seat` and void just outside. Same synthetic
    dims, `internal` toggled.
  - **Guards** each raise (each ValueError branch); a valid config builds `volume > 0`.
- `catalog/tests/test_retaining_rings_data.py` (data): both entries validate + build,
  family/hardwareType correct, sourced + verified, no forbidden source token.
- Existing tests stay green; existing SVGs stay byte-identical (no shared code changed —
  `_MIN_WALL_MM` is only imported).

Generator geometry tests use **synthetic** fixtures (not the real standard); real dimensions
come from the controller sourcing pass at the data task (as with prior families).

## Rollout / invariants

- **Opt-in 0/0.** In-container only (`./catalog/run`). Build produces 2 new drawings
  (`din471`, `din472`); no existing drawing changes (byte-identical). `image-mappings.json` and
  `src/lib/data/standards-generated.ts` stay untouched (`grep -c '.svg'` → 0 for both).
- Build entrypoint in-container is `python -m catalog.build_catalog`.
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, thinking=high — a new
  generator is a shared surface) → apply findings as additional commits → CI green →
  squash-merge (admin).

## Global constraints (verbatim)

- Representative size **nominal 12** (12 mm shaft for `din471`, 12 mm bore for `din472`).
  Ships `din471` + `din472`.
- Every committed dimension confirmed by **≥2 independent public tables**; any representative
  field (ear projection, gap, and the taper-direction choice) documented as such, never
  fabricated as normative. Shape (tapered split C + eared lugs + plier holes + thin flat
  section) verified against the raster + tables.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- A new base shape — does **not** touch any existing generator; existing SVGs byte-identical.
- **No render/preset change.** Flat part in XY → default preset `DEFAULT_AXIS_Z` unchanged.
- opt-in invariant 0/0 after build.
