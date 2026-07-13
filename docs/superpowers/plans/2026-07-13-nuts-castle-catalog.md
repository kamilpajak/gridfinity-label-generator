# Castle / Slotted Nut Family Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a castle / slotted nut family (DIN 935 / 937 / 979 at M12, + ISO 7035 alias) to the maintainer-only generative catalog: a chamfered vertex-up hex body with a slotted cylindrical crown and a through bore.

**Architecture:** New `catalog/models/castle_nut.py` reuses `_chamfered_hex_solid(s, m, chamfer)` (unchanged) for the hex body, unions a cylindrical crown, subtracts `n` rectangular slots via `PolarLocations`, and subtracts a through bore like `hex_nut`. Registered as family `castle_nut`; data in `catalog/dimensions/castle_nuts.json`. No render/preset change (hardwareType `nut` → vertex-up `NUT_PRESET`).

**Tech Stack:** Python + build123d (in-container via `./catalog/run`), pytest, JSON dimension data.

## Global Constraints

- Size **M12**. DIN 935/979 ship **s = 18**; DIN 937 ships **s = 19** (its real width). No legacy SW19 variants of 935/979.
- Every committed dimension confirmed by **≥2 independent public tables** (already sourced — see spec).
- Source strings must **not** contain `reyher`, `stalmut`, or any private/internal catalogue.
- Reuse `_chamfered_hex_solid` **unchanged** — do not edit `catalog/models/hex_nut.py`. Existing hex_nut / flange_nut / cap_nut / washer SVGs must stay **byte-identical** (sha256) after the build.
- **No render/preset change.** Vertex-up orientation inherited from the helper.
- **opt-in invariant 0/0**: after build, `data/image-mappings.json` and `src/lib/data/standards-generated.ts` each keep 0 `.svg` references.
- All Python runs in-container: `./catalog/run pytest ...` and `./catalog/run python -m catalog.build_catalog`. Never run pytest/build on the host.

**Reference geometry:** hex body height = `m1` (un-slotted height). Crown = `Cylinder(radius=dk/2, height=m-m1)` seated at z=m1. Slots = `n_slots` boxes width `e`, radial length `dk/2 + margin`, height `(m-m1) + margin`, floor exactly at z=m1, placed by `PolarLocations(slot_len/2, n_slots, start_angle=0)`. Bore subtracted last through the whole part. `bore = 10.1` (M12 minor dia). All `dk/2 < s/2`, so the crown sits inside the hex top with a shoulder and the slots never reach the hex flats.

---

### Task 1: `castle_nut` generator

**Files:**

- Create: `catalog/models/castle_nut.py`
- Test: `catalog/tests/test_castle_nut.py`

**Interfaces:**

- Consumes: `catalog.models.hex_nut._chamfered_hex_solid(s, m, chamfer=None)` and `catalog.models.hex_nut._MIN_WALL_MM`.
- Produces: `castle_nut(s, m, bore, dk, m1, n_slots, e, chamfer=None) -> Part`. Registered under `"castle_nut"` in Task 2.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_castle_nut.py`:

```python
import math

import pytest

from catalog.models.castle_nut import castle_nut

S = 18.0                                   # M12 across-flats
M = 15.0                                   # total height (DIN 935-like fixture)
BORE = 10.1
DK = 16.0
M1 = 10.0                                  # un-slotted height / slot floor
N = 6
E = 3.5
CIRCUMRADIUS = S / math.sqrt(3.0)
ACROSS_CORNERS = 2.0 * CIRCUMRADIUS


def _radii(part):
    return [math.hypot(v.X, v.Y) for v in part.vertices()]


def test_castle_nut_is_vertex_up_with_correct_extents():
    part = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=E)
    bb = part.bounding_box()
    assert round(bb.size.X, 2) == round(ACROSS_CORNERS, 2)   # hex corners widest (vertex-up)
    assert round(bb.size.Y, 2) == round(S, 2)                # flats on Y
    assert round(bb.size.Z, 2) == round(M, 2)                # total height along Z
    assert part.volume > 0


def test_castle_nut_crown_is_narrower_than_the_hex():
    # Above the slot floor only the crown (dk) exists — no vertex reaches past dk/2.
    part = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=E)
    upper = [math.hypot(v.X, v.Y) for v in part.vertices() if v.Z > M1 + 0.1]
    assert upper, "expected vertices in the crown region"
    assert max(upper) <= DK / 2.0 + 0.01                     # crown, not the wider hex


def test_castle_nut_slots_remove_material():
    # More slots remove more crown material (same envelope otherwise).
    six = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=6, e=E)
    two = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=2, e=E)
    assert six.volume < two.volume


def test_castle_nut_has_an_open_bore():
    holed = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=E)
    solid = castle_nut(s=S, m=M, bore=0.001, dk=DK, m1=M1, n_slots=N, e=E)
    assert holed.volume < solid.volume                       # the bore removes material


def test_castle_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=S, dk=DK, m1=M1, n_slots=N, e=E)        # bore too big
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M, n_slots=N, e=E)      # m1 == m: no crown
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=S + 1.0, m1=M1, n_slots=N, e=E)  # crown wider than hex
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=DK, dk=DK, m1=M1, n_slots=N, e=E)       # bore >= crown
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=DK)    # slot as wide as crown
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=100, e=E)   # towers can't survive
    with pytest.raises(ValueError):
        castle_nut(s=0.0, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=E)   # zero across-flats (helper)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_castle_nut.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'catalog.models.castle_nut'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/castle_nut.py`:

```python
"""Castle / slotted nut family generator: chamfered hex + slotted cylindrical crown + bore."""
import math

from build123d import (
    BuildPart, Cylinder, Box, Locations, PolarLocations, Align, Mode, add,
)

from catalog.models.hex_nut import _chamfered_hex_solid, _MIN_WALL_MM

# First slot centred on +X (the vertex-up view's up axis); the rest at k*360/n_slots.
# Clocking is cosmetic here: every crown is narrower than the hex inscribed circle, so
# the slots stay inside the crown and never reach the hex flats/corners.
_SLOT_START_DEG = 0.0


def castle_nut(s: float, m: float, bore: float, dk: float, m1: float,
               n_slots: int, e: float, chamfer: float | None = None):
    """Castle / slotted nut: across-flats ``s``, total height ``m``, drawn bore ``bore``,
    cylindrical crown of diameter ``dk`` above the un-slotted height ``m1``, with
    ``n_slots`` rectangular slots of width ``e`` cut through the crown.

    A shared chamfered vertex-up hex body (``_chamfered_hex_solid``) of height ``m1`` with
    a ``dk`` crown unioned on top (z=m1..m); ``n_slots`` flat-bottom radial slots (floor
    at z=m1) subtracted from the crown; a through bore subtracted last like ``hex_nut``.
    The crown is fully slotted (no solid crown band below the slots) — a documented
    envelope simplification, since no table publishes the hex/crown transition height.
    """
    if bore <= 0:
        raise ValueError(f"castle_nut: need bore > 0, got {bore}")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"castle_nut: bore {bore} leaves too thin a wall (needs < across-flats {s} "
            f"by at least {_MIN_WALL_MM} mm)")
    if not (0 < m1 < m):
        raise ValueError(f"castle_nut: need 0 < m1 < m, got m1={m1}, m={m}")
    if dk > s:
        raise ValueError(
            f"castle_nut: crown dk {dk} exceeds across-flats {s} (crown must sit within the hex)")
    if dk <= bore:
        raise ValueError(
            f"castle_nut: crown dk {dk} must exceed bore {bore} (a crown wall must remain)")
    if not (0 < e < dk):
        raise ValueError(f"castle_nut: need 0 < slot width e < dk, got e={e}, dk={dk}")
    if n_slots < 1 or int(n_slots) != n_slots:
        raise ValueError(f"castle_nut: n_slots must be a positive integer, got {n_slots}")
    if n_slots * e >= math.pi * dk:
        raise ValueError(
            f"castle_nut: {n_slots} slots of width {e} exceed the crown circumference "
            f"(no castellation towers would survive)")

    hex_solid = _chamfered_hex_solid(s, m1, chamfer)   # validates s, m1, chamfer geometry
    crown_h = m - m1
    margin = 0.5 * (dk + m)                # generous build overshoot (not a physical value)
    slot_len = dk / 2.0 + margin           # from the axis out past the crown surface
    slot_hh = crown_h + margin             # overshoot the top only; floor stays at m1
    slot_zc = m1 + slot_hh / 2.0           # box centred so its bottom face is exactly at z=m1

    with BuildPart() as bp:
        add(hex_solid)
        with Locations((0.0, 0.0, m1)):    # crown base on the hex top face
            Cylinder(radius=dk / 2.0, height=crown_h,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))
        with Locations((0.0, 0.0, slot_zc)):
            with PolarLocations(slot_len / 2.0, int(n_slots), start_angle=_SLOT_START_DEG):
                Box(slot_len, e, slot_hh, mode=Mode.SUBTRACT)   # radial flat-bottom slot
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)   # through bore, last
    part = bp.part
    if part.volume <= 0:                   # net guard (matches hex_nut/flange_nut/cap_nut)
        raise ValueError("castle_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_castle_nut.py -q`
Expected: PASS (5 tests).

- [ ] **Step 5: Confirm the shared helper and existing generators are untouched**

Run: `git diff --stat catalog/models/hex_nut.py catalog/models/flange_nut.py catalog/models/cap_nut.py`
Expected: no output.
Run: `./catalog/run pytest catalog/tests/test_hex_nut.py catalog/tests/test_flange_nut.py catalog/tests/test_cap_nut.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add catalog/models/castle_nut.py catalog/tests/test_castle_nut.py
git commit -m "feat(catalog): castle/slotted nut generator (crown + radial slots + bore)"
```

---

### Task 2: Register the family and add the M12 data

**Files:**

- Modify: `catalog/models/_registry.py`
- Create: `catalog/dimensions/castle_nuts.json`
- Test: `catalog/tests/test_castle_nuts_data.py`

**Interfaces:**

- Consumes: `castle_nut` (Task 1); `catalog.schema.validate_entry`; `catalog.models._registry.build_part`.
- Produces: three distinct entries (`din935`, `din937`, `din979`) + one alias (`iso7035` → `din935`).

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_castle_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/castle_nuts.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_castle_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_all_castle_bases_are_castle_nuts():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "castle_nut", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_castle_aliases_point_at_real_non_alias_bases():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" not in entry:
            continue
        target = entry["alias_of"]
        assert target in entries, f"{sid}: alias_of '{target}' unknown"
        assert "alias_of" not in entries[target], f"{sid}: alias points at another alias"


def test_every_castle_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_castle_nut_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_castle_nuts_data.py -q`
Expected: FAIL — `castle_nuts.json` does not exist, and `build_part` rejects family `castle_nut` until registered.

- [ ] **Step 3: Register the family**

In `catalog/models/_registry.py`, add the import next to the other nut imports:

```python
from catalog.models.castle_nut import castle_nut
```

and add to `KNOWN_FAMILIES` (after the `"cap_nut": cap_nut,` entry):

```python
    "castle_nut": castle_nut,
```

- [ ] **Step 4: Add the data file**

Create `catalog/dimensions/castle_nuts.json`:

```json
{
	"din935": {
		"family": "castle_nut",
		"shape": { "s": 18.0, "m": 15.0, "bore": 10.1, "dk": 16.0, "m1": 10.0, "n_slots": 6, "e": 3.5 },
		"hardwareType": "nut",
		"source": "DIN 935 hexagon slotted / castle nut (M12): s=18 (current ISO 272 / SW18; legacy SW19 not shipped), m=15, un-slotted height w/m1=10, crown dk=16, 6 slots, slot width n/e=3.5 (min; max 3.8), bore=10.1 (M12 minor dia). Crown modelled fully slotted (no solid crown band below the slots; hex/crown transition not tabulated). Confirmed vs Fuller Fasteners + Aspen Fasteners + Trojan SF + Fabory DIN 935 tables.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "935" }]
	},
	"din937": {
		"family": "castle_nut",
		"shape": { "s": 19.0, "m": 10.0, "bore": 10.1, "dk": 17.0, "m1": 6.0, "n_slots": 6, "e": 3.5 },
		"hardwareType": "nut",
		"source": "DIN 937 hexagon thin (low) slotted / castle nut (M12): s=19 (SW19, the withdrawn legacy standard's actual across-flats), m=10, m1=6.0 (w slot-floor height, not the 5.3 m' proof-load minimum), crown dk=17, 6 slots, slot width 3.5, bore=10.1. Crown modelled fully slotted. Confirmed vs fasteners.eu + Fuller Fasteners + fasenco + Aspen Fasteners DIN 937 tables.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "937" }]
	},
	"din979": {
		"family": "castle_nut",
		"shape": { "s": 18.0, "m": 10.0, "bore": 10.1, "dk": 16.0, "m1": 5.0, "n_slots": 6, "e": 3.5 },
		"hardwareType": "nut",
		"source": "DIN 979 hexagon thin slotted / castle nut (M12, current successor to DIN 937): s=18 (ISO 272 / SW18), m=10, m1=5, crown dk=16 (Aspen's 17 is a mixed-edition outlier), 6 slots, slot width 3.5, bore=10.1. Crown modelled fully slotted. Confirmed vs Fuller Fasteners + Trojan SF DIN 979 tables.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "979" }]
	},
	"iso7035": {
		"alias_of": "din935",
		"hardwareType": "nut",
		"source": "ISO 7035 hexagon slotted nut, style 1 (M12): the ISO counterpart of DIN 935 with an identical M12 envelope (s=18, m=15, w=10, dk=16, 6 slots, 3.5), so it aliases the DIN 935 drawing. Confirmed vs fasteners.eu ISO 7035 + TorqBolt ISO 7035 + Bolting Specialist + combined DIN 935/ISO 7035 product listings.",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "7035" }]
	}
}
```

- [ ] **Step 5: Run the data test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_castle_nuts_data.py -q`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the families registry test**

Run: `./catalog/run pytest catalog/tests/test_families.py -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/models/_registry.py catalog/dimensions/castle_nuts.json catalog/tests/test_castle_nuts_data.py
git commit -m "feat(catalog): register castle_nut family and add DIN 935/937/979 (+ISO 7035) M12 data"
```

---

### Task 3: Build the catalog and verify invariants

**Files:**

- Modify (generated, committed): `catalog/out/*.svg`, `catalog/out/manifest.json`

**Interfaces:**

- Consumes: the registered family + data. `catalog/build_catalog.py` is unchanged (auto-globs `dimensions/*.json`, renders via `preset_for_hardware_type`).

- [ ] **Step 1: Record the pre-build state of existing drawings**

Run: `sha256sum catalog/out/*.svg > /tmp/castle_pre_shas.txt && wc -l < /tmp/castle_pre_shas.txt`
Expected: writes the current SVG shas and prints the count.

- [ ] **Step 2: Run the full catalog test suite in-container**

Run: `./catalog/run pytest catalog/tests -q`
Expected: PASS (all existing + the new `test_castle_nut.py` and `test_castle_nuts_data.py`).

- [ ] **Step 3: Build the catalog**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: `ok` for every entry, `0 failed`; writes 3 new drawings `catalog/out/din935.svg`, `din937.svg`, `din979.svg` (iso7035 aliases din935 → no new file) and updates `manifest.json`.

- [ ] **Step 4: Verify no existing drawing changed**

Run: `sha256sum -c /tmp/castle_pre_shas.txt 2>&1 | grep -v ': OK$' || echo "ALL EXISTING SVGs OK"`
Expected: every previously existing SVG reports OK (helper reused unchanged). Only the 3 new SVGs are additions.

- [ ] **Step 5: Verify the three new drawings exist and iso7035 is aliased**

Run: `ls -1 catalog/out/din935.svg catalog/out/din937.svg catalog/out/din979.svg && test ! -f catalog/out/iso7035.svg && echo "iso7035 aliased (no own file)"`
Expected: three files listed, and iso7035 has no own SVG (it aliases din935 in the manifest).

- [ ] **Step 6: Verify the opt-in invariant (0/0)**

Run: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts`
Expected: both report `0`.

- [ ] **Step 7: Normalise the manifest formatting and commit the build output**

```bash
npx prettier --write catalog/out/manifest.json
git add catalog/out
git commit -m "build(catalog): render DIN 935/937/979 castle nut drawings"
```

Expected: the commit contains only the 3 new SVGs and the manifest update (verify with `git show --stat HEAD` — no existing SVG appears).

---

## Self-Review

**Spec coverage:** Generator with crown+slots+bore and all 8 guards (Task 1), registration + 3 distinct + 1 alias data (Task 2), build + byte-identical existing SVGs + opt-in 0/0 (Task 3). ✅

**Placeholder scan:** No TBD/TODO; every code and command step is concrete. ✅

**Type consistency:** `castle_nut(s, m, bore, dk, m1, n_slots, e, chamfer=None)` used identically in generator, tests, and data `shape` keys. `_chamfered_hex_solid(s, m1, chamfer)` and `_MIN_WALL_MM` match the existing `hex_nut` exports. ✅
