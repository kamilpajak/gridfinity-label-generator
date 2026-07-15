# Knurled Nut Family Catalog — Design

**Date:** 2026-07-15
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Predecessors:** plain hex (#91), flange (#92), cap (#93), castle (#94), collar (#95),
square (#96/#97), wing (#98/#99), lock (#101)

## Goal

Add a **knurled nut** family (DIN 466 high + DIN 467 low) to the maintainer-only generative
catalog. New **cylindrical** geometry — the first round nut body — modelled as a smooth
cylinder (plus an optional lower collar/boss) with a through bore. It does **not** reuse
`_chamfered_hex_solid`. Ship the M12 representative size (`din466`, `din467`).

This closes two more nut-coverage gaps and establishes a reusable cylindrical-body base that
the later round-nut families (DIN 546 slotted, DIN 1816 face-hole, DIN 981 bearing locknut)
can build on by adding radial slots or face holes to the same body.

## Non-goals

- **No knurling drawn.** The knurl (fine diamond/straight serration on the OD) is the
  defining texture of these nuts, but — like the thread — it is too fine to draw at label
  scale. The generated drawings show the **smooth cylindrical envelope** only. This is the
  user-confirmed decision and matches the epic's "don't model fine features" convention.
  Consequence: DIN 467 reads as a plain disc and DIN 466 as a collared sleeve; the knurl is
  absent. On `/dev/asset-compare` the generated drawing will differ from the knurled raster.
- **No render/preset change.** Knurled nuts are `hardwareType: "nut"` → existing `NUT_PRESET`.
  The body is axisymmetric, so orientation is immaterial (axial view = concentric circles,
  profile view = a rectangle, stepped for DIN 466).
- **No edge chamfer modelled.** The small rim bevel on the rasters is a fine feature, dropped
  under the same envelope-only rule (YAGNI — add later only if fidelity demands it).
- **No sizes beyond M12.** No user-facing toggle (epic END goal, gated on full coverage).

## Silhouettes to match

| Legacy raster | Type | Form                                                                                |
| ------------- | ---- | ----------------------------------------------------------------------------------- |
| `din_467.png` | low  | a flat knurled **disc** — short cylinder, through bore                              |
| `din_466.png` | high | a taller knurled cylindrical **head on a narrower plain collar/boss**, through bore |

The head is drawn as a smooth cylinder. In the axial (face) view the head OD and the bore
project as concentric circles (plus the collar OD circle for DIN 466). In the profile view
the part is a rectangle (a stepped rectangle for DIN 466 — wide head over a narrow boss).

## Architecture

New generator `catalog/models/knurled_nut.py`. Imports **only** `_MIN_WALL_MM` from
`hex_nut` (the shared minimum-wall rule); it does **not** touch `_chamfered_hex_solid` or any
existing generator.

```python
def knurled_nut(d, h, bore, collar_d=None, collar_h=None):
    ...
```

**Orientation.** Body axis is Z (bore drilled along Z). The part is axisymmetric, so
NUT_PRESET renders it correctly without any preset change.

**Construction (union, like `collar_nut` but with a round body):**

1. **Head:** `Cylinder(radius=d/2, height=h)` aligned `Z=MIN` at the head's base — the
   knurled body, drawn smooth.
2. **Collar (DIN 466 only):** when `collar_d`/`collar_h` are given, `Cylinder(radius=
collar_d/2, height=collar_h)` unioned on the bearing face **below** the head, `Align
Z=MIN` at z=0, with the head raised to sit on top (head base at z=`collar_h`). Because
   `collar_d < d`, the collar is a narrower boss and the head oversails it — the step the
   raster shows. Total height = `collar_h + h`.
3. **Bore:** subtract a through `Cylinder(radius=bore/2, height=(collar_h_or_0 + h)*3)`
   along Z **last**, like `hex_nut`.

For DIN 467 (no collar) the head base sits at z=0 and the part is a single cylinder + bore.

Guard on `part.volume > 0` (net guard; not `is_valid`).

### Guards (ValueError)

1. `d, h, bore` all `> 0`.
2. `bore < d - 2*_MIN_WALL_MM` (wall between the bore and the head OD).
3. **Collar is all-or-nothing:** `collar_d` and `collar_h` are either both `None` or both
   given. If exactly one is given → error. When both given: `collar_d > 0`, `collar_h > 0`;
   `collar_d < d` (the boss must be narrower than the head, else there is no visible step);
   `collar_d > bore + 2*_MIN_WALL_MM` (a wall through the collar around the bore).
4. Final `part.volume > 0`.

## Data

New `catalog/dimensions/knurled_nuts.json`. Shape = `{d, h, bore, collar_d?, collar_h?}`
(`collar_d`/`collar_h` present only for DIN 466).

| id       | family      | d       | h       | bore | collar_d | collar_h |
| -------- | ----------- | ------- | ------- | ---- | -------- | -------- |
| `din467` | knurled_nut | sourced | sourced | 10.1 | —        | —        |
| `din466` | knurled_nut | sourced | sourced | 10.1 | sourced  | sourced  |

Two distinct standards, no aliases. Envelope fields (`d`, `h`, `collar_d`, `collar_h`) each
confirmed by **≥2 independent public tables** (fasteners.eu, Fuller Fasteners, Wegertseder,
etc.). `bore = 10.1` (M12 minor, ISO 724). Each `source` string states which fields are
tabulated and which (if any) are representative, and cites only public tables — never a
private/internal catalogue.

## Registration & render

- `catalog/models/_registry.py`: add `"knurled_nut": knurled_nut` to `KNOWN_FAMILIES`.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("nut")` → `NUT_PRESET`.

## Testing

- `catalog/tests/test_knurled_nut.py` (generator):
  - **Envelope extents:** the head OD spans `d` on both X and Y (round); total height on Z is
    `h` (DIN 467) or `collar_h + h` (DIN 466).
  - **DIN 466 collar step:** at a low z (inside the collar) there is material out to
    `collar_d/2` but none beyond it; at head height there is material out to `d/2` (wider) —
    confirming the narrower boss under the wider head.
  - **DIN 467 disc:** a no-collar config builds as a single cylinder (full `d` radius at every
    z up to `h`, no step).
  - **Open bore:** the through bore removes material (void on the axis; wall present between
    bore and OD); holed volume < solid-bore volume.
  - **All guards raise** — including the all-or-nothing collar pairing (exactly one of
    `collar_d`/`collar_h` given).
  - **Valid configs (parametrized):** one with-collar and one no-collar config build with
    `volume > 0`.
- `catalog/tests/test_knurled_nuts_data.py` (data): each entry validates + builds,
  family/hardwareType correct, sourced + verified, no forbidden source token.
- Existing tests stay green; existing SVGs stay byte-identical (no shared code changed —
  `_MIN_WALL_MM` is only imported).

## Rollout / invariants

- **Opt-in 0/0.** In-container only (`./catalog/run`). Build produces 2 new drawings
  (`din466`, `din467`); no existing drawing changes (byte-identical). `image-mappings.json`
  and `src/lib/data/standards-generated.ts` stay untouched (`grep -c '.svg'` → 0 for both).
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, new generator is a
  shared surface) → apply findings as additional commits → CI green → squash-merge (admin).

## Global constraints (verbatim)

- Representative size **M12**. Ships `din466` (high) + `din467` (low).
- Every committed envelope dimension confirmed by **≥2 independent public tables**; any
  representative field documented as such, never fabricated as normative.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- New base shape — does **not** touch `_chamfered_hex_solid` or any existing generator;
  existing SVGs byte-identical.
- **No render/preset change.** Axisymmetric body → NUT_PRESET unchanged.
- opt-in invariant 0/0 after build.
