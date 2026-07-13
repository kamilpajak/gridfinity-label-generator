# Square Nut Family Catalog — Design

**Date:** 2026-07-13
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Predecessors:** plain hex (#91), flange (#92), cap (#93), castle (#94), collar (#95)

## Goal

Add a **square nut** family to the maintainer-only generative catalog — the first
**non-hex** base shape, so it does **not** reuse `_chamfered_hex_solid`. A vertex-up square
prism with a through bore and an optional top-only chamfer. Ship DIN 557 (chamfered) and
DIN 928 (plain weld nut) at M12.

> **Orientation update:** the family originally shipped **flat-up** (PR #96); a follow-up
> corrected it to **vertex-up** (a corner at top, matching the hex nuts) per user request.
> The generator, tests, and drawings below reflect **vertex-up** (`rotation=0`).

## Non-goals

- No render/preset change (square nuts are `hardwareType: "nut"` → existing vertex-up
  `NUT_PRESET` camera; the square's own rotation sets flat-up).
- **No DIN 562** — rigorous sourcing (5+ tables + DIN Media official scope) confirmed the
  standard's normative range is M1.6–M10; **M12 is out of scope**, so shipping it would
  fabricate a size the standard does not define. "DIN 562 M12" listings are manufacturer
  extensions (s=19/m=10) that coincide with DIN 557 sizing.
- No modelling of DIN 928's three weld projections (consumed during welding — don't-fabricate).
- No obsolescent DIN 557 SW19 variant. No user-facing toggle. No sizes beyond M12.

## Architecture

New generator `catalog/models/square_nut.py`:

```python
def square_nut(s, m, bore, chamfer=None):
    ...
```

Construction:

1. **Flat-up square prism:** `RegularPolygon(radius=s/sqrt(2), side_count=4, rotation=45)`
   extruded to height `m`. `rotation=45` puts the four sides horizontal/vertical, so the
   plan bounding box is `s x s` (across-flats); the corners sit on the diagonal at
   `s*sqrt(2)`. (`rotation=0` would give a corner-up diamond — not wanted.) Matches the
   existing `square_washer` axis-aligned convention.
2. **Top-only chamfer** (when `chamfer` is given): revolve the meridian
   `[(0,0),(circ,0),(circ,m-rise),(rflat,m),(0,m)]` about `Axis.Z` and intersect with the
   prism, where `circ=s/sqrt(2)`, `rflat=chamfer/2`, `rise=(circ-rflat)*tan(30deg)`. The
   full-radius bottom segment keeps the bearing (bottom) face a **sharp full square**; only
   the top corners bevel in to the chamfer circle. `chamfer=None` → plain flat prism.
3. **Bore:** subtract a through `Cylinder(radius=bore/2, height=m*3)` last, like `hex_nut`.

`chamfer` is the top chamfer-circle **diameter**. The ISO/DIN default is `chamfer=s`
(`rflat=s/2` = the square's inscribed radius), so the bevel clips the corners down to the
inscribed circle — **the same chamfer convention the hex nuts already use** (chamfer
circle = s → a circular top face inside the polygon). `_CHAMFER_ANGLE_DEG = 30.0` reused
from the hex family.

### Guards (ValueError)

1. `s > 0` and `m > 0`.
2. `bore > 0`.
3. `bore >= s - _MIN_WALL_MM` (reuse hex_nut's wall rule; thinnest wall is at the flats).
4. When `chamfer` is not None: `0 < chamfer/2 < circ` (chamfer circle within the corners),
   and `rise < m` (top chamfer fits in the height — top-only, so `rise < m`, **not**
   `2*rise` like the both-ends hex body).
5. Final `part.volume > 0` net guard (matches the family; not `is_valid`).

### Representative constant

`chamfer=s` for DIN 557 is a representative choice — the chamfer size is a drawing form
requirement, not tabulated — exactly like the hex family's `chamfer` default. `bore=10.1`
is the M12 thread-minor family constant. DIN 928 uses `chamfer=None` (no representative
value invented). No novel constant like `_FLANGE_CONE_ANGLE_DEG`.

## Data

New `catalog/dimensions/square_nuts.json`. Shape = `{s, m, bore, chamfer?}` (chamfer key
omitted → None).

| id       | family     | s    | m    | bore | chamfer  | kind     |
| -------- | ---------- | ---- | ---- | ---- | -------- | -------- |
| `din557` | square_nut | 18.0 | 10.0 | 10.1 | 18.0     | distinct |
| `din928` | square_nut | 19.0 | 9.5  | 10.1 | — (none) | distinct |

- **DIN 557** square nut, grade C (M12): s=18 (current ISO 272 / SW18; obsolescent SW19
  not shipped), m=10, chamfered top / flat bearing face. Confirmed by fasteners.eu, Fuller
  Fasteners, TC Fixings, Aspen Fasteners.
- **DIN 928** square weld nut (M12): s=19, m=9.5, plain prism (weld projections not
  modelled). Confirmed by fasteners.eu, Fuller Fasteners, fasten.it, McMaster-Carr.

Both distinct (differ in s, m, and chamfer presence). No aliases. Source strings cite only
public tables — never any private/internal catalogue.

## Registration & render

- `catalog/models/_registry.py`: add `"square_nut": square_nut` to `KNOWN_FAMILIES`.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("nut")` → vertex-up `NUT_PRESET`. **The flat-up square framed
  by the vertex-up camera will be visually confirmed at build time**; if the framing is
  poor, note it (no new preset is introduced in this family).

## Testing

- `catalog/tests/test_square_nut.py` (generator): flat-up extents (bbox X=Y=s, Z=m); plain
  prism keeps full-square corners; the top chamfer bevels the **top** corners only (bottom
  stays at the full half-diagonal); the chamfer removes material vs a plain prism; bore
  open; all guards raise.
- `catalog/tests/test_square_nuts_data.py` (data): every entry validates + builds,
  family/hardwareType correct, sourced + verified, no forbidden source token.
- Existing hex/flange/cap/castle/collar/washer tests stay green; existing SVGs stay
  byte-identical (no shared code changed — `_MIN_WALL_MM` is only imported).

## Rollout / invariants

- **Opt-in 0/0.** In-container only. Build produces 2 new drawings (din557, din928); no
  existing drawing changes (byte-identical).
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, new generator is a
  shared surface) → apply findings as additional commits → CI green → squash-merge (admin).

## Global constraints (verbatim)

- Representative size **M12**. DIN 557 ships **s=18**; DIN 928 ships **s=19** (its real width).
- Every committed dimension confirmed by **≥2 independent public tables**.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- New base shape — does **not** touch `_chamfered_hex_solid` or any existing generator;
  existing SVGs byte-identical.
- **No render/preset change.** Flat-up orientation set by the square's own `rotation=45`.
- opt-in invariant 0/0 after build.
