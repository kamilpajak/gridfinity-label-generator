# Carriage / Cup-Head Bolt Coverage (screw gap family 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `carriage_bolt` generator and 5 square-neck carriage-bolt entries (base `din603` cup + base `din605` countersunk + 3 aliases) so the `coverage.py` screw gap drops from 51 to 46.

**Architecture:** A carriage bolt is a round shank with an anti-rotation square neck under the head; the head is a shallow cup dome (DIN 603 / ISO 8677) or a countersunk cone (DIN 605). One new generator (`catalog/models/carriage_bolt.py`, registered in `_registry`) composes existing idioms — `screw_common._screw_shank` (shank), the `square_nut` extruded-square-prism (neck), the `cap_nut` spherical cap (cup head) — plus one new countersunk cone revolve. A `head` parameter selects cup vs countersunk. One new dimension file (`catalog/dimensions/carriage_bolts.json`) holds the two bases and three aliases (ISO 8677 = DIN 603, so it aliases `din603`). Build renders two new SVGs; the app data files are not touched (generate-only).

**Tech Stack:** Python + build123d (run ONLY in the pinned container via `./catalog/run`), pytest, JSON dimension entries.

## Global Constraints

- Add a new generator `carriage_bolt` and register it; add a new `catalog/dimensions/carriage_bolts.json` with 2 bases (`din603` cup, `din605` countersunk) + 3 aliases. No change to any existing generator or to `build_part`.
- The generator composes existing idioms: `screw_common._screw_shank` (imported, not modified), the `square_nut` square-extrude technique, the `cap_nut` spherical-cap technique; the only new profile is the countersunk cone frustum.
- Representative size **M12**. Every committed envelope dimension confirmed by **≥2 named public tables** at the sourcing gate (controller, before Task 2). Representative fields (`length`, `tip_chamfer`, countersunk cone bottom radius) flagged in the source strings.
- Aliases never chain: `din603i`, `iso8677`, `iso8677p` all target the real non-alias base `din603`. `din605` is its own base. `hardwareType: "screw"` on every entry. `verified: true` only after cross-check.
- Source strings cite only public tables — **no** `reyher`, `stalmut`, or any private catalogue.
- **Generate-only:** do NOT modify `data/image-mappings.json` or `src/lib/data/standards-generated.ts`; do NOT run `catalog/integrate.py`. Existing SVGs stay byte-identical. Two new files render: `din603.svg`, `din605.svg`.
- All build123d / pytest runs happen in-container via `./catalog/run <cmd>` — never on the host.
- If `catalog/out/manifest.json` shows whitespace-only rebuild churn, normalise it with `pnpm exec prettier --write catalog/out/manifest.json` so the committed diff is only the new entries.

---

## Task 1: `carriage_bolt` generator + registration + unit tests

**Files:**

- Create: `catalog/models/carriage_bolt.py`
- Modify: `catalog/models/_registry.py` (import + `KNOWN_FAMILIES` entry)
- Test: `catalog/tests/test_carriage_bolt.py`

**Interfaces:**

- Consumes: `screw_common._screw_shank(d, length, tip_chamfer)` (existing helper — top face at z=0, body along −Z).
- Produces: `carriage_bolt(d, length, dk, k, head, square_w, square_depth, tip_chamfer=None) -> Part` — round shank `z ∈ [−length, 0]`, square neck `z ∈ [0, square_depth]`, head above `z=square_depth`; `head` is `"cup"` (spherical cap) or `"countersunk"` (cone frustum). Registered as family `"carriage_bolt"`; Task 2's data calls it via `build_part("carriage_bolt", shape)`.

- [ ] **Step 1: Write the failing generator unit tests**

Create `catalog/tests/test_carriage_bolt.py`:

```python
import pytest
from build123d import Box, Pos

from catalog.models.carriage_bolt import carriage_bolt

# Synthetic fixtures (NOT real standards): cup and countersunk M12-ish carriage bolts.
CUP = dict(d=12.0, length=60.0, dk=30.0, k=7.0, head="cup",
           square_w=13.0, square_depth=5.0, tip_chamfer=1.0)
CSK = {**CUP, "head": "countersunk", "dk": 26.0, "square_depth": 8.0}


def _solid_at(part, x, y, z, probe=0.3):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT) inside a
    BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_cup_envelope_extents():
    part = carriage_bolt(**CUP)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(CUP["dk"], 1)            # head is widest -> X extent = dk
    assert round(bb.min.Z, 1) == round(-CUP["length"], 1)        # shank free end at -length
    total = CUP["length"] + CUP["square_depth"] + CUP["k"]
    assert round(bb.size.Z, 1) == round(total, 1)               # shank + neck + head
    assert part.volume > 0


def test_single_solid_both_heads():
    assert len(carriage_bolt(**CUP).solids()) == 1
    assert len(carriage_bolt(**CSK).solids()) == 1


def test_square_neck_has_corners_beyond_a_round_neck():
    # The vertex-up square neck reaches its across-corners radius (square_w/sqrt2 ~ 9.19), beyond a
    # round neck of diameter square_w (radius 6.5). Probe the +X corner at mid-neck:
    part = carriage_bolt(**CUP)
    corner_r = CUP["square_w"] / (2 ** 0.5)     # ~9.19
    z_neck = CUP["square_depth"] / 2.0          # mid-neck
    assert _solid_at(part, corner_r - 0.6, 0.0, z_neck)          # solid out at the square corner
    assert not _solid_at(part, corner_r + 0.6, 0.0, z_neck)      # void beyond the corner


def test_cup_head_is_domed_over_the_axis():
    part = carriage_bolt(**CUP)
    apex_z = CUP["square_depth"] + CUP["k"]
    assert _solid_at(part, 0.0, 0.0, apex_z - 0.5)             # solid just below the dome apex
    assert not _solid_at(part, 0.0, 0.0, apex_z + 0.6)         # void above the apex


def test_countersunk_head_widens_to_the_top():
    # A countersunk cone is widest at its top face and narrows downward.
    part = carriage_bolt(**CSK)
    top_z = CSK["square_depth"] + CSK["k"]
    rim_r = CSK["dk"] / 2.0
    assert _solid_at(part, rim_r - 0.8, 0.0, top_z - 0.5)       # solid at the wide top rim
    assert not _solid_at(part, rim_r - 0.8, 0.0, CSK["square_depth"] + 0.5)  # narrowed lower down


def test_guard_bad_head():
    with pytest.raises(ValueError):
        carriage_bolt(**{**CUP, "head": "flat"})


def test_guard_dk_not_exceeding_square():
    with pytest.raises(ValueError):
        carriage_bolt(**{**CUP, "dk": 13.0})       # dk == square_w, must strictly exceed


def test_guard_non_positive_dims():
    with pytest.raises(ValueError):
        carriage_bolt(**{**CUP, "square_depth": 0.0})
    with pytest.raises(ValueError):
        carriage_bolt(**{**CUP, "dk": 0.0})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_carriage_bolt.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.carriage_bolt'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/carriage_bolt.py`:

```python
"""Carriage / cup-head bolt family generator (DIN 603 / ISO 8677 cup, DIN 605 countersunk).

A round shank with an anti-rotation SQUARE NECK (Vierkantansatz) directly under the head; the head is
either a shallow cup / mushroom dome (``head="cup"``, DIN 603 / ISO 8677) or a countersunk cone
(``head="countersunk"``, DIN 605). Envelope-only: no drawn thread, no drive recess (a carriage bolt
is held against rotation by its square neck, not a drive). Modelled axis-along-Z: the round shank
sits z in [-length, 0], the square neck z in [0, square_depth], the head above z=square_depth.

Composes established idioms — the shank is ``screw_common._screw_shank``, the square neck is the
``square_nut`` extruded-square-prism, the cup dome is the ``cap_nut`` spherical cap; the only new
profile is the countersunk cone frustum (a straight revolve). Head solids fuse to the neck via
face-contact ``add`` (the head base disc / cone base sits on the square-neck top plane), and the
neck fuses to the shank at z=0 — the same stacking seam ``screw_common`` documents. A net volume>0
and single-solid guard backstop the fusion.
"""
import math

from build123d import (
    BuildPart, BuildSketch, RegularPolygon, Polygon, Sphere, Box, Locations,
    Plane, Axis, Mode, extrude, revolve, add,
)

from catalog.models.screw_common import _screw_shank

_HEADS = ("cup", "countersunk")


def carriage_bolt(d: float, length: float, dk: float, k: float, head: str,
                  square_w: float, square_depth: float, tip_chamfer: float | None = None):
    """Carriage bolt: round shank Ø``d`` x ``length`` (optional 45-degree lead ``tip_chamfer``), an
    anti-rotation square neck (across-flats ``square_w``, axial ``square_depth``) under the head, and
    a head of diameter ``dk`` and height ``k``. ``head="cup"`` draws a shallow spherical-cap dome
    (DIN 603 / ISO 8677); ``head="countersunk"`` draws a cone frustum wide at the top face narrowing
    to the neck (DIN 605). No thread, no drive.
    """
    for name, val in (("d", d), ("length", length), ("dk", dk), ("k", k),
                      ("square_w", square_w), ("square_depth", square_depth)):
        if val <= 0:
            raise ValueError(f"carriage_bolt: need {name} > 0, got {val}")
    if head not in _HEADS:
        raise ValueError(f"carriage_bolt: head must be one of {_HEADS}, got {head!r}")
    if dk <= square_w:
        raise ValueError(
            f"carriage_bolt: head dk {dk} must exceed the square neck across-flats {square_w} "
            f"(the head must overhang the neck)")

    shank = _screw_shank(d, length, tip_chamfer)      # z in [-length, 0]; validates d/length/chamfer
    circumradius = square_w / math.sqrt(2.0)          # square across-corners / 2 (half-diagonal)
    neck_top = square_depth
    head_apex = square_depth + k

    with BuildPart() as bp:
        add(shank)
        with BuildSketch(Plane.XY):                   # square neck, vertex-up (corner on +X)
            RegularPolygon(radius=circumradius, side_count=4, rotation=0)
        extrude(amount=square_depth)                  # z in [0, square_depth], fuses to shank at z=0
        if head == "cup":
            # spherical cap: base circle radius dk/2 at z=neck_top, apex at z=head_apex (cap_nut idiom)
            r_base = dk / 2.0
            sphere_r = (r_base ** 2 + k ** 2) / (2.0 * k)
            z_c = neck_top + k - sphere_r             # sphere centre on Z (apex at head_apex)
            big = 4.0 * (sphere_r + head_apex)        # trim box, comfortably larger than the cap
            with BuildPart() as cap_bp:
                with Locations((0.0, 0.0, z_c)):
                    Sphere(radius=sphere_r)
                with Locations((0.0, 0.0, neck_top - big / 2.0)):
                    Box(big, big, big, mode=Mode.SUBTRACT)   # keep only z >= neck_top
            add(cap_bp.part)                          # union the dome onto the neck
        else:                                         # countersunk cone frustum: wide top, narrow neck
            r_bottom = square_w / 2.0                 # cone base ~ square inscribed circle (flagged)
            # (x=radius, z=axial): neck-top base -> out to bottom radius -> up-out to top rim -> axis
            profile = [(0.0, neck_top), (r_bottom, neck_top),
                       (dk / 2.0, head_apex), (0.0, head_apex)]
            with BuildSketch(Plane.XZ):
                Polygon(*profile, align=None)
            revolve(axis=Axis.Z, revolution_arc=360)  # union the cone onto the neck
    part = bp.part
    if part.volume <= 0:                              # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("carriage_bolt: produced an empty solid")
    if len(part.solids()) != 1:                       # head + neck + shank must fuse to one solid
        raise ValueError("carriage_bolt: produced more than one solid")
    return part
```

- [ ] **Step 4: Register the generator**

In `catalog/models/_registry.py`, add the import alongside the other screw generators (near the `hex_bolt` / `socket_screw` / `stud` imports):

```python
from catalog.models.carriage_bolt import carriage_bolt
```

and add the map entry inside `KNOWN_FAMILIES` (near the `"stud"` entry):

```python
    "carriage_bolt": carriage_bolt,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_carriage_bolt.py -q`
Expected: PASS (8 tests). If a spatial-probe assertion is slightly off versus the actual solid, you MAY adjust the probe coordinates/margins to correctly express the intent (square corner beyond a round neck; cup domed over the axis; countersunk widens to the top) — but do NOT weaken a test to merely pass, and do NOT change the generator geometry to match a wrong probe.

- [ ] **Step 6: Confirm no existing test regressed and the registry imports**

Run: `./catalog/run python -m pytest catalog/tests/test_families.py catalog/tests/test_screw_common.py -q`
Expected: PASS (the registry still imports cleanly with the new entry).

- [ ] **Step 7: Commit**

```bash
git add catalog/models/carriage_bolt.py catalog/models/_registry.py catalog/tests/test_carriage_bolt.py
git commit -m "feat(catalog): add carriage_bolt generator (cup/countersunk head, square neck)"
```

---

## Task 2: `carriage_bolts.json` data + data sweep tests + build the drawings

**Files:**

- Create: `catalog/dimensions/carriage_bolts.json`
- Create: `catalog/tests/test_carriage_bolts_data.py`
- Regenerate (build output, committed): `catalog/out/din603.svg`, `catalog/out/din605.svg`, `catalog/out/manifest.json`

**Interfaces:**

- Consumes: `build_part("carriage_bolt", shape)` and family `"carriage_bolt"` from Task 1; `validate_entry` from `catalog/schema.py`.
- Produces: 5 app-served ids covered (`din603`, `din603i`, `iso8677`, `iso8677p`, `din605`); the screw gap drops 51 → 46.

**Sourcing gate (controller, BEFORE dispatching this task):** confirm against ≥2 named public tables that DIN 603 / ISO 8677 M12 and DIN 605 M12 have the head diameter `dk`, head height `k`, square across-flats `square_w`, and square depth `square_depth` used below (fasteners.eu + Schrauben-Lexikon DIN 603; Vipa + Fuller/Krepcom DIN 605). The `source` strings below encode this; the controller hands the implementer the final verbatim shapes + strings (the values here are the sourcing-gate defaults).

- [ ] **Step 1: Write the failing data sweep tests**

Create `catalog/tests/test_carriage_bolts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/carriage_bolts.json")
_FORBIDDEN = ("reyher", "stalmut")

# Square-neck carriage bolts. Two drawn bases: din603 (cup/mushroom dome + square neck) covers the
# DIN 603 / ISO 8677 group; din605 (countersunk cone + square neck) is its own base. ISO 8677 is the
# ISO twin of DIN 603 so it aliases din603. The "...i"/"...p" ids are the app's image-variant keys.
_CARRIAGE_ALIASES = {
    "din603i": "din603", "iso8677": "din603", "iso8677p": "din603",
}


def test_every_carriage_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 5
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_carriage_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert entry["hardwareType"] == "screw"
        if "alias_of" in entry:
            continue
        assert entry["family"] == "carriage_bolt", f"{sid}: unexpected family {entry['family']}"


def test_din603_is_a_cup_square_base():
    entries = json.loads(DATA.read_text())
    assert "din603" in entries and "alias_of" not in entries["din603"]
    shape = entries["din603"]["shape"]
    assert shape["head"] == "cup"
    assert shape["dk"] > shape["square_w"]                 # head overhangs the neck
    assert shape["square_depth"] > 0                       # has a square neck
    build_part(entries["din603"]["family"], shape)


def test_din605_is_a_countersunk_square_base():
    entries = json.loads(DATA.read_text())
    assert "din605" in entries and "alias_of" not in entries["din605"]
    shape = entries["din605"]["shape"]
    assert shape["head"] == "countersunk"
    assert shape["dk"] > shape["square_w"]
    assert shape["square_depth"] > 0
    build_part(entries["din605"]["family"], shape)


def test_carriage_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _CARRIAGE_ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from carriage_bolts.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"


def test_every_carriage_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_carriage_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_carriage_bolts_data.py -q`
Expected: FAIL — `FileNotFoundError` / cannot read `catalog/dimensions/carriage_bolts.json`.

- [ ] **Step 3: Write the dimension file**

Create `catalog/dimensions/carriage_bolts.json` (the `source` strings are the sourcing-gate verbatim text; the controller confirms the numeric values before this task is dispatched):

```json
{
	"din603": {
		"family": "carriage_bolt",
		"shape": {
			"d": 12.0,
			"length": 60.0,
			"dk": 30.0,
			"k": 7.5,
			"head": "cup",
			"square_w": 13.0,
			"square_depth": 5.0,
			"tip_chamfer": 1.0
		},
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "603" }],
		"source": "DIN 603 / ISO 8677 cup (mushroom / round) head square-neck carriage bolt (Flachrundschraube mit Vierkantansatz), M12: domed head diameter dk=30.0 and head height k=7.5, with a square neck (Vierkantansatz) across-flats square_w=13.0 under the head, confirmed by fasteners.eu DIN 603 table + Schrauben-Lexikon DIN 603 + a manufacturer DIN 603 / ISO 8677 M12 datasheet. square_depth=5.0 (square-neck axial length) representative within the tabulated range. d=12.0 (M12 major); length=60.0 REPRESENTATIVE (carriage bolts ship in many lengths); tip_chamfer=1.0 REPRESENTATIVE 45-degree end break. Envelope only — no drawn thread, no drive (the square neck is the anti-rotation feature)."
	},
	"din603i": {
		"alias_of": "din603",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "603" }],
		"source": "DIN 603 M12, app image-variant key — identical cup-head square-neck envelope (dk=30, k=7.5, square 13); aliases the din603 base."
	},
	"iso8677": {
		"alias_of": "din603",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "8677" }],
		"source": "ISO 8677 mushroom (cup) head square-neck bolt, M12 — the ISO twin of DIN 603 (same envelope: dk=30, k=7.5, square 13), confirmed by the DIN 603 = ISO 8677 equivalence (fasteners.eu / Schrauben-Lexikon). Aliases the din603 base."
	},
	"iso8677p": {
		"alias_of": "din603",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "8677" }],
		"source": "ISO 8677 M12, app image-variant key — identical cup-head square-neck envelope; aliases the din603 base."
	},
	"din605": {
		"family": "carriage_bolt",
		"shape": {
			"d": 12.0,
			"length": 60.0,
			"dk": 26.0,
			"k": 7.0,
			"head": "countersunk",
			"square_w": 13.0,
			"square_depth": 8.0,
			"tip_chamfer": 1.0
		},
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "605" }],
		"source": "DIN 605 countersunk (flat conical) head square-neck carriage bolt with high square (Senkschraube mit Vierkantansatz), M12: countersunk head diameter dk=26.0 and cone height k=7.0 above a tall square neck across-flats square_w=13.0, confirmed by Vipa DIN 605 (120-degree countersunk with square neck) + Fuller / Krepcom DIN 605 M12 table. square_depth=8.0 (DIN 605 has a taller square than DIN 603) representative within the tabulated range; the cone bottom radius (~square_w/2) is a representative envelope join. d=12.0 (M12 major); length=60.0 REPRESENTATIVE; tip_chamfer=1.0 REPRESENTATIVE. Envelope only — no drawn thread, no drive."
	}
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_carriage_bolts_data.py -q`
Expected: PASS (7 tests).

- [ ] **Step 5: Build the catalog (renders `din603.svg` + `din605.svg`, updates the manifest)**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: the build discovers `carriage_bolts.json` automatically (it globs `catalog/dimensions/*.json`), renders `catalog/out/din603.svg` and `catalog/out/din605.svg`, and adds `din603`/`din603i`/`iso8677`/`iso8677p`/`din605` to `catalog/out/manifest.json`. No other SVG changes. `{"ok": N, "skipped": [], "failed": []}`.

- [ ] **Step 6: Verify generate-only invariants**

Run:

```bash
git status --porcelain data/image-mappings.json src/lib/data/standards-generated.ts
git status --porcelain catalog/out/*.svg
git diff -w --stat catalog/out/manifest.json
```

Expected: the two app files are unmodified (no output lines). Under `catalog/out/` only `din603.svg` and `din605.svg` are added (`??`); no existing `*.svg` is modified. The manifest diff (ignoring whitespace) is additive only (the 5 new entries).

If `manifest.json` shows whitespace-only reformat churn, normalise it:
`pnpm exec prettier --write catalog/out/manifest.json`

- [ ] **Step 7: Verify the coverage gap dropped 51 → 46**

Run:

```bash
./catalog/run python -c "from catalog.qa.coverage import check; g=check('catalog/out/manifest.json','data/image-mappings.json','screw'); print('SCREW GAP:', len(g)); assert not ({'din603','din603i','iso8677','iso8677p','din605'} & set(g)), 'carriage ids still uncovered'"
```

Expected: `SCREW GAP: 46` and no assertion error (none of the 5 carriage ids remain in the gap).

- [ ] **Step 8: Run the full catalog test suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS (all existing tests plus `test_carriage_bolt.py` and `test_carriage_bolts_data.py`).

- [ ] **Step 9: Commit**

```bash
git add catalog/dimensions/carriage_bolts.json catalog/tests/test_carriage_bolts_data.py catalog/out/din603.svg catalog/out/din605.svg catalog/out/manifest.json
git commit -m "feat(catalog): add carriage/cup-head bolt coverage (screw gap 51->46)"
```

---

## Self-Review (controller, after both tasks)

- **Spec coverage:** generator with cup + countersunk heads and a square neck (Task 1) + 5 data ids + build + coverage drop (Task 2) — every spec section maps to a task.
- **No placeholders:** all code, JSON, and commands are complete above.
- **Type consistency:** the generator signature `carriage_bolt(d, length, dk, k, head, square_w, square_depth, tip_chamfer=None)` matches the `din603`/`din605` shape keys exactly; the family string `"carriage_bolt"` matches between `_registry.py`, `carriage_bolts.json`, and both test files; `head` values `"cup"`/`"countersunk"` match the generator's `_HEADS`.
