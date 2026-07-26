# Washer Coverage-Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate catalog drawings for the five app-served washers `coverage.py` reports missing
(din137b, din440r, din440v, din74361c, din25201) so `python -m catalog.qa.coverage` prints
`washer coverage: complete`.

**Architecture:** Three of the five reuse existing generators (din137b→`wave_washer`,
din440r→alias of `din440`, din74361c→`curved_washer`). Two need a small new self-contained
generator each: `square_hole_washer` (round disc − square prism, for din440v) and
`wedge_lock_washer` (annular ring + representative radial serrations and a circumferential cam
notch pattern, for din25201). Data entries go in the existing `catalog/dimensions/washers.json`;
the build produces 4 new SVGs and closes the coverage gate.

**Tech Stack:** Python, `build123d` (run ONLY in the pinned container via `./catalog/run`), pytest.

## Global Constraints

- **Generate-only.** Do NOT modify `data/image-mappings.json` or
  `src/lib/data/standards-generated.ts`, and do NOT run `catalog/integrate.py`. `grep -c '.svg'`
  on the diff of both files must be 0.
- Closes the `coverage.py` washer gap; after the build `./catalog/run python -m catalog.qa.coverage`
  prints `washer coverage: complete` (exit 0).
- Every committed **envelope** dimension confirmed by **≥2 independent public tables**; wedge-lock
  cam/tooth counts and heights, wave amplitude, and any other unpublished figure documented as
  **representative** (the DIN drawings are paywalled), never fabricated as normative.
- `source` strings cite only public tables — **no** `reyher`, `stalmut`, or any private catalogue.
- Two new **self-contained** generators; do NOT modify any existing generator (`wave_washer`,
  `curved_washer`, `flat_washer`, `square_washer`, …). Existing SVGs stay **byte-identical**.
- `hardwareType: "washer"` for every entry. No render/preset change.
- All `build123d` work runs in-container: `./catalog/run python -m pytest …` and
  `./catalog/run python -m catalog.build_catalog`. Never run build123d on the host.

---

### Task 1: `square_hole_washer` generator + registry

**Files:**

- Create: `catalog/models/square_hole_washer.py`
- Modify: `catalog/models/_registry.py` (import + `KNOWN_FAMILIES` entry, after the washer entries)
- Test: `catalog/tests/test_square_hole_washer.py`

**Interfaces:**

- Produces: `square_hole_washer(d_outer, thickness, hole_side, hole_corner_r=None)` → a `build123d`
  part: a round disc centred on `z=0` with a central square hole. Registered as
  `"square_hole_washer"`.

- [ ] **Step 1: Write the failing test**

Create `catalog/tests/test_square_hole_washer.py`:

```python
import math
import pytest
from build123d import Box, Pos

from catalog.models.square_hole_washer import square_hole_washer

# Synthetic fixture (NOT a real standard): 30 mm disc, 3 mm thick, 13 mm square hole.
SQ = dict(d_outer=30.0, thickness=3.0, hole_side=13.0)


def _solid_at(part, x, y, z, probe=0.5):
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = square_hole_washer(**SQ)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(SQ["d_outer"], 1)     # disc diameter on X
    assert round(bb.size.Z, 1) == round(SQ["thickness"], 1)   # centred, so |z| <= t/2
    assert part.volume > 0


def test_hole_is_square_not_round():
    # hole_side=13 -> square spans |x|,|y| < 6.5. A point near the square's CORNER (6.0, 6.0) is
    # inside the square (void), but its radius 8.49 exceeds hole_side/2=6.5, so a ROUND hole of the
    # same width would leave it solid. Void there proves the hole reaches the corners (square).
    part = square_hole_washer(**SQ)
    assert not _solid_at(part, 0.0, 0.0, 0.0, probe=0.3)      # void on the axis (inside the hole)
    assert not _solid_at(part, 6.0, 6.0, 0.0, probe=0.3)      # void at the square corner region
    assert _solid_at(part, 10.0, 0.0, 0.0, probe=0.3)         # solid disc body (r 6.5..15)


def test_single_solid():
    part = square_hole_washer(**SQ)
    assert len(part.solids()) == 1


def test_square_hole_washer_guards():
    with pytest.raises(ValueError):
        square_hole_washer(**{**SQ, "d_outer": 0.0})          # non-positive dim
    with pytest.raises(ValueError):
        square_hole_washer(**{**SQ, "hole_side": 25.0})       # 25*sqrt2=35.4 >= 30: corners pierce edge
    with pytest.raises(ValueError):
        square_hole_washer(**{**SQ, "hole_corner_r": 7.0})    # corner_r >= hole_side/2
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_square_hole_washer.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.square_hole_washer'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/square_hole_washer.py`:

```python
"""Round flat washer with a square hole (DIN 440 Form V) generator.

DIN 440 Form V is the large-series round washer whose central hole is SQUARE (for square-neck
bolts), as opposed to Form R's round hole. Built as a plain disc minus a square prism, centred on
z=0 to match the other washers. The existing `square_washer` is the inverse shape (a square plate
with a round bore) and does not fit; this generator is self-contained.
"""
import math

from build123d import BuildPart, BuildSketch, Cylinder, Rectangle, RectangleRounded, Mode, extrude


def square_hole_washer(d_outer: float, thickness: float, hole_side: float,
                       hole_corner_r: float | None = None):
    """Round flat washer of diameter ``d_outer`` and ``thickness`` with a central SQUARE hole of
    side ``hole_side`` (optional small corner round ``hole_corner_r``). The disc is centred on
    ``z=0`` (so it occupies ``z in [-thickness/2, thickness/2]``), matching the other washers."""
    if d_outer <= 0 or thickness <= 0 or hole_side <= 0:
        raise ValueError(
            f"square_hole_washer: need positive d_outer, thickness, hole_side, "
            f"got {d_outer}, {thickness}, {hole_side}")
    if hole_side * math.sqrt(2.0) >= d_outer:
        raise ValueError(
            f"square_hole_washer: square hole side {hole_side} has corners at radius "
            f"{hole_side * math.sqrt(2.0) / 2.0:.3f} which reach/exceed the disc radius "
            f"{d_outer / 2.0} (no washer body left)")
    if hole_corner_r is not None and not (0.0 < hole_corner_r < hole_side / 2.0):
        raise ValueError(
            f"square_hole_washer: hole_corner_r {hole_corner_r} must be > 0 and < hole_side/2 "
            f"= {hole_side / 2.0}")
    with BuildPart() as bp:
        Cylinder(radius=d_outer / 2.0, height=thickness)             # disc z in [-t/2, t/2]
        with BuildSketch():                                          # square hole cross-section on z=0
            if hole_corner_r is None:
                Rectangle(hole_side, hole_side)
            else:
                RectangleRounded(hole_side, hole_side, hole_corner_r)
        extrude(amount=thickness, both=True, mode=Mode.SUBTRACT)     # through-cut the square hole
    part = bp.part
    if part.volume <= 0:                                             # net guard
        raise ValueError("square_hole_washer: produced an empty solid")
    return part
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_square_hole_washer.py -q`
Expected: PASS (all tests).

- [ ] **Step 5: Register the family**

In `catalog/models/_registry.py`, add the import next to the other washer imports (the file
imports washer generators from `catalog.models.washer`; add a separate import line for this new
module):

```python
from catalog.models.square_hole_washer import square_hole_washer
```

and add to `KNOWN_FAMILIES`, after the last washer entry (e.g. after `"wave_washer": wave_washer,`):

```python
    "square_hole_washer": square_hole_washer,
```

- [ ] **Step 6: Run the full suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — prior suite plus the new tests, no regressions.

- [ ] **Step 7: Commit**

```bash
git add catalog/models/square_hole_washer.py catalog/models/_registry.py catalog/tests/test_square_hole_washer.py
git commit -m "feat(catalog): add square_hole_washer generator (round disc, square hole)"
```

---

### Task 2: `wedge_lock_washer` generator + registry

**Files:**

- Create: `catalog/models/wedge_lock_washer.py`
- Modify: `catalog/models/_registry.py` (import + `KNOWN_FAMILIES` entry, after `square_hole_washer`)
- Test: `catalog/tests/test_wedge_lock_washer.py`

**Interfaces:**

- Produces: `wedge_lock_washer(d_inner, d_outer, thickness, teeth, cam_count, cam_height,
tooth_depth)` → a single fused `build123d` part: an annular ring centred on `z=0` with radial
  serrations on the top face and a circumferential cam notch pattern on the bottom face. Registered
  as `"wedge_lock_washer"`.

- [ ] **Step 1: Write the failing test**

Create `catalog/tests/test_wedge_lock_washer.py`:

```python
import pytest
from build123d import Box, Pos

from catalog.models.wedge_lock_washer import wedge_lock_washer

# Synthetic fixture (NOT a real standard). Ring 13..30 mm, 3 mm thick; 20 radial teeth on top,
# 12 cam notches on the bottom; feature depths exaggerated for legibility (representative).
WL = dict(d_inner=13.0, d_outer=30.0, thickness=3.0, teeth=20, cam_count=12,
          cam_height=0.8, tooth_depth=0.6)


def _solid_at(part, x, y, z, probe=0.4):
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def _ring_no_features(d_inner, d_outer, thickness):
    # A plain ring of the same envelope, to prove the features remove material.
    from build123d import BuildPart, Cylinder, Mode
    with BuildPart() as bp:
        Cylinder(radius=d_outer / 2.0, height=thickness)
        Cylinder(radius=d_inner / 2.0, height=thickness, mode=Mode.SUBTRACT)
    return bp.part


def test_envelope_extents():
    part = wedge_lock_washer(**WL)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(WL["d_outer"], 1)     # ring diameter on X
    assert round(bb.size.Z, 1) == round(WL["thickness"], 1)   # centred, features cut inward
    assert part.volume > 0


def test_bore_open_ring_solid():
    part = wedge_lock_washer(**WL)
    assert not _solid_at(part, 0.0, 0.0, 0.0, probe=0.3)      # void inside the bore (r < 6.5)
    assert _solid_at(part, 10.0, 0.0, 0.0, probe=0.3)         # solid ring body at mid-height


def test_features_remove_material():
    part = wedge_lock_washer(**WL)
    plain = _ring_no_features(WL["d_inner"], WL["d_outer"], WL["thickness"])
    assert part.volume < plain.volume                         # teeth + cam notches removed metal


def test_top_face_is_serrated_and_bottom_is_cammed():
    # Scan a full turn at the mean radius. Just under the TOP face some angles fall in a radial
    # groove (void) and some on a tooth (solid); just above the BOTTOM face some angles fall in a
    # cam notch (void) and some on solid. Scanning is robust to the pattern's start angle.
    import math
    part = wedge_lock_washer(**WL)
    r = (WL["d_inner"] + WL["d_outer"]) / 4.0                 # mean radius 10.75
    top_z = WL["thickness"] / 2.0 - 0.15                      # 1.35, inside the 0.6-deep grooves
    bot_z = -WL["thickness"] / 2.0 + 0.15                     # -1.35, inside the 0.8-deep notches
    top = [ _solid_at(part, r*math.cos(math.radians(a)), r*math.sin(math.radians(a)), top_z, 0.15)
            for a in range(0, 360, 3) ]
    bot = [ _solid_at(part, r*math.cos(math.radians(a)), r*math.sin(math.radians(a)), bot_z, 0.15)
            for a in range(0, 360, 3) ]
    assert any(top) and not all(top)                          # top alternates solid/void -> teeth
    assert any(bot) and not all(bot)                          # bottom alternates -> cam notches


def test_single_solid():
    part = wedge_lock_washer(**WL)
    assert len(part.solids()) == 1                            # ring stays one fused solid


def test_wedge_lock_washer_guards():
    with pytest.raises(ValueError):
        wedge_lock_washer(**{**WL, "d_inner": 30.0})          # d_inner not < d_outer
    with pytest.raises(ValueError):
        wedge_lock_washer(**{**WL, "teeth": 2})               # need teeth >= 3
    with pytest.raises(ValueError):
        wedge_lock_washer(**{**WL, "cam_height": 3.0})        # cam_height >= thickness
    with pytest.raises(ValueError):
        wedge_lock_washer(**{**WL, "cam_height": 2.0, "tooth_depth": 1.5})  # sum >= thickness
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_wedge_lock_washer.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.wedge_lock_washer'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/wedge_lock_washer.py`:

```python
"""Wedge-lock washer (DIN 25201) generator — a REPRESENTATIVE icon.

A DIN 25201 wedge-lock washer is an annular ring with fine RADIAL serrations on one face (they
bite the clamped part) and a CIRCUMFERENTIAL cam surface on the mating face (cam ramp angle greater
than the thread pitch, so the pair jacks apart rather than loosening). The pair uses two identical
washers; the catalog ships the single repeating unit.

The exact DIN 25201 cam curve and serration pitch are paywalled and, at real sub-millimetre depth,
invisible at label scale. So both faces are modelled as a REPRESENTATIVE, deliberately legible icon
(like the Torx/cross recesses in the screw families), not the dimensioned geometry: `teeth` radial
grooves cut into the top face, and `cam_count` circumferential notches cut into a mid-ring band of
the bottom face. Both are `PolarLocations` patterns (deterministic, no fragile edge selection). The
ring is centred on z=0. Net guards keep it one valid solid.
"""
import math

from build123d import (
    BuildPart, BuildSketch, Cylinder, Rectangle, Plane, PolarLocations, Mode, extrude,
)

_TOOTH_W_FRAC = 0.5      # radial-groove tangential width as a fraction of the tooth pitch
_CAM_ARC_FRAC = 0.6      # cam-notch tangential width as a fraction of the cam pitch
_CAM_BAND_FRAC = 0.7     # cam notches span this fraction of the ring width (mid-band; rims survive)


def wedge_lock_washer(d_inner: float, d_outer: float, thickness: float, teeth: int,
                      cam_count: int, cam_height: float, tooth_depth: float):
    """Representative wedge-lock washer: an annular ring (``d_inner``..``d_outer``, ``thickness``)
    with ``teeth`` radial serrations cut ``tooth_depth`` into the top face and ``cam_count``
    circumferential cam notches cut ``cam_height`` into a mid-band of the bottom face. Ring centred
    on ``z=0``. The serration/cam geometry is a legible representative icon, not the dimensioned
    DIN 25201 form."""
    if not (0 < d_inner < d_outer):
        raise ValueError(f"wedge_lock_washer: need 0 < d_inner < d_outer, got {d_inner}, {d_outer}")
    if thickness <= 0 or cam_height <= 0 or tooth_depth <= 0:
        raise ValueError(
            f"wedge_lock_washer: need positive thickness, cam_height, tooth_depth, "
            f"got {thickness}, {cam_height}, {tooth_depth}")
    if teeth < 3 or cam_count < 3:
        raise ValueError(
            f"wedge_lock_washer: need teeth >= 3 and cam_count >= 3, got {teeth}, {cam_count}")
    if cam_height >= thickness or tooth_depth >= thickness:
        raise ValueError(
            f"wedge_lock_washer: cam_height {cam_height} and tooth_depth {tooth_depth} must each "
            f"be < thickness {thickness}")
    if tooth_depth + cam_height >= thickness:
        raise ValueError(
            f"wedge_lock_washer: tooth_depth + cam_height ({tooth_depth + cam_height}) must be "
            f"< thickness {thickness} so a solid core remains between the top and bottom features")

    r_in = d_inner / 2.0
    r_out = d_outer / 2.0
    r_mean = (r_in + r_out) / 2.0
    ring_w = r_out - r_in
    top = thickness / 2.0
    bottom = -thickness / 2.0
    tooth_w = (2.0 * math.pi * r_mean / teeth) * _TOOTH_W_FRAC      # groove tangential width (repr)
    cam_arc = (2.0 * math.pi * r_mean / cam_count) * _CAM_ARC_FRAC  # notch tangential width (repr)

    with BuildPart() as bp:
        Cylinder(radius=r_out, height=thickness)                    # ring z in [-t/2, t/2]
        Cylinder(radius=r_in, height=thickness, mode=Mode.SUBTRACT)
        # Radial serrations cut into the TOP face: `teeth` radial slots at the mean radius.
        with BuildSketch(Plane.XY.offset(top)):
            with PolarLocations(r_mean, teeth):
                Rectangle(ring_w * 1.05, tooth_w)                   # length radial, width tangential
        extrude(amount=-tooth_depth, mode=Mode.SUBTRACT)            # cut down into the top
        # Circumferential cam notches cut into a MID-BAND of the BOTTOM face: `cam_count` tangential
        # notches (inner and outer rims survive, keeping the ring one solid).
        with BuildSketch(Plane.XY.offset(bottom)):
            with PolarLocations(r_mean, cam_count):
                Rectangle(ring_w * _CAM_BAND_FRAC, cam_arc)         # radial band, tangential width
        extrude(amount=cam_height, mode=Mode.SUBTRACT)              # cut up into the bottom
    part = bp.part
    if part.volume <= 0:                                            # net guard
        raise ValueError("wedge_lock_washer: produced an empty solid")
    if len(part.solids()) != 1:                                     # ring must stay a single solid
        raise ValueError("wedge_lock_washer: produced more than one solid")
    return part
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_wedge_lock_washer.py -q`
Expected: PASS. If the serration/cam scan finds no void (pattern too shallow to probe) or the
solid check trips, confirm `tooth_depth`/`cam_height` exceed the 0.15 probe inset and that the
`PolarLocations` patterns produced distinct slots; do not change the fixture's real-standard intent.

- [ ] **Step 5: Register the family**

In `catalog/models/_registry.py`, add the import (after the `square_hole_washer` import):

```python
from catalog.models.wedge_lock_washer import wedge_lock_washer
```

and add to `KNOWN_FAMILIES`, after `"square_hole_washer": square_hole_washer,`:

```python
    "wedge_lock_washer": wedge_lock_washer,
```

- [ ] **Step 6: Run the full suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — prior suite plus both new generators' tests, no regressions.

- [ ] **Step 7: Commit**

```bash
git add catalog/models/wedge_lock_washer.py catalog/models/_registry.py catalog/tests/test_wedge_lock_washer.py
git commit -m "feat(catalog): add wedge_lock_washer generator (representative DIN 25201 icon)"
```

---

### Task 3: Data entries, data tests, and closing the coverage gate

**Files:**

- Modify: `catalog/dimensions/washers.json` (add 5 entries)
- Modify: `catalog/tests/test_washers_data.py` (add the gap-closure assertions)
- Build output (generated, committed): `catalog/out/din137b.svg`, `din440v.svg`, `din74361c.svg`,
  `din25201.svg`, and the additive `catalog/out/manifest.json` change.

**Interfaces:**

- Consumes: `wave_washer`, `curved_washer`, `flat_washer` (existing), `square_hole_washer` (Task 1),
  `wedge_lock_washer` (Task 2); `validate_entry` from `catalog.schema`; `build_part` from
  `catalog.models._registry`; `catalog.qa.coverage.check`.
- Produces: 5 washer data entries (4 bases + 1 alias) that validate, build, and close the gate.

**SOURCING GATE (controller-supplied — do NOT invent numbers).** The exact numeric dimensions for
every entry are provided to this task by the controller's sourcing gate, each envelope dim confirmed
against ≥2 independent public tables and written into the `source` string (representative fields
flagged as such). The implementer writes those exact values into the JSON in the shapes below; it
must not guess or fabricate any dimension. The id/family/alias mapping and the `source`-string
requirements are fixed by this plan.

- [ ] **Step 1: Write the failing data-test additions**

Append to `catalog/tests/test_washers_data.py`:

```python
def test_coverage_gap_washers_present_and_typed():
    entries = json.loads(DATA.read_text())
    expected = {
        "din137b": "wave_washer",
        "din440v": "square_hole_washer",
        "din74361c": "curved_washer",
        "din25201": "wedge_lock_washer",
    }
    for sid, fam in expected.items():
        assert sid in entries, f"{sid} missing from washers.json"
        assert entries[sid]["family"] == fam, f"{sid}: expected family {fam}"
        assert entries[sid]["hardwareType"] == "washer"
    # din440r is the round-hole form, identical envelope to din440 -> alias.
    assert entries["din440r"]["alias_of"] == "din440"


def test_no_washer_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        assert "reyher" not in low and "stalmut" not in low, f"{sid}: forbidden source token"
```

- [ ] **Step 2: Run the data tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_washers_data.py -q`
Expected: FAIL — the new `din137b`/`din440v`/`din74361c`/`din25201`/`din440r` keys are missing.

- [ ] **Step 3: Add the data entries**

Add these 5 entries to `catalog/dimensions/washers.json`, filling every numeric field from the
controller's sourcing-gate values (the illustrative numbers below are SHAPE-ONLY placeholders — do
not commit them; replace with the sourced values). Each base `source` states the size, cites ≥2
public tables for the envelope dims, and flags representative fields; the alias `source` states the
shared envelope. Match the existing entry shape (`family`, `shape`, `hardwareType`, `source`,
`verified`, `designations`).

din137b — `wave_washer` (DIN 137 B, M12), shape keys `d_inner, d_outer, thickness, waves, wave_height`:

```json
"din137b": {
  "family": "wave_washer",
  "shape": { "d_inner": 13.0, "d_outer": 25.0, "thickness": 0.5, "waves": 3, "wave_height": 1.2 },
  "hardwareType": "washer",
  "source": "<DIN 137 B M12 waved spring washer: d_inner/d_outer/thickness tabulated vs >=2 public tables (name them); waves=3 and wave_height representative (DIN does not fix the wave count).>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "137 B" }]
}
```

din440r — alias of `din440` (round-hole form R, identical envelope):

```json
"din440r": {
  "alias_of": "din440",
  "hardwareType": "washer",
  "source": "<DIN 440 Form R (round hole), M12 — identical envelope to din440 (d_inner/d_outer/thickness), aliases the base.>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "440 R" }]
}
```

din440v — `square_hole_washer` (DIN 440 Form V, M12), shape keys `d_outer, thickness, hole_side`:

```json
"din440v": {
  "family": "square_hole_washer",
  "shape": { "d_outer": 44.0, "thickness": 4.0, "hole_side": 13.5 },
  "hardwareType": "washer",
  "source": "<DIN 440 Form V (square hole), M12: d_outer/thickness tabulated vs >=2 public tables; hole_side (square) tabulated for the square-neck size.>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "440 V" }]
}
```

din74361c — `curved_washer` (DIN 74361 Form C, Belleville, representative wheel-bolt size), shape
keys `d_inner, d_outer, thickness, cone_angle, gap_deg` (`gap_deg` = 0, closed cone):

```json
"din74361c": {
  "family": "curved_washer",
  "shape": { "d_inner": 16.5, "d_outer": 27.0, "thickness": 7.0, "cone_angle": 12, "gap_deg": 0 },
  "hardwareType": "washer",
  "source": "<DIN 74361 Form C conical (Belleville) spring washer for wheel bolts, representative wheel size (state which): d_inner/d_outer/thickness tabulated vs >=2 public tables; cone_angle representative (the DIN cone angle is paywalled). Closed cone gap_deg=0, reuses curved_washer like din2093.>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "74361 C" }]
}
```

din25201 — `wedge_lock_washer` (M12), shape keys `d_inner, d_outer, thickness, teeth, cam_count,
cam_height, tooth_depth`:

```json
"din25201": {
  "family": "wedge_lock_washer",
  "shape": { "d_inner": 13.0, "d_outer": 25.0, "thickness": 3.0, "teeth": 20, "cam_count": 12, "cam_height": 0.8, "tooth_depth": 0.6 },
  "hardwareType": "washer",
  "source": "<DIN 25201 wedge-lock washer, M12: d_inner/d_outer/thickness tabulated vs >=2 public tables; teeth/cam_count/cam_height/tooth_depth are a REPRESENTATIVE legible icon (the DIN 25201 cam curve and serration pitch are paywalled and sub-mm), not the dimensioned form.>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "25201" }]
}
```

- [ ] **Step 4: Run the data tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_washers_data.py -q`
Expected: PASS — all entries validate + build; din440r aliases din440; new tests green.

- [ ] **Step 5: Run the full suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — generators + data + all prior tests.

- [ ] **Step 6: Build the drawings and CLOSE the coverage gate**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: 4 new SVGs under `catalog/out/` (`din137b.svg`, `din440v.svg`, `din74361c.svg`,
`din25201.svg`); `din440r` renders no new file (alias reusing din440's drawing);
`catalog/out/manifest.json` gains the 5 entries.

Then confirm the gate is closed:

```bash
./catalog/run python -m catalog.qa.coverage
# Expect: "washer coverage: complete"  (exit 0)
```

Then verify the invariants:

```bash
# Existing drawings byte-identical (only the 4 new SVGs added):
git status --porcelain catalog/out
# Expect: only din137b.svg, din440v.svg, din74361c.svg, din25201.svg as new (??) + modified manifest.json.

# manifest.json must be an ADDITIVE change. If the build reformats it (2-space vs repo tabs),
# normalise with prettier so the committed diff is only the new entries:
pnpm exec prettier --write catalog/out/manifest.json
git diff --numstat catalog/out/manifest.json   # small line count = only the 5 new entries

# Generate-only invariant: these must NOT be touched:
git diff --stat data/image-mappings.json src/lib/data/standards-generated.ts | grep -c '.svg'
# Expect: 0
```

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/washers.json catalog/tests/test_washers_data.py catalog/out/din137b.svg catalog/out/din440v.svg catalog/out/din74361c.svg catalog/out/din25201.svg catalog/out/manifest.json
git commit -m "feat(catalog): close the washer coverage gap (din137b/440r/440v/74361c/25201)"
```

---

## Notes for the controller (sourcing gate + review)

- **Sourcing gate before Task 3:** confirm, per base, the envelope dims against ≥2 public tables:
  din137b (DIN 137 B M12 d1/d2/s), din440v (DIN 440 V M12 d2/s/square-hole side), din74361c
  (DIN 74361 C — pick a representative wheel-bolt size and give d3/d2/h + a representative cone
  angle), din25201 (M12 d_in/d_out/thickness; counts + depths representative). din440r inherits
  din440. Hand the implementer the verbatim values + `source` strings. Perplexity / Playwright MCP
  may read PDF tables.
- **Visual confirmation before merge:** render and eyeball all 4 new drawings — din137b reads as a
  waved ring, din440v as a round disc with a square hole, din74361c as a dished Belleville cone,
  din25201 as a serrated wedge-lock washer. Serve `catalog/out` over `http.server` for the
  Playwright check (Playwright blocks `file://`).
- **zen review** (`deepseek/deepseek-v4-pro`, thinking=high) after the branch is pushed and the PR
  opened — two new generators on a shared surface. Apply findings as additional commits.
- **Coverage:** after Task 3, `catalog.qa.coverage` washer check must return `complete`.
