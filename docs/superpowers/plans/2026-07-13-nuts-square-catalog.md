# Square Nut Family Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a square nut family (DIN 557 chamfered + DIN 928 plain, at M12) to the maintainer-only generative catalog. First non-hex base shape.

**Architecture:** New `catalog/models/square_nut.py` builds a flat-up square prism (`RegularPolygon(side_count=4, rotation=45)`) with an optional top-only revolve-∩-square chamfer and a through bore. Does NOT reuse `_chamfered_hex_solid` (only imports `_MIN_WALL_MM`). Registered as family `square_nut`; data in `catalog/dimensions/square_nuts.json`. No render/preset change.

**Tech Stack:** Python + build123d (in-container via `./catalog/run`), pytest, JSON dimension data.

## Global Constraints

- Size **M12**. DIN 557 ships **s=18**; DIN 928 ships **s=19**.
- Every committed dimension confirmed by **≥2 independent public tables** (already sourced — see spec).
- Source strings must **not** contain `reyher`, `stalmut`, or any private/internal catalogue.
- New base shape — do **not** edit `_chamfered_hex_solid`, `hex_nut.py` (beyond importing `_MIN_WALL_MM`), or any existing generator. Existing SVGs must stay **byte-identical** (sha256).
- **No render/preset change.** Flat-up orientation is set inside the generator (`rotation=45`).
- **opt-in invariant 0/0** after build.
- All Python runs in-container: `./catalog/run pytest ...` and `./catalog/run python -m catalog.build_catalog`. Never on the host.

**Reference geometry:** `circ = s/sqrt(2)` (half-diagonal / across-corners radius). Flat-up prism via `RegularPolygon(radius=circ, side_count=4, rotation=45)` extruded to `m`. Top-only chamfer: revolve `[(0,0),(circ,0),(circ,m-rise),(rflat,m),(0,m)]` about Axis.Z, INTERSECT with the prism; `rflat=chamfer/2`, `rise=(circ-rflat)*tan(30deg)`. Bore subtracted last. `bore=10.1` (M12 minor dia).

---

### Task 1: `square_nut` generator

**Files:**

- Create: `catalog/models/square_nut.py`
- Test: `catalog/tests/test_square_nut.py`

**Interfaces:**

- Consumes: `catalog.models.hex_nut._MIN_WALL_MM` (only this import from hex_nut).
- Produces: `square_nut(s, m, bore, chamfer=None) -> Part`. Registered under `"square_nut"` in Task 2.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_square_nut.py`:

```python
import math

import pytest

from catalog.models.square_nut import square_nut

S = 18.0                                   # DIN 557 fixture (chamfered)
M = 10.0
BORE = 10.1
CIRCUMRADIUS = S / math.sqrt(2.0)          # half-diagonal (across-corners / 2)
DIAGONAL = 2.0 * CIRCUMRADIUS              # s * sqrt(2)


def test_square_nut_is_flat_up_with_across_flats_extents():
    part = square_nut(s=S, m=M, bore=BORE, chamfer=S)
    bb = part.bounding_box()
    assert round(bb.size.X, 2) == round(S, 2)     # flat-up: sides axis-aligned -> bbox = across-flats
    assert round(bb.size.Y, 2) == round(S, 2)
    assert round(bb.size.Z, 2) == round(M, 2)
    assert part.volume > 0


def test_square_nut_plain_prism_keeps_full_square_corners():
    part = square_nut(s=S, m=M, bore=BORE)         # chamfer=None
    radii = [math.hypot(v.X, v.Y) for v in part.vertices()]
    assert max(radii) > CIRCUMRADIUS - 0.01        # corners reach the full half-diagonal
    assert round(part.bounding_box().size.X, 2) == round(S, 2)


def test_square_nut_top_chamfer_bevels_the_top_corners_only():
    part = square_nut(s=S, m=M, bore=BORE, chamfer=S)
    verts = list(part.vertices())
    bottom = [math.hypot(v.X, v.Y) for v in verts if v.Z < 0.2]
    top = [math.hypot(v.X, v.Y) for v in verts if v.Z > M - 0.2]
    assert bottom and top
    assert max(bottom) > CIRCUMRADIUS - 0.01       # bearing face keeps sharp full-square corners
    assert max(top) < CIRCUMRADIUS - 0.5           # top corners beveled inward


def test_square_nut_chamfer_removes_material_vs_plain_prism():
    plain = square_nut(s=S, m=M, bore=BORE)
    chamfered = square_nut(s=S, m=M, bore=BORE, chamfer=S)
    assert chamfered.volume < plain.volume         # the top bevel shaves the four corners


def test_square_nut_has_an_open_bore():
    holed = square_nut(s=S, m=M, bore=BORE)
    solid = square_nut(s=S, m=M, bore=0.001)
    assert holed.volume < solid.volume             # the bore removes material


def test_square_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        square_nut(s=0.0, m=M, bore=BORE)                       # zero across-flats
    with pytest.raises(ValueError):
        square_nut(s=S, m=M, bore=0.0)                          # non-positive bore
    with pytest.raises(ValueError):
        square_nut(s=S, m=M, bore=S)                            # bore >= across-flats
    with pytest.raises(ValueError):
        square_nut(s=S, m=M, bore=BORE, chamfer=DIAGONAL + 1.0)  # chamfer circle past the corners
    with pytest.raises(ValueError):
        square_nut(s=S, m=1.0, bore=BORE, chamfer=S)            # chamfer rise doesn't fit in the height
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_square_nut.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'catalog.models.square_nut'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/square_nut.py`:

```python
"""Square nut family generator: a flat-up square prism with a through bore and an optional top-only chamfer."""
import math

from build123d import (
    BuildPart, BuildSketch, RegularPolygon, Polygon, Cylinder,
    Plane, Axis, Mode, extrude, revolve,
)

from catalog.models.hex_nut import _MIN_WALL_MM

# Standard square-nut top chamfer angle, measured from the bearing face (matches the hex family).
_CHAMFER_ANGLE_DEG = 30.0


def square_nut(s: float, m: float, bore: float, chamfer: float | None = None):
    """Square nut: across-flats ``s`` (the square side), height ``m``, drawn bore ``bore``.

    Flat-up (square sides axis-aligned, so the plan bounding box is ``s`` x ``s``). A plain
    prism when ``chamfer`` is None (e.g. DIN 928); when ``chamfer`` is the top chamfer-circle
    diameter (ISO default ``s``, e.g. DIN 557) the TOP face corners bevel in to the chamfer
    circle while the bearing (bottom) face stays a sharp full square. Bore subtracted last,
    like ``hex_nut``.
    """
    if s <= 0 or m <= 0:
        raise ValueError(f"square_nut: need s, m > 0, got s={s}, m={m}")
    if bore <= 0:
        raise ValueError(f"square_nut: need bore > 0, got {bore}")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"square_nut: bore {bore} leaves too thin a wall (needs < across-flats {s} "
            f"by at least {_MIN_WALL_MM} mm)")

    circumradius = s / math.sqrt(2.0)          # square across-corners / 2 (half-diagonal)
    rise = 0.0
    profile = None
    if chamfer is not None:
        r_flat = chamfer / 2.0                 # radius of the top chamfer circle
        if not (0 < r_flat < circumradius):
            raise ValueError(
                f"square_nut: chamfer circle radius {r_flat} must sit between 0 and the "
                f"corner radius {circumradius:.3f}")
        rise = (circumradius - r_flat) * math.tan(math.radians(_CHAMFER_ANGLE_DEG))
        if rise >= m:
            raise ValueError(f"square_nut: top chamfer ({rise:.3f}) does not fit in height {m}")
        # Meridian (x = radius, z = height): full radius up to m-rise, then cone in to r_flat
        # at the top face. Bottom stays at the full corner radius -> sharp square bearing face.
        profile = [(0.0, 0.0), (circumradius, 0.0), (circumradius, m - rise),
                   (r_flat, m), (0.0, m)]

    with BuildPart() as bp:
        with BuildSketch():
            RegularPolygon(radius=circumradius, side_count=4, rotation=45)   # flat-up square
        extrude(amount=m)
        if profile is not None:
            with BuildSketch(Plane.XZ):
                Polygon(*profile, align=None)
            revolve(axis=Axis.Z, revolution_arc=360, mode=Mode.INTERSECT)    # top-only bevel
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)         # through bore, last
    part = bp.part
    if part.volume <= 0:                        # net guard (matches hex_nut/flange_nut)
        raise ValueError("square_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_square_nut.py -q`
Expected: PASS (6 tests).

- [ ] **Step 5: Confirm no existing generator changed**

Run: `git diff --stat catalog/models/hex_nut.py catalog/models/flange_nut.py catalog/models/cap_nut.py catalog/models/castle_nut.py catalog/models/collar_nut.py`
Expected: no output.
Run: `./catalog/run pytest catalog/tests/test_hex_nut.py catalog/tests/test_collar_nut.py -q`
Expected: PASS (spot-check existing generators still green).

- [ ] **Step 6: Commit**

```bash
git add catalog/models/square_nut.py catalog/tests/test_square_nut.py
git commit -m "feat(catalog): square nut generator (flat-up prism + top chamfer + bore)"
```

---

### Task 2: Register the family and add the M12 data

**Files:**

- Modify: `catalog/models/_registry.py`
- Create: `catalog/dimensions/square_nuts.json`
- Test: `catalog/tests/test_square_nuts_data.py`

**Interfaces:**

- Consumes: `square_nut` (Task 1); `catalog.schema.validate_entry`; `catalog.models._registry.build_part`.
- Produces: two distinct entries (`din557`, `din928`).

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_square_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/square_nuts.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_square_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_all_square_bases_are_square_nuts():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "square_nut", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_every_square_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_square_nut_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_square_nuts_data.py -q`
Expected: FAIL — `square_nuts.json` does not exist, and `build_part` rejects family `square_nut` until registered.

- [ ] **Step 3: Register the family**

In `catalog/models/_registry.py`, add the import next to the other nut imports:

```python
from catalog.models.square_nut import square_nut
```

and add to `KNOWN_FAMILIES` (after the `"collar_nut": collar_nut,` entry):

```python
    "square_nut": square_nut,
```

- [ ] **Step 4: Add the data file**

Create `catalog/dimensions/square_nuts.json`:

```json
{
	"din557": {
		"family": "square_nut",
		"shape": { "s": 18.0, "m": 10.0, "bore": 10.1, "chamfer": 18.0 },
		"hardwareType": "nut",
		"source": "DIN 557 square nut, product grade C (M12): s=18 (current ISO 272 / SW18; obsolescent pre-1994 s=19 not shipped), m=10 (max/nominal), bore=10.1 (M12 minor dia). Top face chamfered (chamfer-circle diameter = s, a drawing form requirement, not tabulated -> representative), bearing face flat. Confirmed vs fasteners.eu + Fuller Fasteners + TC Fixings + Aspen Fasteners DIN 557 tables.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "557" }]
	},
	"din928": {
		"family": "square_nut",
		"shape": { "s": 19.0, "m": 9.5, "bore": 10.1 },
		"hardwareType": "nut",
		"source": "DIN 928 square weld nut, product grade A (M12): s=19, m=9.5 (nut body height), bore=10.1 (M12 minor dia). Plain flat square prism, no top chamfer; the three resistance-weld projections on the bearing face are consumed during welding and are not modelled (don't-fabricate). Confirmed vs fasteners.eu + Fuller Fasteners + fasten.it + McMaster-Carr DIN 928 tables.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "928" }]
	}
}
```

- [ ] **Step 5: Run the data test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_square_nuts_data.py -q`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the families registry test**

Run: `./catalog/run pytest catalog/tests/test_families.py -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/models/_registry.py catalog/dimensions/square_nuts.json catalog/tests/test_square_nuts_data.py
git commit -m "feat(catalog): register square_nut family and add DIN 557/928 M12 data"
```

---

### Task 3: Build the catalog and verify invariants

**Files:**

- Modify (generated, committed): `catalog/out/din557.svg`, `catalog/out/din928.svg`, `catalog/out/manifest.json`

**Interfaces:**

- Consumes: the registered family + data. `catalog/build_catalog.py` is unchanged.

- [ ] **Step 1: Record the pre-build state of existing drawings**

Run: `sha256sum catalog/out/*.svg > /tmp/square_pre_shas.txt && wc -l < /tmp/square_pre_shas.txt`
Expected: writes the current SVG shas and prints the count.

- [ ] **Step 2: Run the full catalog test suite in-container**

Run: `./catalog/run pytest catalog/tests -q`
Expected: PASS (all existing + the new `test_square_nut.py` and `test_square_nuts_data.py`).

- [ ] **Step 3: Build the catalog**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: `ok` for every entry, `0 failed`; writes 2 new drawings `catalog/out/din557.svg`, `din928.svg` and updates `manifest.json`.

- [ ] **Step 4: Verify no existing drawing changed**

Run: `sha256sum -c /tmp/square_pre_shas.txt 2>&1 | grep -v ': OK$' || echo "ALL EXISTING SVGs OK"`
Expected: every previously existing SVG reports OK. Only the 2 new SVGs are additions.

- [ ] **Step 5: Verify the two new drawings exist**

Run: `ls -1 catalog/out/din557.svg catalog/out/din928.svg`
Expected: both listed.

- [ ] **Step 6: Verify the opt-in invariant (0/0)**

Run: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts`
Expected: both report `0`.

- [ ] **Step 7: Normalise the manifest formatting and commit the build output**

```bash
npx prettier --write catalog/out/manifest.json
git add catalog/out
git commit -m "build(catalog): render DIN 557/928 square nut drawings"
```

Expected: the commit contains only the 2 new SVGs and the manifest update (verify with `git show --stat HEAD`).

---

## Self-Review

**Spec coverage:** Generator with flat-up prism + top-only chamfer + bore and all guards (Task 1), registration + 2 distinct data entries (Task 2), build + byte-identical existing SVGs + opt-in 0/0 (Task 3). ✅

**Placeholder scan:** No TBD/TODO; every code and command step is concrete. ✅

**Type consistency:** `square_nut(s, m, bore, chamfer=None)` used identically in generator, tests, and data `shape` keys (din557 includes `chamfer`, din928 omits it → None). Only `_MIN_WALL_MM` imported from hex_nut. ✅
