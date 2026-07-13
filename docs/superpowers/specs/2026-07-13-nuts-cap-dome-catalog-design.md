# Cap / Dome Nut Family Catalog — Design

**Date:** 2026-07-13
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Predecessors:** plain hex nut family (PR #91), conical flange nut family (PR #92)

## Goal

Add a **cap / dome nut** family to the maintainer-only generative catalog: a
chamfered vertex-up hex body with a closed spherical-cap dome unioned on top, no
bore. Ship three DIN standards at the representative M12 size (DIN 1587 high acorn,
DIN 917 low cap, DIN 986 all-metal cap). Reuse the existing
`_chamfered_hex_solid(s, m, chamfer)` helper unchanged.

## Non-goals

- No render/preset change (cap nuts are `hardwareType: "nut"` → existing vertex-up
  `NUT_PRESET`).
- No modelling of the internal blind bore (closed cap; the bore is invisible in a
  2-view outline silhouette — a solid body gives an identical render).
- No modelling of the prevailing-torque locking feature of DIN 986 (envelope-only,
  same precedent as DIN 6927 in the flange family).
- No user-facing "use generated drawings" toggle (that is a later epic milestone).
- No new sizes beyond M12; no legacy SW19 width variants.

## Architecture

New generator `catalog/models/cap_nut.py` exposing:

```python
def cap_nut(s: float, m: float, dome_height: float, chamfer: float | None = None):
    ...
```

Construction:

1. `hex_solid = _chamfered_hex_solid(s, m - dome_height, chamfer)` — the vertex-up
   chamfered hex body, height reduced by the dome so total height stays `m`. Reused
   from `catalog/models/hex_nut.py` **unchanged**.
2. A spherical cap revolved about Z and unioned on top of the hex body.
3. **No bore** — no SUBTRACT cylinder.

### Dome geometry

- `r_flat = (s if chamfer is None else chamfer) / 2.0` — the dome base-circle radius.
  This is deliberately the **top chamfer circle** of `_chamfered_hex_solid` (which
  bevels _both_ end faces down to `r_flat`), so the dome base matches the chamfered
  hex top exactly: a seamless union with no re-entrant lip. It is also closer to a
  real acorn nut, whose dome diameter ≈ across-flats `s`, than springing from the
  across-corners circle would be.
- `h = dome_height`.
- Spherical-cap radius: `R = (r_flat**2 + h**2) / (2*h)`.
  - Derivation: a cap of height `h` on a sphere of radius `R` has base-circle radius
    `r` with `r**2 = 2*R*h - h**2`; solving gives `R = (r**2 + h**2) / (2*h)`.
- Base plane at `base_z = m - dome_height` (top of the hex body). Sphere centre on Z
  at `z_c = base_z + h - R`. Apex at `(0, base_z + h)`.
- Realised by revolving a **closed** profile about Z: an arc from `(r_flat, base_z)`
  to the apex `(0, base_z + h)` on the circle of radius `R` centred at `(0, z_c)`,
  closed down the axis back to `(0, base_z)` and out to `(r_flat, base_z)`. Unioned
  (Mode.ADD) onto the hex body.

### Representative fallback

```python
_CAP_DOME_HEIGHT_FRACTION = 2.0 / 3.0   # dome height as a fraction of across-flats s
```

Used **only** when a future standard tabulates neither a dome height nor a
total-minus-hex-body split; then `dome_height = _CAP_DOME_HEIGHT_FRACTION * s`. This
mirrors `_FLANGE_CONE_ANGLE_DEG`: one documented representative constant filling the
single untabulated transition while every tabulated dimension stays sourced. **Not
exercised by the three shipped entries** — all have sourced/derived dome heights.

### Guards (in `cap_nut`, before/around construction)

1. `dome_height > 0` (positive cap; also avoids division by zero in `R`).
2. `dome_height < m` (a hex body must remain to seat the dome on).
3. Reject `dome_height > 3 * r_flat` as a likely data typo (avoid building a spike).
4. Hex-body validation delegated to `_chamfered_hex_solid(s, m - dome_height,
chamfer)`, which raises if `s`/reduced-height/chamfer geometry is invalid.
5. Final `part.volume > 0` net guard (matches hex_nut/flange_nut; catches degenerate
   unions the analytic checks miss).

## Data

New `catalog/dimensions/cap_nuts.json`. Shape stores **total height `m` + dome_height**
(so `m` keeps the "total tabulated height" meaning it has in hex_nut/flange_nut; the
generator derives hex-body height as `m - dome_height`).

| id        | family  | s    | m    | dome_height | kind     |
| --------- | ------- | ---- | ---- | ----------- | -------- |
| `din1587` | cap_nut | 18.0 | 22.0 | 12.0        | distinct |
| `din917`  | cap_nut | 18.0 | 16.0 | 8.0         | distinct |
| `din986`  | cap_nut | 18.0 | 22.5 | 9.0         | distinct |

All three distinct (same s=18 footprint, different modelled envelope). No aliases.

Sourcing (each confirmed by ≥2 independent public tables; conflicts tie-broken):

- **DIN 1587** s=18 (current ISO 272-aligned; legacy SW19 not shipped), m=22,
  hex body 10 → dome 12. Westfield Fasteners, Andrews Fasteners, fasteners.eu, DIN
  1587 standard text.
- **DIN 917** s=18, m=16, hex body 8 (m′ minimum) → dome 8. fasteners.eu, Fuller
  Fasteners, TorqBolt.
- **DIN 986** s=18 (ISO 4032-aligned SW18; legacy SW19 not shipped), m=22.5 (h2),
  hex body 13.5 (h1) → dome 9. Fabory, Bossard BN 167, Fuller Fasteners,
  fasteners.eu. Prevailing-torque crown not modelled.

Source strings in the committed JSON cite only public standard texts and
distributor tables — never any private/internal catalogue.

## Registration & render

- `catalog/models/_registry.py`: add `"cap_nut": cap_nut` to `KNOWN_FAMILIES`.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type(entry["hardwareType"])`; `nut` → vertex-up `NUT_PRESET`.

## Testing

- `catalog/tests/test_cap_nut.py` (generator): vertex-up extents, dome present (top
  vertices/height above the hex body), solid (no bore — volume near a solid envelope),
  chamfered bottom, all guards raise, and a seamless-junction check (no gap /
  positive volume). In-container via `./catalog/run pytest`.
- `catalog/tests/test_cap_nuts_data.py` (data): every entry has the required keys,
  `family == "cap_nut"`, `hardwareType == "nut"`, `verified == true`, each shape
  builds a positive-volume part, and no source string contains a forbidden token.
- Existing hex_nut / flange_nut / washer tests stay green; existing SVGs stay
  byte-identical (no shared code changed — `_chamfered_hex_solid` reused unchanged).

## Rollout / invariants

- **Opt-in 0/0:** `data/image-mappings.json` and `src/lib/data/standards-generated.ts`
  must both keep 0 `.svg` references. Cap nuts are catalog-only; legacy raster stays
  default.
- In-container only: `./catalog/run pytest ...` and `./catalog/run python -m
catalog.build_catalog`.
- Build produces 3 new drawings (din1587.svg, din917.svg, din986.svg); no existing
  drawing changes (sha256 byte-identical).
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro) on shared code
  surfaces → apply findings as additional commits → CI green → squash-merge (admin).

## Global constraints (verbatim)

- Representative size **M12**; ship **only s = 18** (no legacy SW19).
- Every committed dimension confirmed by **≥2 independent public tables**.
- Source strings: **no** "reyher", "stalmut", or any private/internal catalogue.
- Reuse `_chamfered_hex_solid` **unchanged** (behavior-preserving; existing SVGs
  byte-identical).
- **No bore** (closed cap). **No render/preset change.**
- Vertex-up orientation (inherited from the helper + NUT_PRESET).
- opt-in invariant 0/0 after build.

```

```
