# DIN 508 T-Slot Nut Family Catalog — Design

**Date:** 2026-07-17
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Predecessors:** plain hex (#91), flange (#92), cap (#93), castle (#94), collar (#95),
square (#96/#97), wing (#98/#99), lock (#101), knurled (#102/#103), slotted-round (#104),
round face/cross-drive (#105), coupling hex (#106)

## Goal

Add a single-standard **T-slot nut** family — the last genuinely-new nut shape — covering
`din508` (Nutenstein / T-slot nut for machine-tool tables) at a representative size. A DIN 508
nut is NOT a threaded-rod nut: it is a **stepped-T prismatic block** (a wide foot that engages
the T-slot undercut + a narrower neck) with a threaded bore running through it, that slides
along a machine-table T-slot to anchor a clamping bolt.

Ships the **14 mm slot / M12** pairing (keeps the catalog's M12 theme). New generator; imports
only `_MIN_WALL_MM` from `hex_nut`; `hardwareType: "nut"` → existing NUT_PRESET.

## Non-goals

- **No thread drawn** — the internal thread is a fine feature, envelope-only (family rule).
- **No render/preset change.** The block is oriented so its iconic T lands in the profile view
  under the existing NUT_PRESET (see Orientation). No new preset.
- **No ISO 299 alias.** DIN 508 was withdrawn / is interchangeable with ISO 299, but only
  `din508` carries a legacy raster (the toggle-replacement target); there is no `iso299`
  raster to cover, so no alias is created.
- **No other T-slot standards** (DIN 508 is the T-slot nut; DIN 787 T-bolts, DIN 6323 clamps
  are different parts/shapes) — out of scope.
- **No sizes beyond the 14 mm-slot / M12 representative.** No user-facing toggle (epic END
  goal, gated on full coverage).

## Silhouette to match

| Legacy raster | Standard | Shape                                                       |
| ------------- | -------- | ----------------------------------------------------------- |
| `din_508.png` | din508   | stepped-T block: wide foot + narrow neck, top chamfer, bore |

- **Plan view** (looking down the bore axis): a rectangle (foot outline) with the threaded
  bore + thread ring, and the neck step edges shown as lines inside the rectangle.
- **Profile view** (looking along the length): the **T cross-section** — a wide foot at the
  bottom, a step in to a narrower neck on top with chamfered top corners, and the bore.

## Architecture

New generator `catalog/models/tslot_nut.py`. Imports **only** `_MIN_WALL_MM` from `hex_nut`;
does not touch `_chamfered_hex_solid` or any existing generator.

```python
def tslot_nut(length, foot_w, neck_w, foot_h, height, bore, chamfer=None):
    ...
```

**Construction (additive body + subtractive bore):**

1. **Foot:** a `Box(foot_w, length, foot_h)` (X = width, Y = length, Z = height) with its
   bottom face on z = 0 (`Align.MIN` on Z) — the wide flange that sits in the slot undercut.
2. **Neck:** a `Box(neck_w, length, height - foot_h)` unioned on top of the foot (its bottom
   face at z = foot_h), `neck_w < foot_w` — the narrower section that rises through the slot
   opening. Same `length` and centred on X, so the step is symmetric on both sides.
3. **Top chamfer (optional):** when `chamfer` is given, a 45° chamfer of leg `chamfer` on the
   two top outer edges of the neck (the edges running along Y at z = height, at x = ±neck_w/2)
   — the eased top corners in the raster. Omitted when `chamfer is None`.
4. **Bore:** subtract a through `Cylinder(bore/2, height*3)` along Z (the height axis), centred
   on the block, **last** (like `hex_nut`).

Net guard on `part.volume > 0` (not `is_valid` — sewn-shell gotcha).

### Orientation (NUT_PRESET reuse)

The block's **length runs along Y**, width (foot_w/neck_w) along X, height + bore along Z.
Under the existing NUT_PRESET the plan view looks down −Z and the profile looks along −Y:

- **Plan (−Z):** X (width) × Y (length) → the `foot_w × length` rectangle + the bore, with the
  neck step edges inside it — matches the raster plan view.
- **Profile (−Y):** X (width) × Z (height) → the wide-foot / narrow-neck **T cross-section**
  with the bore — matches the raster profile.

This is the same "orient so the iconic shape lands in a rendered view" trick used for
`wing_nut`; NUT_PRESET is reused, **no preset change**. As with the other nuts, the profile may
show the bore axis horizontal (catalog convention vs. the raster's vertical bore) — a known
consistent deviation; the drawing is visually confirmed at build.

### Guards (ValueError)

1. `length, foot_w, neck_w, foot_h, height, bore` all `> 0`.
2. `neck_w < foot_w` (the foot is the wider T-crossbar; equal/inverted would not be a T).
3. `foot_h < height` (a real neck of positive height remains above the foot).
4. `bore < neck_w - 2*_MIN_WALL_MM` (the bore fits within the NARROW neck, leaving a wall on
   each side — the neck, not the foot, is the binding width).
5. When `chamfer` is given: `chamfer > 0`, `chamfer < neck_w / 2`, and `chamfer < height -
foot_h` (the chamfer stays within the neck's width and height).
6. Final `part.volume > 0`.

## Data

New `catalog/dimensions/tslot_nuts.json`. One entry, no aliases. Shape =
`{length, foot_w, neck_w, foot_h, height, bore, chamfer}`.

| id       | family    | fields (all sourced ≥2 tables)                    | bore             |
| -------- | --------- | ------------------------------------------------- | ---------------- |
| `din508` | tslot_nut | `length, foot_w, neck_w, foot_h, height, chamfer` | M12 coarse minor |

Representative M12 / 14 mm-slot values from the sourcing pass (confirm ≥2 public tables at the
data task): `foot_w ≈ 22` (a), `height ≈ 16` (h), foot/step split from `k ≈ 8` (so `foot_h ≈
height − k`), `length ≈ 22` (l), `bore = 10.1` (M12 coarse minor). `neck_w` carries a **known
symbol inconsistency** across tables (≈14, i.e. the slot width, vs ≈16 in some) — the data task
resolves it against ≥2 tables and the raster and states the choice in the `source` string; the
neck must stay narrower than the foot and wider than `bore + 2*_MIN_WALL_MM`. The top `chamfer`
is a representative value (the eased top corner is visible in the raster; its exact leg is
rarely tabulated) documented as such. Each `source` string cites only public tables — never a
private/internal catalogue (no `reyher`, `stalmut`).

## Registration & render

- `catalog/models/_registry.py`: add `"tslot_nut": tslot_nut` to `KNOWN_FAMILIES` (+ import).
  23 families total.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("nut")` → NUT_PRESET.

## Testing

- `catalog/tests/test_tslot_nut.py` (generator; `_solid_at(part, x, y, z)` 3D probe via
  `part.intersect(Pos*Box) is not None`, SYNTHETIC fixtures):
  - **Envelope:** bbox X = `foot_w`, Y = `length`, Z = `height`; `volume > 0`.
  - **Stepped T (the defining feature):** solid at the foot corners (x near `±foot_w/2`, low z
    within the foot band) AND void just above the foot at the same x (x beyond `±neck_w/2`, z in
    the neck band) — this discriminates the narrow neck from the wide foot (a plain box would be
    solid there).
  - **Neck present:** solid within the neck band (x within `±neck_w/2`, z in the neck band).
  - **Open bore:** void on the axis through the full height; wall present between bore and the
    neck sides.
  - **Chamfer (when given):** void at the extreme top outer corner of the neck (x near
    `±neck_w/2`, z near `height`) — the corner is cut.
  - **Guards** each raise (each ValueError branch); a valid config builds `volume > 0`.
- `catalog/tests/test_tslot_nuts_data.py` (data): the entry validates + builds,
  family/hardwareType correct, sourced + verified, no forbidden source token.
- Existing tests stay green; existing SVGs stay byte-identical (no shared code changed —
  `_MIN_WALL_MM` is only imported).

Generator geometry tests use **synthetic** fixtures (not the real standard); real dimensions
come from the controller sourcing pass at the data task (as with prior families).

## Rollout / invariants

- **Opt-in 0/0.** In-container only (`./catalog/run`). Build produces 1 new drawing
  (`din508`); no existing drawing changes (byte-identical). `image-mappings.json` and
  `src/lib/data/standards-generated.ts` stay untouched (`grep -c '.svg'` → 0 for both).
- Build entrypoint in-container is `python -m catalog.build_catalog`.
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, thinking=high — a new
  generator is a shared surface) → apply findings as additional commits → CI green →
  squash-merge (admin).

## Global constraints (verbatim)

- Representative size **14 mm slot / M12**. Ships `din508`.
- Every committed dimension confirmed by **≥2 independent public tables**; any representative
  field (chamfer, and the neck-width symbol choice) documented as such, never fabricated as
  normative. Shape (wide foot / narrow neck / top chamfer / through bore) verified against the
  raster + tables.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- A new base shape — does **not** touch `_chamfered_hex_solid` or any existing generator;
  existing SVGs byte-identical.
- **No render/preset change.** Length-along-Y orientation → the T lands in the profile view →
  NUT_PRESET unchanged.
- opt-in invariant 0/0 after build.
