# Cylindrical Collar Nut Family Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cylindrical collar nut family (DIN 6331 at M12) to the maintainer-only generative catalog: a chamfered vertex-up hex body with a plain cylindrical bearing collar and a through bore.

**Architecture:** New `catalog/models/collar_nut.py` reuses `_chamfered_hex_solid(s, m, chamfer)` (unchanged) for the full-height hex body, unions a plain `Cylinder` collar on the bearing face, and subtracts a through bore like `hex_nut`. Registered as family `collar_nut`; data in `catalog/dimensions/collar_nuts.json`. No render/preset change (hardwareType `nut` → vertex-up `NUT_PRESET`).

**Tech Stack:** Python + build123d (in-container via `./catalog/run`), pytest, JSON dimension data.

## Global Constraints

- Size **M12**, ship **s = 18**.
- Every committed dimension confirmed by **≥2 independent public tables** (already sourced — 5 tables — see spec).
- Source strings must **not** contain `reyher`, `stalmut`, or any private/internal catalogue.
- Reuse `_chamfered_hex_solid` **unchanged** — do not edit `catalog/models/hex_nut.py`. Existing hex_nut / flange_nut / cap_nut / castle_nut / washer SVGs must stay **byte-identical** (sha256).
- **No render/preset change.** Vertex-up orientation inherited from the helper.
- **opt-in invariant 0/0**: after build, `data/image-mappings.json` and `src/lib/data/standards-generated.ts` each keep 0 `.svg` references.
- All Python runs in-container: `./catalog/run pytest ...` and `./catalog/run python -m catalog.build_catalog`. Never on the host.

**Reference geometry:** `m` INCLUDES the collar (DIN 6331 1.5d height is the full envelope). Hex built full height m. Collar = `Cylinder(radius=dc/2, height=collar_height, align Z=MIN)` at z=0 (bottom/bearing face). `dc > 2*(s/sqrt(3))` (across-corners), so the collar is a visible ring wider than the hex and swallows the bottom chamfer → flat bearing face. Bore subtracted last. `bore = 10.1` (M12 minor dia).

---

### Task 1: `collar_nut` generator

**Files:**

- Create: `catalog/models/collar_nut.py`
- Test: `catalog/tests/test_collar_nut.py`

**Interfaces:**

- Consumes: `catalog.models.hex_nut._chamfered_hex_solid(s, m, chamfer=None)` and `catalog.models.hex_nut._MIN_WALL_MM`.
- Produces: `collar_nut(s, m, bore, dc, collar_height, chamfer=None) -> Part`. Registered under `"collar_nut"` in Task 2.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_collar_nut.py`:

```python
import math

import pytest

from catalog.models.collar_nut import collar_nut

S = 18.0                                   # M12 across-flats
M = 18.0                                   # total height (incl. collar), DIN 6331 fixture
BORE = 10.1
DC = 25.0                                  # collar diameter
COLLAR_H = 4.0
CIRCUMRADIUS = S / math.sqrt(3.0)          # hex corner radius


def _radii(part):
    return [math.hypot(v.X, v.Y) for v in part.vertices()]


def test_collar_nut_collar_is_the_widest_feature():
    part = collar_nut(s=S, m=M, bore=BORE, dc=DC, collar_height=COLLAR_H)
    bb = part.bounding_box()
    # The circular collar is wider than the hex corners: both plan extents equal dc.
    assert round(bb.size.X, 1) == round(DC, 1)
    assert round(bb.size.Y, 1) == round(DC, 1)
    assert max(_radii(part)) > CIRCUMRADIUS + 0.5          # reaches past the hex corners
    assert round(bb.size.Z, 1) == round(M, 1)              # height along Z
    assert part.volume > 0


def test_collar_nut_collar_sits_at_the_bearing_face():
    # The widest ring of vertices is near the bearing face (z ~ 0), not the top.
    part = collar_nut(s=S, m=M, bore=BORE, dc=DC, collar_height=COLLAR_H)
    rim = [v for v in part.vertices() if math.hypot(v.X, v.Y) > CIRCUMRADIUS + 0.5]
    assert rim, "expected collar-rim vertices beyond the hex corners"
    assert min(v.Z for v in rim) < COLLAR_H + 0.5          # rim lives at the bottom


def test_collar_nut_top_is_a_chamfered_hex():
    # Near the top face the section is the hex (bounded by the corner circle), not the collar.
    part = collar_nut(s=S, m=M, bore=BORE, dc=DC, collar_height=COLLAR_H)
    top = [math.hypot(v.X, v.Y) for v in part.vertices() if v.Z > M - 0.2]
    assert top and max(top) <= CIRCUMRADIUS + 0.01         # top is within the hex, not the collar


def test_collar_nut_has_an_open_bore():
    holed = collar_nut(s=S, m=M, bore=BORE, dc=DC, collar_height=COLLAR_H)
    solid = collar_nut(s=S, m=M, bore=0.001, dc=DC, collar_height=COLLAR_H)
    assert holed.volume < solid.volume                     # the bore removes material


def test_collar_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        collar_nut(s=S, m=M, bore=0.0, dc=DC, collar_height=COLLAR_H)       # non-positive bore
    with pytest.raises(ValueError):
        collar_nut(s=S, m=M, bore=S, dc=DC, collar_height=COLLAR_H)         # bore too big
    with pytest.raises(ValueError):
        collar_nut(s=S, m=M, bore=BORE, dc=DC, collar_height=M)             # collar eats whole height
    with pytest.raises(ValueError):
        collar_nut(s=S, m=M, bore=BORE, dc=CIRCUMRADIUS, collar_height=COLLAR_H)  # collar not past corners
    with pytest.raises(ValueError):
        collar_nut(s=0.0, m=M, bore=BORE, dc=DC, collar_height=COLLAR_H)    # zero across-flats (helper)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_collar_nut.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'catalog.models.collar_nut'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/collar_nut.py`:

```python
"""Collar nut family generator: chamfered hex body with a plain cylindrical bearing collar and a bore."""
import math

from build123d import BuildPart, Cylinder, Align, Mode, add

from catalog.models.hex_nut import _chamfered_hex_solid, _MIN_WALL_MM


def collar_nut(s: float, m: float, bore: float, dc: float, collar_height: float,
               chamfer: float | None = None):
    """Hex nut with a plain cylindrical bearing collar: across-flats ``s``, total height
    ``m`` (collar included), drawn bore ``bore``, collar of diameter ``dc`` and height
    ``collar_height`` on the bearing face.

    A shared chamfered vertex-up hex body (``_chamfered_hex_solid``) of the full height
    ``m`` with a plain straight-walled cylinder unioned over the bottom ``collar_height``
    and a through bore subtracted last (like ``hex_nut``). Because ``dc`` exceeds the hex
    across-corners, the collar is a visible bearing ring that swallows the hex's bottom
    chamfer, leaving a flat bearing face; the top (free-face) chamfer is untouched.
    """
    if bore <= 0:
        raise ValueError(f"collar_nut: need bore > 0, got {bore}")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"collar_nut: bore {bore} leaves too thin a wall (needs < across-flats {s} "
            f"by at least {_MIN_WALL_MM} mm)")
    if not (0 < collar_height < m):
        raise ValueError(
            f"collar_nut: need 0 < collar_height < m, got collar_height={collar_height}, m={m}")
    circumradius = s / math.sqrt(3.0)
    if dc <= 2.0 * circumradius:
        raise ValueError(
            f"collar_nut: collar dc {dc} must exceed the hex across-corners "
            f"{2.0 * circumradius:.3f} (else there is no visible collar)")

    hex_solid = _chamfered_hex_solid(s, m, chamfer)   # full height m; validates s, m, chamfer
    with BuildPart() as bp:
        add(hex_solid)
        Cylinder(radius=dc / 2.0, height=collar_height,
                 align=(Align.CENTER, Align.CENTER, Align.MIN))   # collar on the bearing face z=0
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)   # through bore, last
    part = bp.part
    if part.volume <= 0:                              # net guard (matches hex_nut/flange_nut)
        raise ValueError("collar_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_collar_nut.py -q`
Expected: PASS (5 tests).

- [ ] **Step 5: Confirm the shared helper and existing generators are untouched**

Run: `git diff --stat catalog/models/hex_nut.py catalog/models/flange_nut.py catalog/models/cap_nut.py catalog/models/castle_nut.py`
Expected: no output.
Run: `./catalog/run pytest catalog/tests/test_hex_nut.py catalog/tests/test_flange_nut.py catalog/tests/test_cap_nut.py catalog/tests/test_castle_nut.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add catalog/models/collar_nut.py catalog/tests/test_collar_nut.py
git commit -m "feat(catalog): cylindrical collar nut generator (hex + collar + bore)"
```

---

### Task 2: Register the family and add the M12 data

**Files:**

- Modify: `catalog/models/_registry.py`
- Create: `catalog/dimensions/collar_nuts.json`
- Test: `catalog/tests/test_collar_nuts_data.py`

**Interfaces:**

- Consumes: `collar_nut` (Task 1); `catalog.schema.validate_entry`; `catalog.models._registry.build_part`.
- Produces: one distinct entry (`din6331`).

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_collar_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/collar_nuts.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_collar_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_all_collar_bases_are_collar_nuts():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "collar_nut", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_every_collar_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_collar_nut_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_collar_nuts_data.py -q`
Expected: FAIL — `collar_nuts.json` does not exist, and `build_part` rejects family `collar_nut` until registered.

- [ ] **Step 3: Register the family**

In `catalog/models/_registry.py`, add the import next to the other nut imports:

```python
from catalog.models.collar_nut import collar_nut
```

and add to `KNOWN_FAMILIES` (after the `"castle_nut": castle_nut,` entry):

```python
    "collar_nut": collar_nut,
```

- [ ] **Step 4: Add the data file**

Create `catalog/dimensions/collar_nuts.json`:

```json
{
	"din6331": {
		"family": "collar_nut",
		"shape": { "s": 18.0, "m": 18.0, "bore": 10.1, "dc": 25.0, "collar_height": 4.0 },
		"hardwareType": "nut",
		"source": "DIN 6331 hexagon nut with collar, height 1.5d (M12): s=18 (current ISO 272 / SW18), m=18 (=1.5x12, total height incl. collar), collar diameter d1/dc=25, collar height a=4, bore=10.1 (M12 minor dia). Collar dc=25 exceeds the hex across-corners (20.78), a visible bearing ring; plain cylindrical (no edge chamfer). Confirmed vs fasteners.eu + Aspen Fasteners + Hommel-Hercules + NF GAB + Wurth DIN 6331 tables.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "6331" }]
	}
}
```

- [ ] **Step 5: Run the data test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_collar_nuts_data.py -q`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the families registry test**

Run: `./catalog/run pytest catalog/tests/test_families.py -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/models/_registry.py catalog/dimensions/collar_nuts.json catalog/tests/test_collar_nuts_data.py
git commit -m "feat(catalog): register collar_nut family and add DIN 6331 M12 data"
```

---

### Task 3: Build the catalog and verify invariants

**Files:**

- Modify (generated, committed): `catalog/out/din6331.svg`, `catalog/out/manifest.json`

**Interfaces:**

- Consumes: the registered family + data. `catalog/build_catalog.py` is unchanged.

- [ ] **Step 1: Record the pre-build state of existing drawings**

Run: `sha256sum catalog/out/*.svg > /tmp/collar_pre_shas.txt && wc -l < /tmp/collar_pre_shas.txt`
Expected: writes the current SVG shas and prints the count.

- [ ] **Step 2: Run the full catalog test suite in-container**

Run: `./catalog/run pytest catalog/tests -q`
Expected: PASS (all existing + the new `test_collar_nut.py` and `test_collar_nuts_data.py`).

- [ ] **Step 3: Build the catalog**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: `ok` for every entry, `0 failed`; writes 1 new drawing `catalog/out/din6331.svg` and updates `manifest.json`.

- [ ] **Step 4: Verify no existing drawing changed**

Run: `sha256sum -c /tmp/collar_pre_shas.txt 2>&1 | grep -v ': OK$' || echo "ALL EXISTING SVGs OK"`
Expected: every previously existing SVG reports OK. Only din6331.svg is an addition.

- [ ] **Step 5: Verify the new drawing exists**

Run: `ls -1 catalog/out/din6331.svg`
Expected: listed.

- [ ] **Step 6: Verify the opt-in invariant (0/0)**

Run: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts`
Expected: both report `0`.

- [ ] **Step 7: Normalise the manifest formatting and commit the build output**

```bash
npx prettier --write catalog/out/manifest.json
git add catalog/out
git commit -m "build(catalog): render DIN 6331 collar nut drawing"
```

Expected: the commit contains only din6331.svg and the manifest update (verify with `git show --stat HEAD`).

---

## Self-Review

**Spec coverage:** Generator with collar+bore and all guards (Task 1), registration + data (Task 2), build + byte-identical existing SVGs + opt-in 0/0 (Task 3). ✅

**Placeholder scan:** No TBD/TODO; every code and command step is concrete. ✅

**Type consistency:** `collar_nut(s, m, bore, dc, collar_height, chamfer=None)` used identically in generator, tests, and data `shape` keys. `_chamfered_hex_solid(s, m, chamfer)` and `_MIN_WALL_MM` match the existing `hex_nut` exports. ✅
