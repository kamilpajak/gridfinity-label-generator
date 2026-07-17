# DIN 508 T-Slot Nut Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-standard `tslot_nut` generator (DIN 508 T-slot nut — a stepped-T prismatic block: wide foot + narrow neck + top chamfer + through bore) plus its representative 14 mm-slot / M12 data entry.

**Architecture:** One new generator that builds the T cross-section as a 2D polygon in the XZ plane and extrudes it along Y, then subtracts a vertical through bore. Length-along-Y orientation makes the T land in the profile view under the existing NUT_PRESET. Imports only `_MIN_WALL_MM` from `hex_nut`. Data in a new `tslot_nuts.json`.

**Tech Stack:** Python + build123d (in-container via `./catalog/run`), pytest, JSON data files.

## Global Constraints

- Representative size **14 mm slot / M12**. Ships exactly `din508`.
- Every committed dimension confirmed by **≥2 independent public tables**; representative fields (chamfer leg, and the neck-width symbol choice) documented as such, never fabricated. Shape (wide foot / narrow neck / top chamfer / through bore) verified against the raster + tables.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- A **new** base shape — do **not** touch `_chamfered_hex_solid` or any existing generator. Existing SVGs stay **byte-identical**.
- **No render/preset change.** Length-along-Y orientation → the T lands in the profile → `hardwareType: "nut"` → NUT_PRESET.
- **opt-in 0/0** after build: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts` → `0` for both. Do **not** run `catalog/integrate.py` or `pnpm standards:build`.
- In-container only via `./catalog/run`. Build entrypoint: `python -m catalog.build_catalog`.
- Generator geometry tests use **synthetic** fixtures (not the real standard). Real dimensions come from the controller sourcing pass at the data task.

---

### Task 1: `tslot_nut` generator (DIN 508)

**Files:**

- Create: `catalog/models/tslot_nut.py`
- Create: `catalog/tests/test_tslot_nut.py`
- Modify: `catalog/models/_registry.py` (add import + `KNOWN_FAMILIES` entry)

**Interfaces:**

- Consumes: `from catalog.models.hex_nut import _MIN_WALL_MM` (a float, the shared minimum wall thickness, currently `0.1`).
- Produces: `tslot_nut(length, foot_w, neck_w, foot_h, height, bore, chamfer=None) -> build123d Part`. Registered as family key `"tslot_nut"`.

- [ ] **Step 1: Write the failing generator test**

Create `catalog/tests/test_tslot_nut.py`:

```python
import pytest
from build123d import Box, Pos

from catalog.models.tslot_nut import tslot_nut

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
# Foot 22 wide x 8 tall at the bottom; neck 14 wide x 8 tall on top; 2mm top-corner chamfer.
# Length runs along Y. Foot band z in [0,8], neck band z in [8,16]. Bore radius 5 on the axis.
CFG = dict(length=20.0, foot_w=22.0, neck_w=14.0, foot_h=8.0, height=16.0, bore=10.0, chamfer=2.0)


def _solid_at(part, x, y, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = tslot_nut(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(CFG["foot_w"], 1)   # widest at the foot
    assert round(bb.size.Y, 1) == round(CFG["length"], 1)   # length along Y
    assert round(bb.size.Z, 1) == round(CFG["height"], 1)   # total height on Z
    assert part.volume > 0


def test_stepped_t_narrow_neck_over_wide_foot():
    # The defining feature: wide foot at the bottom, narrow neck above it.
    part = tslot_nut(**CFG)
    x_foot = CFG["foot_w"] / 2 - 0.6          # inside the foot corner (x ~10.4)
    z_foot = CFG["foot_h"] / 2                # mid foot band (z=4)
    assert _solid_at(part, x_foot, 0.0, z_foot, probe=0.6)   # solid: the wide foot
    z_neck = CFG["foot_h"] + (CFG["height"] - CFG["foot_h"]) / 2   # mid neck band (z=12)
    assert not _solid_at(part, x_foot, 0.0, z_neck, probe=0.6)     # void: neck is narrower than the foot


def test_neck_is_present():
    part = tslot_nut(**CFG)
    x_neck = CFG["neck_w"] / 2 - 1.0         # inside the neck (x=6), outside the bore (r=5)
    z_neck = CFG["foot_h"] + 2.0             # in the neck band (z=10)
    assert _solid_at(part, x_neck, 0.0, z_neck, probe=0.6)


def test_open_bore_through_the_block():
    part = tslot_nut(**CFG)
    assert not _solid_at(part, 0.0, 0.0, 1.0, probe=0.6)          # bore void near the bottom
    assert not _solid_at(part, 0.0, 0.0, CFG["height"] - 1.0, probe=0.6)   # and near the top
    assert _solid_at(part, CFG["neck_w"] / 2 - 1.0, 0.0, 10.0, probe=0.6)  # wall beside the bore
    solid = tslot_nut(**{**CFG, "bore": 0.4})
    assert part.volume < solid.volume                            # the bore removes real material


def test_top_corner_chamfer_is_cut():
    part = tslot_nut(**CFG)
    # Extreme top outer neck corner: with a 2mm 45-deg chamfer, x=6.5 at z=15.5 is cut away
    # (chamfer edge at z=15.5 is x = neck_w/2 - (chamfer - (height - z)) = 7 - 1.5 = 5.5).
    assert not _solid_at(part, CFG["neck_w"] / 2 - 0.5, 0.0, CFG["height"] - 0.5, probe=0.4)
    # Same nut without a chamfer: that corner is solid.
    square = tslot_nut(**{**CFG, "chamfer": None})
    assert _solid_at(square, CFG["neck_w"] / 2 - 0.5, 0.0, CFG["height"] - 0.5, probe=0.4)


def test_builds_at_a_valid_config():
    assert tslot_nut(**CFG).volume > 0
    assert tslot_nut(**{**CFG, "chamfer": None}).volume > 0     # plain (unchamfered) also builds


def test_tslot_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "foot_w": 0.0})                     # non-positive dim
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "neck_w": CFG["foot_w"]})           # neck not narrower than foot
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "foot_h": CFG["height"]})           # no neck remains
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "bore": CFG["neck_w"]})             # bore wall vs neck too thin
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "chamfer": 0.0})                    # non-positive chamfer
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "chamfer": CFG["neck_w"] / 2})      # chamfer exceeds half the neck width
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "foot_h": 15.0, "chamfer": 1.5})    # chamfer (1.5) exceeds neck height (16-15=1)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_tslot_nut.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.tslot_nut'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/tslot_nut.py`:

```python
"""T-slot nut family generator (DIN 508, Nutenstein / T-slot nut).

A stepped-T prismatic block: a wide foot that engages a machine-table T-slot undercut, a
narrower neck rising from it (optionally chamfered on the top corners), and a threaded bore
running vertically through it. The T cross-section is drawn in the XZ plane and extruded along
Y (the sliding/length axis) so the iconic T lands in the profile view under NUT_PRESET; the
bore is subtracted along Z last (like ``hex_nut``). Only the metal envelope is drawn (no thread).
"""
from build123d import BuildPart, BuildSketch, Polygon, Cylinder, Plane, Mode, extrude

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def tslot_nut(length: float, foot_w: float, neck_w: float, foot_h: float,
              height: float, bore: float, chamfer: float | None = None):
    """T-slot nut: a block of ``length`` (along Y) whose cross-section is a wide foot
    (``foot_w`` x ``foot_h``) under a narrower neck (``neck_w`` x ``height - foot_h``), with a
    through ``bore`` along Z and an optional 45-degree ``chamfer`` on the top outer neck corners.

    The T cross-section is a ``Polygon`` in the XZ plane (x = width centred on 0, z = height
    from 0), extruded ``length`` along Y (centred), then the bore is subtracted last.
    """
    for name, val in (("length", length), ("foot_w", foot_w), ("neck_w", neck_w),
                      ("foot_h", foot_h), ("height", height), ("bore", bore)):
        if val <= 0:
            raise ValueError(f"tslot_nut: need {name} > 0, got {val}")
    if neck_w >= foot_w:
        raise ValueError(
            f"tslot_nut: neck_w {neck_w} must be < foot_w {foot_w} (the foot is the wider T-crossbar)")
    if foot_h >= height:
        raise ValueError(
            f"tslot_nut: foot_h {foot_h} must be < height {height} (a neck of positive height must remain)")
    if bore >= neck_w - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"tslot_nut: bore {bore} leaves too thin a wall vs neck_w {neck_w} "
            f"(needs < neck_w - {2.0 * _MIN_WALL_MM} mm; the neck is the binding width)")
    if chamfer is not None:
        if chamfer <= 0:
            raise ValueError(f"tslot_nut: need chamfer > 0 when given, got {chamfer}")
        if chamfer >= neck_w / 2.0:
            raise ValueError(
                f"tslot_nut: chamfer {chamfer} must be < neck_w/2 = {neck_w / 2.0} (stays within the neck width)")
        if chamfer >= height - foot_h:
            raise ValueError(
                f"tslot_nut: chamfer {chamfer} must be < neck height {height - foot_h} (stays within the neck)")

    fw, nw = foot_w / 2.0, neck_w / 2.0
    if chamfer is not None:
        c = chamfer
        # T cross-section, counter-clockwise, with the top outer corners bevelled by 45 deg.
        pts = [
            (-fw, 0.0), (fw, 0.0),               # foot bottom edge
            (fw, foot_h), (nw, foot_h),          # foot top-right + step in to the neck
            (nw, height - c), (nw - c, height),  # neck right rise + top-right chamfer
            (-(nw - c), height), (-nw, height - c),  # top-left chamfer + neck left
            (-nw, foot_h), (-fw, foot_h),        # step out + foot top-left
        ]
    else:
        pts = [
            (-fw, 0.0), (fw, 0.0),
            (fw, foot_h), (nw, foot_h),
            (nw, height), (-nw, height),
            (-nw, foot_h), (-fw, foot_h),
        ]

    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*pts, align=None)            # explicit coords -> no auto-centring
        extrude(amount=length / 2.0, both=True)  # extrude along Y, centred on y=0
        Cylinder(radius=bore / 2.0, height=height * 3.0, mode=Mode.SUBTRACT)   # through bore along Z, last
    part = bp.part
    if part.volume <= 0:                          # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("tslot_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Register the family**

In `catalog/models/_registry.py`, add the import after the `cross_hole_nut` import:

```python
from catalog.models.tslot_nut import tslot_nut
```

and add to the `KNOWN_FAMILIES` dict (after the `cross_hole_nut` entry):

```python
    "tslot_nut": tslot_nut,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_tslot_nut.py -q`
Expected: PASS (all tests green). If the profile extrudes the wrong way or the sketch plane is off (bbox X/Y/Z mismatched), fix the construction — do not change the tests. Note `BuildSketch(Plane.XZ)` maps polygon `(u, v)` to global `(u, 0, v)`, and `extrude(both=True)` centres the length on Y.

- [ ] **Step 6: Commit**

```bash
git add catalog/models/tslot_nut.py catalog/tests/test_tslot_nut.py catalog/models/_registry.py
git commit -m "feat(catalog): add tslot_nut generator (DIN 508 T-slot nut)"
```

---

### Task 2: Data entry + build (`din508`)

> **Controller sourcing gate (do BEFORE dispatching this task's implementer).** The controller
> runs a sourcing subagent (constrained to summary tools / `pdftotext`, not full-page crawling)
> plus a controller perplexity cross-check to confirm every dimension against **≥2 independent
> public tables** and to resolve the two shape questions against the raster: (1) the **neck-width
> symbol inconsistency** (≈14, i.e. the slot width, vs ≈16 in some tables) and (2) the
> representative **top chamfer** leg. The reconciled result — including the **exact JSON** to
> write — goes to `.superpowers/sdd/sourcing-decision.md`. The implementer copies values from
> that file verbatim; it does not invent or adjust dimensions.

**Files:**

- Create: `catalog/dimensions/tslot_nuts.json`
- Create: `catalog/tests/test_tslot_nuts_data.py`

**Interfaces:**

- Consumes: `tslot_nut` (Task 1) via `build_part(family, shape)`; `validate_entry` from `catalog.schema`.
- Produces: one catalog entry `din508` (family `tslot_nut`) with `family`, `shape`, `hardwareType: "nut"`, `source`, `verified: true`, `designations`.

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_tslot_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/tslot_nuts.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_tslot_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_tslot_nut_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "tslot_nut", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_every_tslot_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_tslot_nut_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_tslot_nuts_data.py -q`
Expected: FAIL — `FileNotFoundError` (the data file does not exist yet).

- [ ] **Step 3: Write the data file from the sourcing decision**

Create `catalog/dimensions/tslot_nuts.json` by copying the exact `shape` and `source` values
from `.superpowers/sdd/sourcing-decision.md` (produced by the controller sourcing gate). The
structure is fixed; the numbers come from that file. Shape below shows the required keys and the
representative M12 / 14 mm-slot values the sourcing pass confirmed (the implementer uses the
file's final numbers, which may refine these):

```json
{
	"din508": {
		"family": "tslot_nut",
		"shape": {
			"length": 22.0,
			"foot_w": 22.0,
			"neck_w": 14.0,
			"foot_h": 8.0,
			"height": 16.0,
			"bore": 10.1,
			"chamfer": 1.5
		},
		"hardwareType": "nut",
		"source": "<from sourcing-decision.md: cites >=2 public tables; states the neck_w symbol choice (14 vs 16) and that chamfer is representative; bore = M12 coarse minor>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "508" }]
	}
}
```

- [ ] **Step 4: Run the data test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_tslot_nuts_data.py -q`
Expected: PASS (the entry validates and builds).

- [ ] **Step 5: Run the full catalog suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — all prior tests plus the two new files green.

- [ ] **Step 6: Build the catalog in-container and check invariants**

Run:

```bash
./catalog/run python -m catalog.build_catalog
git status --short catalog/out
grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts
```

Expected: one **new** file `catalog/out/din508.svg` appears in `git status` (plus a modified `catalog/out/manifest.json`, the build index); **no** existing `catalog/out/*.svg` is modified (byte-identical); both `grep -c` counts are `0` (opt-in gate held).

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/tslot_nuts.json catalog/tests/test_tslot_nuts_data.py catalog/out/din508.svg catalog/out/manifest.json
git commit -m "feat(catalog): add DIN 508 T-slot nut data"
```

---

## Self-Review

**1. Spec coverage.** `tslot_nut` generator with the stepped-T extrusion + optional top chamfer + through bore (Task 1) ✓; registration in `_registry.py` (Task 1) ✓; data file with the representative 14 mm-slot / M12 entry + sourcing gate resolving the neck-width symbol and the chamfer (Task 2) ✓; synthetic-fixture generator tests (incl. the stepped-T discriminator and the chamfer cut) + data tests ✓; no render change — `hardwareType: "nut"`, length-along-Y orientation ✓; opt-in 0/0 + byte-identical SVGs + in-container build (Task 2, Step 6) ✓; no forbidden source token (data test) ✓.

**2. Placeholder scan.** The only `<...>` placeholder is the `source` string in Task 2, intentionally filled from `.superpowers/sdd/sourcing-decision.md` at execution — the controller sourcing gate is the documented mechanism (matching shipped families), not a plan gap. All code steps carry complete code.

**3. Type consistency.** `tslot_nut(length, foot_w, neck_w, foot_h, height, bore, chamfer=None)` is used identically in the generator, tests, registry key (`"tslot_nut"`), and the data `shape` block (keys `length, foot_w, neck_w, foot_h, height, bore, chamfer`). `_MIN_WALL_MM` imported (not redefined). Data `family` matches the registry key and the data test's expected value.
