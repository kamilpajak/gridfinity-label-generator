# Cylindrical Collar Nut Family Catalog — Design

**Date:** 2026-07-13
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Predecessors:** plain hex (PR #91), flange (PR #92), cap/dome (PR #93), castle (PR #94)

## Goal

Add a **cylindrical collar nut** family to the maintainer-only generative catalog: a
chamfered vertex-up hex body with a plain straight-walled cylindrical bearing collar on
the bearing face and a through bore. Ship DIN 6331 at M12. Reuse `_chamfered_hex_solid`
unchanged and hex_nut's bore. Structurally the flange pattern with a cylinder instead of
a cone.

## Non-goals

- No render/preset change (collar nuts are `hardwareType: "nut"` → vertex-up `NUT_PRESET`).
- No collar edge chamfer/bevel (plain cylinder — only sourced dimensions).
- No PN 61272 alias (its DIN 6331 equivalence rests on a single source, below the
  ≥2-table bar). No SW19 turned variant (not separately standardised).
- No user-facing toggle (later epic milestone). No new sizes beyond M12.

## Architecture

New generator `catalog/models/collar_nut.py`:

```python
def collar_nut(s, m, bore, dc, collar_height, chamfer=None):
    ...
```

Construction (m INCLUDES the collar — the DIN 6331 1.5d height is the full envelope):

1. `hex_solid = _chamfered_hex_solid(s, m, chamfer)` — full-height chamfered vertex-up
   hex body (z=0..m). Reused unchanged from `hex_nut.py`.
2. **Collar:** union `Cylinder(radius=dc/2, height=collar_height, align Z=MIN)` at z=0 —
   a plain cylinder over the bottom `collar_height` of the envelope. Because `dc >`
   across-corners, the collar is wider than the hex and swallows the hex's bottom
   chamfer, giving a genuinely flat bearing face; the top (free-face) chamfer is
   untouched — matching DIN 6331 (chamfer on the free face only).
3. **Bore:** subtract a through `Cylinder(radius=bore/2, height=m*3)` last, like `hex_nut`.

### Guards (ValueError)

1. `bore > 0`.
2. `bore >= s - _MIN_WALL_MM` (reuse hex_nut's wall rule — thinnest wall is at the hex
   flats; the collar is wider so it never sets the limit).
3. `0 < collar_height < m` (collar fits within the envelope and leaves a hex above it).
4. `dc <= 2*(s/sqrt(3))` → reject: the collar must exceed the hex across-corners so it is
   a real bearing ring, not an invisible internal boss (same rationale as flange_nut's
   `d_flange` guard).
5. Helper-inherited: `_chamfered_hex_solid(s, m, chamfer)` validates `s>0`, `m>0`,
   chamfers fit.
6. Final `part.volume > 0` net guard (matches the family; not `is_valid`).

### No new representative constant

`dc` and `collar_height` are fully sourced. `bore = 10.1` is the established M12
thread-minor family constant. The 30° chamfer comes from the shared helper. No novel
representative like `_FLANGE_CONE_ANGLE_DEG`. The optional "collar covers the bottom
chamfer" guard is intentionally omitted (YAGNI — `collar_height` is always sourced and
far exceeds the ~0.8 mm chamfer rise; a smaller value would be cosmetic, not a failure).

## Data

New `catalog/dimensions/collar_nuts.json`. Shape = `{s, m, bore, dc, collar_height}`.

| id        | family     | s    | m    | bore | dc   | collar_height | kind     |
| --------- | ---------- | ---- | ---- | ---- | ---- | ------------- | -------- |
| `din6331` | collar_nut | 18.0 | 18.0 | 10.1 | 25.0 | 4.0           | distinct |

DIN 6331 hexagon nut with collar, height 1.5d (M12): s=18 (current ISO 272 / SW18),
m=18 (=1.5·12, total height including the collar), collar diameter dc=25 (DIN param d1),
collar height=4 (DIN param a), bore=10.1 (M12 minor dia). The collar (dc=25) exceeds the
across-corners (20.78), so it is a visible bearing ring. Confirmed by ≥2 (in fact 5)
independent public tables: fasteners.eu, Aspen Fasteners, Hommel-Hercules, NF GAB, Würth.
Source strings cite only public tables — never any private/internal catalogue.

## Registration & render

- `catalog/models/_registry.py`: add `"collar_nut": collar_nut` to `KNOWN_FAMILIES`.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("nut")` → vertex-up `NUT_PRESET`.

## Testing

- `catalog/tests/test_collar_nut.py` (generator): the collar is the widest feature
  (bbox X/Y = dc, reaches past the hex corners), the collar sits at the bearing face
  (widest ring near z=0), the top is a chamfered hex (near z=m the section is within the
  hex corner circle), the bore is open, all guards raise.
- `catalog/tests/test_collar_nuts_data.py` (data): every entry validates + builds,
  family/hardwareType correct, sourced + verified, no forbidden source token.
- Existing hex_nut / flange_nut / cap_nut / castle_nut / washer tests stay green;
  existing SVGs stay byte-identical (no shared code changed — helper reused unchanged).

## Rollout / invariants

- **Opt-in 0/0:** `data/image-mappings.json` and `src/lib/data/standards-generated.ts`
  keep 0 `.svg` refs. Catalog-only; legacy raster stays default.
- In-container only: `./catalog/run pytest ...` and `./catalog/run python -m
catalog.build_catalog`.
- Build produces 1 new drawing (din6331); no existing drawing changes (byte-identical).
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, generator is a
  shared surface) → apply findings as additional commits → CI green → squash-merge (admin).

## Global constraints (verbatim)

- Representative size **M12**; ship **s = 18** (current ISO-aligned width).
- Every committed dimension confirmed by **≥2 independent public tables**.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- Reuse `_chamfered_hex_solid` **unchanged** (existing SVGs byte-identical).
- **No render/preset change.** Vertex-up orientation inherited from the helper + preset.
- opt-in invariant 0/0 after build.
