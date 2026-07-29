# Wing Screw Family (DIN 316) — Design

Next family in the generative asset catalog epic (screw gap 36 -> 34).

## Scope

- New generator family `wing_screw` covering **DIN 316** (wing screw, German form,
  rounded wings), representative size **M12**.
- App standard IDs closed: `din316` (base) and `din316p` (alias, same legacy raster).
- Out of scope: American/sharp wing form, sizes other than M12, DIN 318 and forms A-C,
  any other wing-family standard.

## Geometry

New module `catalog/models/wing_screw.py`:

```python
wing_screw(d_shank, length, boss_d, collar_d, boss_h, span, height, wing_t,
           tip_chamfer=None)
```

- **Hub**: revolved trapezoid (radius `boss_d/2` at the bearing plane z=0 up to
  `collar_d/2` at `z=boss_h`), same construction as `wing_nut` — revolve handles both
  the cone and the degenerate cylinder (`collar_d == boss_d`, which the legacy DIN 316
  raster suggests).
- **Wings**: the shared `_wing_profile` (see Refactor below), mirrored across x=0,
  extruded to thickness `wing_t` centered on y=0, exposed ear corners filleted —
  identical to `wing_nut`.
- **Shank**: `screw_common._screw_shank(d_shank, length, tip_chamfer)` below z=0
  (the under-head bearing-plane stacking seam convention). Envelope only, no thread.
- **No bore** — the single structural difference from `wing_nut`.
- Validation: carried over from `wing_nut` (`span > boss_d`, `height > boss_h`,
  `collar_d <= boss_d`, all dims > 0) minus the bore-wall rule; new rule
  `d_shank < boss_d` (the shank must be narrower than the hub it hangs from).
- Guards: net `volume > 0` and hub+wings+shank fused into a single solid.

## Refactor: shared wing profile

Move `_wing_profile` and `_INNER_EDGE_DEG` from `wing_nut.py` into a new
`catalog/models/wing_common.py`; `wing_nut` and `wing_screw` both import from it.
Behavior of `wing_nut` is unchanged (existing tests must stay green). The shared
module's docstring takes over the form description and the FreeCAD Fasteners
Workbench attribution (already listed in `THIRD-PARTY-NOTICES.md`).

## Data and sourcing

New `catalog/dimensions/wing_screws.json`:

- `din316`: family `wing_screw`, M12 envelope sourced from **at least two** public
  DIN 316 tables (candidates: fasteners.eu, Westfield Fasteners, GlobalFastener,
  schrauben-lexikon). Do NOT copy DIN 315 nut numbers — if the screw tables differ
  from the nut tables at M12, the screw tables win.
- `length`: representative common stock length for M12 (picked during sourcing,
  expected in the 30-40 range), marked REPRESENTATIVE in `source`, as is
  `tip_chamfer`.
- `din316p`: `alias_of` `din316` (app image-variant key, same raster).
- Shape fidelity: verify the form against an authoritative vendor drawing and the
  FreeCAD Fasteners Workbench before committing geometry (per CLAUDE.md rule).

## Integration, tests, QA

- Register `wing_screw` in `catalog/models/_registry.py`.
- `catalog/tests/test_wing_screw.py`: envelope bounding-box dimensions, argument
  validation errors, single-solid fusion guard.
- `catalog/tests/test_wing_screws_data.py`: schema + data consistency (pattern from
  `test_knurled_screws_data.py`).
- Existing `test_wing_nut.py` guards the refactor.
- Render through the existing two-view pipeline; visual check via `/dev/asset-compare`
  against the legacy raster.
- Coverage: screw gap 36 -> 34.

## Testing approach

TDD per family convention: data tests and form tests written red first, then the
generator and data entries turn them green.
