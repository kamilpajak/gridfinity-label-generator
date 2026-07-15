# Slotted Round Nut Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slotted round nut family (DIN 981 bearing locknut + DIN 70852 groove nut) to the maintainer-only generative catalog — one generator, round body with N radial OD slots, at M12.

**Architecture:** New generator `catalog/models/slotted_round_nut.py` builds a `Cylinder` body, subtracts N full-height radial slots at the OD via `PolarLocations` + `Box` (castle_nut's pattern), then subtracts a through bore last. Registered in `_registry.py`; data in a new `slotted_round_nuts.json`. No render/preset change (rotationally symmetric → `NUT_PRESET`).

**Tech Stack:** Python 3, build123d, pytest — all run **in the pinned container** via `./catalog/run`. Never run these on the host.

## Global Constraints

- Representative size **M12** only. No user-facing toggle (epic END goal).
- Every committed dimension confirmed by **≥2 independent public tables**; any representative field documented as such in the `source` string, never fabricated. Shape features (slot count/size) verified against the legacy raster AND the tables, not one table.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- Import **only** `_MIN_WALL_MM` from `hex_nut` — do **not** touch `_chamfered_hex_solid`, `hex_nut.py`, or any existing generator. Existing SVGs must stay **byte-identical** (rebuild → `git status catalog/out` shows no change to existing files).
- **No render/preset change.** Rotationally symmetric slotted body; hardwareType `nut` → `NUT_PRESET`.
- **No keyway** on din981 (documented not-modelled). **`bore` is the fine-thread minor diameter** per standard (these are fine-pitch — not the 10.1 coarse constant), sourced.
- **Opt-in 0/0:** do **not** run `catalog/integrate.py`. `data/image-mappings.json` and `src/lib/data/standards-generated.ts` stay untouched — `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts` must return `0` for both.
- All builds/tests run in-container via `./catalog/run`. **Pre-warm the image once** before the first timed step. Build entrypoint: `./catalog/run python -m catalog.build_catalog`.

---

## Task 1: `slotted_round_nut` generator + tests + registry

**Files:**

- Create: `catalog/models/slotted_round_nut.py`
- Create: `catalog/tests/test_slotted_round_nut.py`
- Modify: `catalog/models/_registry.py` (add the import + one `KNOWN_FAMILIES` entry)

**Interfaces:**

- Consumes: `from catalog.models.hex_nut import _MIN_WALL_MM` (`= 0.1`).
- Produces: `slotted_round_nut(d, h, bore, n_slots, slot_w, slot_depth) -> Part` and the registry key `"slotted_round_nut"`.

The fixtures in the tests below are **synthetic** — geometrically valid numbers to exercise the code, **not** any real standard. Real standards come in Task 2.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_slotted_round_nut.py`:

```python
import math

import pytest
from build123d import Box, Pos

from catalog.models.slotted_round_nut import slotted_round_nut

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
CFG = dict(d=30.0, h=8.0, bore=13.0, n_slots=4, slot_w=4.0, slot_depth=3.0)


def _solid_at(part, x, y, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def _polar(radius, deg):
    return radius * math.cos(math.radians(deg)), radius * math.sin(math.radians(deg))


def test_envelope_z_and_od_present():
    part = slotted_round_nut(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["h"], 1)                 # full height on the axis
    assert CFG["d"] - 2 * CFG["slot_depth"] <= bb.size.X <= CFG["d"] + 0.05
    x, y = _polar(CFG["d"] / 2 - 0.3, 45.0)                          # a between-slot tower
    assert _solid_at(part, x, y, 0.0)                               # OD material present
    assert part.volume > 0


def test_slots_notch_the_od_at_each_position():
    part = slotted_round_nut(**CFG)
    r = CFG["d"] / 2 - CFG["slot_depth"] / 2          # 13.5: inside the slot depth band
    for k in range(CFG["n_slots"]):                   # slots at 0, 90, 180, 270 deg
        x, y = _polar(r, 360.0 / CFG["n_slots"] * k)
        assert not _solid_at(part, x, y, 0.0, probe=0.6)   # void: a slot is cut here
    x, y = _polar(r, 45.0)                             # between two slots
    assert _solid_at(part, x, y, 0.0, probe=0.6)       # solid: a tower


def test_slot_floor_leaves_a_wall_to_the_bore():
    part = slotted_round_nut(**CFG)
    # +X slot axis, radius 9: below the slot floor (r=12) and above the bore (r=6.5) -> solid
    assert _solid_at(part, 9.0, 0.0, 0.0)


def test_open_bore_through_the_nut():
    part = slotted_round_nut(**CFG)
    assert not _solid_at(part, 0.0, 0.0, 0.0, probe=0.6)   # bore void on the axis
    x, y = _polar(9.0, 45.0)                               # a between-slot wall
    assert _solid_at(part, x, y, 0.0, probe=0.6)
    solid = slotted_round_nut(**{**CFG, "bore": 0.4})
    assert part.volume < solid.volume                     # the bore removes real material


def test_builds_at_a_valid_config():
    assert slotted_round_nut(**CFG).volume > 0


def test_slotted_round_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "d": 0.0})              # non-positive dim
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "slot_w": 0.0})         # non-positive slot_w
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "bore": CFG["d"]})      # bore wall vs OD too thin
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "slot_depth": 9.0})     # slot floor reaches the bore wall
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "n_slots": 200})        # slots exceed the circumference
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "n_slots": 4.5})        # non-integer slot count
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "n_slots": 0})          # non-positive slot count
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_slotted_round_nut.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.slotted_round_nut'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/slotted_round_nut.py`:

```python
"""Slotted round nut family generator (DIN 981 bearing locknut, DIN 70852 groove nut).

A round cylindrical body with N full-height radial slots cut into the outer diameter (for a
hook or face spanner) and a through bore. The slots are the drive feature; the din981 bearing
locknut's internal keyway is NOT modelled (a minor internal feature that would break the
body's rotational symmetry). Only the metal envelope is drawn.
"""
import math

from build123d import BuildPart, Cylinder, Box, PolarLocations, Mode

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def slotted_round_nut(d: float, h: float, bore: float, n_slots: int,
                      slot_w: float, slot_depth: float):
    """Round nut of outer diameter ``d`` and height ``h`` with a through ``bore`` and
    ``n_slots`` full-height radial slots of width ``slot_w`` cut ``slot_depth`` into the OD.

    Body is a ``Cylinder`` centred on the origin; each slot is a ``Box`` subtracted at the OD
    via ``PolarLocations`` (first slot on +X, the view's up axis); the bore is subtracted last
    (like ``hex_nut``). Rotationally symmetric at the N slot positions — no preset change.
    """
    for name, val in (("d", d), ("h", h), ("bore", bore), ("slot_w", slot_w),
                      ("slot_depth", slot_depth)):
        if val <= 0:
            raise ValueError(f"slotted_round_nut: need {name} > 0, got {val}")
    if n_slots < 1 or int(n_slots) != n_slots:
        raise ValueError(f"slotted_round_nut: n_slots must be a positive integer, got {n_slots}")
    if bore >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"slotted_round_nut: bore {bore} leaves too thin a wall vs OD {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")
    if slot_depth >= d / 2.0 - bore / 2.0 - _MIN_WALL_MM:
        raise ValueError(
            f"slotted_round_nut: slot_depth {slot_depth} reaches the bore wall "
            f"(needs < d/2 - bore/2 - {_MIN_WALL_MM} = {d / 2.0 - bore / 2.0 - _MIN_WALL_MM:.3f} mm)")
    if n_slots * slot_w >= math.pi * d:
        raise ValueError(
            f"slotted_round_nut: {n_slots} slots of width {slot_w} exceed the circumference "
            f"{math.pi * d:.3f} (no towers would survive)")

    with BuildPart() as bp:
        Cylinder(radius=d / 2.0, height=h)                 # Align.CENTER: spans z in [-h/2, h/2]
        with PolarLocations(d / 2.0, int(n_slots), start_angle=0.0):
            Box(2.0 * slot_depth, slot_w, h * 2.0, mode=Mode.SUBTRACT)   # radial notch, full height
        Cylinder(radius=bore / 2.0, height=h * 3.0, mode=Mode.SUBTRACT)  # through bore, last
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("slotted_round_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Register the family**

In `catalog/models/_registry.py`, add the import next to the other nut imports (after `from catalog.models.knurled_nut import knurled_nut`):

```python
from catalog.models.knurled_nut import knurled_nut
from catalog.models.slotted_round_nut import slotted_round_nut
```

and add the entry to `KNOWN_FAMILIES` (after `"knurled_nut": knurled_nut,`):

```python
    "knurled_nut": knurled_nut,
    "slotted_round_nut": slotted_round_nut,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_slotted_round_nut.py -v`
Expected: PASS — all 6 tests green.

- [ ] **Step 6: Confirm no existing test regressed**

Run: `./catalog/run pytest catalog/tests -q`
Expected: the full catalog suite passes (existing families + the new slotted-round-nut tests).

- [ ] **Step 7: Commit**

```bash
git add catalog/models/slotted_round_nut.py catalog/tests/test_slotted_round_nut.py catalog/models/_registry.py
git commit -m "feat(catalog): add slotted round nut generator (DIN 981 / DIN 70852)"
```

---

## Task 2: `slotted_round_nuts.json` data + data test + in-container build

**Files:**

- Create: `catalog/dimensions/slotted_round_nuts.json`
- Create: `catalog/tests/test_slotted_round_nuts_data.py`

**Interfaces:**

- Consumes: `slotted_round_nut(...)` (Task 1) via `build_part(family, shape)`; `catalog.schema.validate_entry(sid, entry)`.
- Produces: rendered SVGs under `catalog/out/` for `din981` and `din70852` (no existing file changes).

**SOURCING GATE — do this before writing final numbers.** Every field is **normative and must be verified against ≥2 independent public tables** (fasteners.eu, Wegertseder, bearing-locknut catalogues, globalfastener) for M12:

- `din981` (rolling-bearing locknut, KM type — M12 is fine thread, e.g. M12×1): OD `d`, height `h`, `bore` = the fine-thread minor diameter, slot count `n_slots`, slot width `slot_w`, slot depth `slot_depth`.
- `din70852` (groove nut — M12): the same fields, with its own fine-thread `bore`.
  The controller will provide the verified numbers (as with the lock-nut and knurled-nut families). Do not invent or single-source any dimension. Verify the slot count against the legacy raster (per the DIN 467 boss lesson).

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_slotted_round_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/slotted_round_nuts.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_slotted_round_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_all_slotted_round_bases_are_slotted_round_nuts():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "slotted_round_nut", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_slotted_round_aliases_point_at_real_non_alias_bases():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" not in entry:
            continue
        target = entry["alias_of"]
        assert target in entries, f"{sid}: alias_of '{target}' unknown"
        assert "alias_of" not in entries[target], f"{sid}: alias points at another alias"


def test_every_slotted_round_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_slotted_round_nut_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the data test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_slotted_round_nuts_data.py -v`
Expected: FAIL — `FileNotFoundError` on `slotted_round_nuts.json`.

- [ ] **Step 3: Write the data file (after the sourcing gate)**

Create `catalog/dimensions/slotted_round_nuts.json` using the controller-verified M12 dimensions. Structure (replace the `0` placeholders with the verified values and `<table A>`/`<table B>` with the actual public tables):

```json
{
	"din981": {
		"family": "slotted_round_nut",
		"shape": { "d": 0.0, "h": 0.0, "bore": 0.0, "n_slots": 0, "slot_w": 0.0, "slot_depth": 0.0 },
		"hardwareType": "nut",
		"source": "DIN 981 rolling-bearing locknut (KM type, M12 fine thread): OD d, height h, bore (fine-thread minor dia), n_slots, slot width slot_w, slot depth slot_depth tabulated from <table A> + <table B>. The internal keyway is not modelled (minor internal feature). Smooth metal envelope drawn.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "981" }]
	},
	"din70852": {
		"family": "slotted_round_nut",
		"shape": { "d": 0.0, "h": 0.0, "bore": 0.0, "n_slots": 0, "slot_w": 0.0, "slot_depth": 0.0 },
		"hardwareType": "nut",
		"source": "DIN 70852 groove nut (M12): OD d, height h, bore (fine-thread minor dia), n_slots, slot width slot_w, slot depth slot_depth tabulated from <table A> + <table B>. Smooth metal envelope drawn.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "70852" }]
	}
}
```

Rules while filling in:

- Replace every `0`/`0.0` with the controller-verified M12 number; `n_slots` is a positive integer.
- Keep the two entries distinct (no aliases unless the verified envelopes are identical).
- `verified: true` only when the values were cross-checked against ≥2 tables and the slot count matches the raster.

- [ ] **Step 4: Run the data test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_slotted_round_nuts_data.py -v`
Expected: PASS — all five checks green.

- [ ] **Step 5: Build the catalog in-container and confirm the new drawings render**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: build succeeds; new `catalog/out/din981.svg` and `catalog/out/din70852.svg` appear.

- [ ] **Step 6: Verify existing SVGs are byte-identical and opt-in stays 0/0**

Run: `git status --short catalog/out`
Expected: only the two **new** slotted-round-nut SVGs listed; **no** modifications to existing SVGs.

Run: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts`
Expected: `0` for both files (opt-in invariant preserved — `integrate.py` not run).

- [ ] **Step 7: Run the full catalog suite once more**

Run: `./catalog/run pytest catalog/tests -q`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add catalog/dimensions/slotted_round_nuts.json catalog/tests/test_slotted_round_nuts_data.py catalog/out
git commit -m "feat(catalog): add M12 slotted round nut standards (DIN 981 / DIN 70852)"
```

---

## Self-review notes (for the executor)

- **Spec coverage:** Task 1 delivers the generator (body + N OD slots + bore), guards, and registration; Task 2 delivers the data (≥2-table sourcing gate, slot count verified vs raster), the data test, the in-container build, and the opt-in/byte-identical checks.
- **Signature consistency:** `slotted_round_nut(d, h, bore, n_slots, slot_w, slot_depth)` is identical in the generator, the tests, and the data `shape` keys.
- **Not covered by design (leave alone):** the din981 keyway (not modelled), other round-nut drive styles (din1816 face holes, din546 face slot — separate families), din1804 (no raster), integration (`integrate.py`), `image-mappings.json`, `standards-generated.ts`, any render/preset change.
