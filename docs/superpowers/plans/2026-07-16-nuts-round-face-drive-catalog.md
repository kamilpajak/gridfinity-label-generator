# Round-Nut Face/Cross-Drive Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the round-nut group with two new generators — `slotted_face_nut` (DIN 546, one diametral screwdriver slot across the top face) and `cross_hole_nut` (DIN 1816, N radial holes drilled into the outer wall) — plus their M12 data entries.

**Architecture:** Two small single-responsibility generators, each a plain round `Cylinder` body + one drive feature (subtracted) + a through bore, importing only `_MIN_WALL_MM` from `hex_nut`. Registered in `_registry.py`; data in a new `round_face_nuts.json`. `hardwareType: "nut"` → existing `NUT_PRESET`, no render change.

**Tech Stack:** Python + build123d (in-container via `./catalog/run`), pytest, JSON data files.

## Global Constraints

- Representative size **M12**. Ships exactly `din546` + `din1816`.
- Every committed dimension confirmed by **≥2 independent public tables**; any representative field documented as such, never fabricated. Shape features verified against the legacy raster **and** the tables (DIN 467 boss lesson).
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- Two **new** base shapes — do **not** touch `_chamfered_hex_solid` or any existing generator. Existing SVGs stay **byte-identical**.
- **No render/preset change.** Both axisymmetric round bodies → `NUT_PRESET`.
- **opt-in 0/0** after build: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts` → `0` for both. Do **not** run `catalog/integrate.py` or `pnpm standards:build`.
- In-container only via `./catalog/run`. Build entrypoint: `python -m catalog.build_catalog`.
- Generator geometry tests use **synthetic** fixtures (not any real standard). Real dimensions come from the controller sourcing pass at the data task.

---

### Task 1: `slotted_face_nut` generator (DIN 546)

**Files:**

- Create: `catalog/models/slotted_face_nut.py`
- Create: `catalog/tests/test_slotted_face_nut.py`
- Modify: `catalog/models/_registry.py` (add import + `KNOWN_FAMILIES` entry)

**Interfaces:**

- Consumes: `from catalog.models.hex_nut import _MIN_WALL_MM` (a float, the shared minimum wall thickness, currently `0.1`).
- Produces: `slotted_face_nut(d: float, h: float, bore: float, slot_w: float, slot_depth: float) -> build123d Part`. Registered as family key `"slotted_face_nut"`.

- [ ] **Step 1: Write the failing generator test**

Create `catalog/tests/test_slotted_face_nut.py`:

```python
import pytest
from build123d import Box, Pos

from catalog.models.slotted_face_nut import slotted_face_nut

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
# One diametral slot along X, opening from the top face (z=+h/2) down slot_depth,
# so the slot band is z in [2, 5]; slot half-width in Y is 2.5.
CFG = dict(d=30.0, h=10.0, bore=13.0, slot_w=5.0, slot_depth=3.0)


def _solid_at(part, x, y, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = slotted_face_nut(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["h"], 1)     # full height on the axis
    assert round(bb.size.X, 1) == round(CFG["d"], 1)     # full OD
    assert round(bb.size.Y, 1) == round(CFG["d"], 1)
    assert part.volume > 0


def test_slot_notches_the_top_face_along_x():
    part = slotted_face_nut(**CFG)
    z = CFG["h"] / 2 - CFG["slot_depth"] / 2             # mid of the top-open slot band
    # On the slot centreline (y=0), out toward the rim: void where the slot is cut.
    assert not _solid_at(part, CFG["d"] / 2 - 2.0, 0.0, z, probe=0.6)
    # Off the slot in Y (beyond slot_w/2): solid.
    assert _solid_at(part, CFG["d"] / 2 - 2.0, CFG["slot_w"] / 2 + 1.5, z, probe=0.6)


def test_slot_is_partial_depth_solid_below():
    # The defining feature: the slot opens from the top face only; below slot_depth it is solid.
    part = slotted_face_nut(**CFG)
    z = -CFG["h"] / 2 + 0.5                               # near the bottom face, below the slot band
    assert _solid_at(part, CFG["d"] / 2 - 2.0, 0.0, z, probe=0.6)   # solid: slot does not reach the bottom


def test_open_bore_through_the_nut():
    part = slotted_face_nut(**CFG)
    assert not _solid_at(part, 0.0, 0.0, -CFG["h"] / 2 + 0.5, probe=0.6)   # bore void on the axis
    assert _solid_at(part, 0.0, 8.0, 0.0, probe=0.6)      # off-slot wall between bore and OD is solid
    solid = slotted_face_nut(**{**CFG, "bore": 0.4})
    assert part.volume < solid.volume                     # the bore removes real material


def test_builds_at_a_valid_config():
    assert slotted_face_nut(**CFG).volume > 0


def test_slotted_face_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "d": 0.0})              # non-positive dim
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "slot_w": 0.0})         # non-positive slot_w
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "slot_depth": 0.0})     # non-positive slot_depth
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "slot_depth": CFG["h"]})   # slot as deep as the nut (no floor)
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "slot_w": CFG["d"]})    # slot as wide as the OD (no rim)
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "bore": CFG["d"]})      # bore wall vs OD too thin
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_slotted_face_nut.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.slotted_face_nut'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/slotted_face_nut.py`:

```python
"""Slotted round nut family generator (DIN 546, screwdriver slot).

A round cylindrical body with a single straight slot cut diametrically across the top face
(a screwdriver drive) and a through bore. The slot opens from the top face to a partial axial
depth ``slot_depth`` — the DIN 546 slot does NOT run the full nut height (the tabulated slot
depth t is well under the height m). Only the metal envelope is drawn (no thread, no chamfer).
"""
from build123d import BuildPart, Cylinder, Box, Locations, Mode

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def slotted_face_nut(d: float, h: float, bore: float, slot_w: float, slot_depth: float):
    """Round nut of outer diameter ``d`` and height ``h`` with a through ``bore`` and one
    straight slot of width ``slot_w`` cut ``slot_depth`` into the top face, running the full
    diameter along X (a screwdriver slot, partial-depth — it opens from the top face only).

    Body is a ``Cylinder`` centred on the origin; the slot is a single ``Box`` subtracted at
    the top face, its length overshooting both rim edges and its upper half overshooting above
    the nut so only the top ``slot_depth`` is removed; the bore is subtracted last (like
    ``hex_nut``). Rotationally framed with the slot on X — no preset change.
    """
    for name, val in (("d", d), ("h", h), ("bore", bore),
                      ("slot_w", slot_w), ("slot_depth", slot_depth)):
        if val <= 0:
            raise ValueError(f"slotted_face_nut: need {name} > 0, got {val}")
    if slot_depth >= h - _MIN_WALL_MM:
        raise ValueError(
            f"slotted_face_nut: slot_depth {slot_depth} leaves too thin a floor vs height {h} "
            f"(needs < h - {_MIN_WALL_MM} mm; the slot opens from the top face only)")
    if slot_w >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"slotted_face_nut: slot_w {slot_w} leaves too thin a rim vs OD {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")
    if bore >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"slotted_face_nut: bore {bore} leaves too thin a wall vs OD {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")

    with BuildPart() as bp:
        Cylinder(radius=d / 2.0, height=h)                 # Align.CENTER: spans z in [-h/2, h/2]
        with Locations((0.0, 0.0, h / 2.0)):               # slot box centred on the top face
            Box(2.0 * d, slot_w, 2.0 * slot_depth, mode=Mode.SUBTRACT)  # diametral, opens from top
        Cylinder(radius=bore / 2.0, height=h * 3.0, mode=Mode.SUBTRACT)  # through bore, last
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("slotted_face_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Register the family**

In `catalog/models/_registry.py`, add the import after the `slotted_round_nut` import (line 16):

```python
from catalog.models.slotted_face_nut import slotted_face_nut
```

and add to the `KNOWN_FAMILIES` dict (after the `slotted_round_nut` entry):

```python
    "slotted_face_nut": slotted_face_nut,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_slotted_face_nut.py -q`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add catalog/models/slotted_face_nut.py catalog/tests/test_slotted_face_nut.py catalog/models/_registry.py
git commit -m "feat(catalog): add slotted_face_nut generator (DIN 546)"
```

---

### Task 2: `cross_hole_nut` generator (DIN 1816)

**Files:**

- Create: `catalog/models/cross_hole_nut.py`
- Create: `catalog/tests/test_cross_hole_nut.py`
- Modify: `catalog/models/_registry.py` (add import + `KNOWN_FAMILIES` entry)

**Interfaces:**

- Consumes: `from catalog.models.hex_nut import _MIN_WALL_MM`.
- Produces: `cross_hole_nut(d: float, h: float, bore: float, n_holes: int, hole_d: float, hole_depth: float) -> build123d Part`. Registered as family key `"cross_hole_nut"`.

**Construction note (radial holes):** each hole is a `Cylinder` whose axis is rotated to point radially. A bare `Cylinder` has its axis along local Z; `rotation=(0, 90, 0)` turns that axis onto local X, and `PolarLocations(d/2, n_holes)` then maps local X to the radial direction at each hole angle (its default `rotate=True` orients each frame outward, exactly as `castle_nut` relies on for its radial slot boxes). Placing the hole cylinder at radius `d/2` with height `2*hole_depth` centres it on the OD so its inner half reaches `hole_depth` into the wall and its outer half overshoots the OD surface (a clean break at the surface). Mid-height because `PolarLocations` places at `z=0`, the body's centre.

- [ ] **Step 1: Write the failing generator test**

Create `catalog/tests/test_cross_hole_nut.py`:

```python
import math

import pytest
from build123d import Box, Pos

from catalog.models.cross_hole_nut import cross_hole_nut

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
# 4 radial holes at mid-height (z=0), drilled hole_depth into the OD wall.
CFG = dict(d=30.0, h=12.0, bore=13.0, n_holes=4, hole_d=4.0, hole_depth=5.0)


def _solid_at(part, x, y, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def _polar(radius, deg):
    return radius * math.cos(math.radians(deg)), radius * math.sin(math.radians(deg))


def test_envelope_extents():
    part = cross_hole_nut(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["h"], 1)      # full height
    assert round(bb.size.X, 1) == round(CFG["d"], 1)      # full OD (holes subtract, don't grow bbox)
    assert round(bb.size.Y, 1) == round(CFG["d"], 1)
    assert part.volume > 0


def test_holes_notch_the_wall_at_mid_height():
    part = cross_hole_nut(**CFG)
    r = CFG["d"] / 2 - CFG["hole_depth"] / 2              # inside the drilled band, radially
    for k in range(CFG["n_holes"]):                       # holes at 0, 90, 180, 270 deg
        x, y = _polar(r, 360.0 / CFG["n_holes"] * k)
        assert not _solid_at(part, x, y, 0.0, probe=0.6)  # void: a hole is drilled here
    x, y = _polar(r, 45.0)                                # between two holes
    assert _solid_at(part, x, y, 0.0, probe=0.6)          # solid: a tower


def test_holes_leave_a_wall_band_above_and_below():
    # The radial hole sits at mid-height; near the top and bottom faces the wall is solid.
    part = cross_hole_nut(**CFG)
    r = CFG["d"] / 2 - 0.5                                # just inside the OD
    for z in (CFG["h"] / 2 - 0.5, -CFG["h"] / 2 + 0.5):   # top and bottom bands
        x, y = _polar(r, 0.0)                             # the +X hole axis
        assert _solid_at(part, x, y, z, probe=0.6)        # solid: hole does not reach the faces


def test_hole_floor_leaves_a_wall_to_the_bore():
    part = cross_hole_nut(**CFG)
    # +X hole axis, radius 8: inside the hole floor (r = d/2 - hole_depth = 10) and above the
    # bore wall (bore/2 = 6.5) -> solid.
    assert _solid_at(part, 8.0, 0.0, 0.0)


def test_open_bore_through_the_nut():
    part = cross_hole_nut(**CFG)
    assert not _solid_at(part, 0.0, 0.0, 0.0, probe=0.6)  # bore void on the axis
    x, y = _polar(8.0, 45.0)                              # a between-hole wall
    assert _solid_at(part, x, y, 0.0, probe=0.6)
    solid = cross_hole_nut(**{**CFG, "bore": 0.4})
    assert part.volume < solid.volume                     # the bore removes real material


def test_builds_at_a_valid_config():
    assert cross_hole_nut(**CFG).volume > 0


def test_cross_hole_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "d": 0.0})                # non-positive dim
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "hole_d": 0.0})           # non-positive hole_d
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "hole_depth": 0.0})       # non-positive hole_depth
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "hole_d": CFG["h"]})      # hole taller than the height band
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "hole_depth": 9.0})       # hole floor reaches the bore wall
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "bore": CFG["d"]})        # bore wall vs OD too thin
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "n_holes": 200})          # holes exceed the circumference
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "n_holes": 4.5})          # non-integer hole count
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "n_holes": 0})            # non-positive hole count
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_cross_hole_nut.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.cross_hole_nut'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/cross_hole_nut.py`:

```python
"""Cross-hole round nut family generator (DIN 1816, Kreuzlochmutter).

A round cylindrical body with N radial holes drilled into the outer wall (perpendicular to
the axis, for a pin / tommy-bar spanner) and a through bore. The holes sit at mid-height and
open on the OD surface. Only the metal envelope is drawn (no thread, no chamfer). The holes
are the defining drive feature — NOT axial holes in the top face.
"""
import math

from build123d import BuildPart, Cylinder, PolarLocations, Mode

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def cross_hole_nut(d: float, h: float, bore: float, n_holes: int,
                   hole_d: float, hole_depth: float):
    """Round nut of outer diameter ``d`` and height ``h`` with a through ``bore`` and
    ``n_holes`` radial holes of diameter ``hole_d`` drilled ``hole_depth`` into the OD wall at
    mid-height (a pin-spanner drive; first hole on +X).

    Body is a ``Cylinder`` centred on the origin; each hole is a ``Cylinder`` whose axis is
    rotated onto local X (``rotation=(0, 90, 0)``) and placed radially by ``PolarLocations``
    (its ``rotate=True`` frame points local X outward), centred at the OD so it reaches
    ``hole_depth`` into the wall; the bore is subtracted last (like ``hex_nut``). Rotationally
    symmetric at the N hole positions — no preset change.
    """
    for name, val in (("d", d), ("h", h), ("bore", bore),
                      ("hole_d", hole_d), ("hole_depth", hole_depth)):
        if val <= 0:
            raise ValueError(f"cross_hole_nut: need {name} > 0, got {val}")
    if n_holes < 1 or int(n_holes) != n_holes:
        raise ValueError(f"cross_hole_nut: n_holes must be a positive integer, got {n_holes}")
    if hole_d >= h - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"cross_hole_nut: hole_d {hole_d} leaves too thin a band vs height {h} "
            f"(needs < h - {2.0 * _MIN_WALL_MM} mm; the hole leaves a wall above and below)")
    if hole_depth >= d / 2.0 - bore / 2.0 - _MIN_WALL_MM:
        raise ValueError(
            f"cross_hole_nut: hole_depth {hole_depth} reaches the bore wall "
            f"(needs < d/2 - bore/2 - {_MIN_WALL_MM} = {d / 2.0 - bore / 2.0 - _MIN_WALL_MM:.3f} mm)")
    if n_holes * hole_d >= math.pi * d:
        raise ValueError(
            f"cross_hole_nut: {n_holes} holes of diameter {hole_d} exceed the OD "
            f"circumference {math.pi * d:.3f} (no towers would survive)")
    if bore >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"cross_hole_nut: bore {bore} leaves too thin a wall vs OD {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")

    with BuildPart() as bp:
        Cylinder(radius=d / 2.0, height=h)                 # Align.CENTER: spans z in [-h/2, h/2]
        with PolarLocations(d / 2.0, int(n_holes), start_angle=0.0):
            # axis rotated onto local X -> radial (PolarLocations points local X outward);
            # centred at the OD, height 2*hole_depth reaches hole_depth into the wall.
            Cylinder(radius=hole_d / 2.0, height=2.0 * hole_depth,
                     rotation=(0.0, 90.0, 0.0), mode=Mode.SUBTRACT)
        Cylinder(radius=bore / 2.0, height=h * 3.0, mode=Mode.SUBTRACT)  # through bore, last
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("cross_hole_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Register the family**

In `catalog/models/_registry.py`, add the import after the `slotted_face_nut` import (from Task 1):

```python
from catalog.models.cross_hole_nut import cross_hole_nut
```

and add to the `KNOWN_FAMILIES` dict (after the `slotted_face_nut` entry):

```python
    "cross_hole_nut": cross_hole_nut,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_cross_hole_nut.py -q`
Expected: PASS. If any hole-position test fails, the radial orientation is wrong — verify `rotation=(0, 90, 0)` puts the hole axis on local X (radial under `PolarLocations`), not vertical; do not change the test.

- [ ] **Step 6: Commit**

```bash
git add catalog/models/cross_hole_nut.py catalog/tests/test_cross_hole_nut.py catalog/models/_registry.py
git commit -m "feat(catalog): add cross_hole_nut generator (DIN 1816)"
```

---

### Task 3: Data entries + build (`din546`, `din1816`)

> **Controller sourcing gate (do BEFORE dispatching this task's implementer).** The controller
> runs a sourcing subagent (constrained to summary tools / `pdftotext`, not full-page crawling)
> plus a controller perplexity cross-check to confirm every dimension against **≥2 independent
> public tables**, and to resolve the two open `din1816` shape questions against the raster:
> (1) the radial holes' axial position (mid-height unless a table says otherwise) and (2) whether
> a concentric top-face step is a real tabulated feature or only the pin-hole pitch circle. The
> reconciled result — including the **exact JSON** to write — goes to
> `.superpowers/sdd/sourcing-decision.md`. The implementer copies values from that file verbatim;
> it does not invent or adjust dimensions. If sourcing shows the holes are off mid-height, the
> `cross_hole_nut` signature/data gains a documented `hole_z`; if a real top step exists, it is
> modelled before this task ships (escalate to the controller — that changes Task 2).

**Files:**

- Create: `catalog/dimensions/round_face_nuts.json`
- Create: `catalog/tests/test_round_face_nuts_data.py`

**Interfaces:**

- Consumes: `slotted_face_nut` (Task 1) and `cross_hole_nut` (Task 2) via `build_part(family, shape)`; `validate_entry` from `catalog.schema`.
- Produces: two catalog entries `din546` (family `slotted_face_nut`) and `din1816` (family `cross_hole_nut`), each with `family`, `shape`, `hardwareType: "nut"`, `source`, `verified: true`, `designations`.

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_round_face_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/round_face_nuts.json")
_FORBIDDEN = ("reyher", "stalmut")
_EXPECTED_FAMILY = {"din546": "slotted_face_nut", "din1816": "cross_hole_nut"}


def test_every_round_face_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 2
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_round_face_nut_families_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == _EXPECTED_FAMILY[sid], f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_every_round_face_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_round_face_nut_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_round_face_nuts_data.py -q`
Expected: FAIL — `FileNotFoundError` (the data file does not exist yet).

- [ ] **Step 3: Write the data file from the sourcing decision**

Create `catalog/dimensions/round_face_nuts.json` by copying the exact `shape`, `bore`, and
`source` values from `.superpowers/sdd/sourcing-decision.md` (produced by the controller
sourcing gate). The structure is fixed; the numbers come from that file. Shape below shows the
required keys and the representative M12 values the sourcing pass confirmed (the implementer
uses the file's final numbers, which may refine these):

```json
{
	"din546": {
		"family": "slotted_face_nut",
		"shape": { "d": 21.0, "h": 10.0, "bore": 10.1, "slot_w": 4.0, "slot_depth": 3.8 },
		"hardwareType": "nut",
		"source": "<from sourcing-decision.md: cites >=2 public tables; states which fields are tabulated vs representative; bore = M12 coarse minor>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "546" }]
	},
	"din1816": {
		"family": "cross_hole_nut",
		"shape": { "d": 28.0, "h": 6.0, "bore": 10.4, "n_holes": 4, "hole_d": 3.0, "hole_depth": 3.0 },
		"hardwareType": "nut",
		"source": "<from sourcing-decision.md: cites >=2 public tables; bore = M12x1.5 fine minor; states hole axial position and whether a top step exists>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "1816" }]
	}
}
```

- [ ] **Step 4: Run the data test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_round_face_nuts_data.py -q`
Expected: PASS (both entries validate and build).

- [ ] **Step 5: Run the full catalog suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — all prior tests plus the three new files green.

- [ ] **Step 6: Build the catalog in-container and check invariants**

Run:

```bash
./catalog/run python -m catalog.build_catalog
git status --short catalog/out
grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts
```

Expected: two **new** files `catalog/out/din546.svg` and `catalog/out/din1816.svg` appear in `git status`; **no** existing `catalog/out/*.svg` is modified (byte-identical); both `grep -c` counts are `0` (opt-in gate held).

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/round_face_nuts.json catalog/tests/test_round_face_nuts_data.py catalog/out/din546.svg catalog/out/din1816.svg
git commit -m "feat(catalog): add round-nut face/cross-drive data (DIN 546 / DIN 1816)"
```

---

## Self-Review

**1. Spec coverage.** slotted_face_nut generator (Task 1) ✓; cross_hole_nut generator + radial-hole construction (Task 2) ✓; registration in `_registry.py` (Tasks 1 & 2) ✓; data file with both standards + fine-thread bore + sourcing gate resolving the two din1816 shape questions (Task 3) ✓; synthetic-fixture generator tests + data tests (all tasks) ✓; no render change — `hardwareType: "nut"` throughout ✓; opt-in 0/0 + byte-identical SVGs + in-container build (Task 3, Step 6) ✓; no forbidden source token (data test) ✓.

**2. Placeholder scan.** The only `<...>` placeholders are the two `source` strings in Task 3, which are intentionally filled from `.superpowers/sdd/sourcing-decision.md` at execution — the controller sourcing gate is the documented mechanism (matching the shipped `slotted_round_nut` plan), not a plan gap. All code steps carry complete code.

**3. Type consistency.** `slotted_face_nut(d, h, bore, slot_w, slot_depth)` and `cross_hole_nut(d, h, bore, n_holes, hole_d, hole_depth)` are used identically in generators, tests, registry keys (`"slotted_face_nut"`, `"cross_hole_nut"`), and the data `shape` blocks. `_MIN_WALL_MM` imported (not redefined) in both. Data `family` values match the registry keys and `_EXPECTED_FAMILY` in the data test.
