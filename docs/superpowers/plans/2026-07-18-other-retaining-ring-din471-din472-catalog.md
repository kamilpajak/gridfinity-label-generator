# DIN 471 / DIN 472 Retaining-Ring Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single `retaining_ring` generator (DIN 471 external / DIN 472 internal circlip — a flat tapered split C-ring with two eared lugs and plier holes) plus its two representative nominal-size-12 data entries.

**Architecture:** One new generator builds the tapered split ring as a closed 2D `Polygon` in the XY plane (a growing edge sampled around the material arc + the constant-radius seated edge back), extrudes it thin along Z, fuses a round eared lug at each free end, and subtracts the two plier holes last. External vs internal is a pure radial mirror selected by an `internal` flag (a sign on the direction the section and lugs grow from the seated edge). Imports only `_MIN_WALL_MM` from `hex_nut`. Data in a new `retaining_rings.json`.

**Tech Stack:** Python + build123d (in-container via `./catalog/run`), pytest, JSON data files.

## Global Constraints

- Representative size **nominal 12** (12 mm shaft for `din471`, 12 mm bore for `din472`). Ships exactly `din471` + `din472`.
- Every committed dimension confirmed by **≥2 independent public tables**; representative fields (ear projection `lug_project`, the free-state `gap`, and the **taper direction** — which of `w_lug`/`w_back` is wider) documented as such, never fabricated. Shape (tapered split C + eared lugs + plier holes + thin flat section) verified against the raster + tables.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- A **new** base shape — do **not** touch any existing generator. Existing SVGs stay **byte-identical**.
- **No render/preset change.** Flat part in XY → `hardwareType: "ring"` → `preset_for_hardware_type("ring")` returns `DEFAULT_AXIS_Z` (the same default preset washers use; only `"nut"` gets `NUT_PRESET`).
- **opt-in 0/0** after build: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts` → `0` for both. Do **not** run `catalog/integrate.py` or `pnpm standards:build`.
- In-container only via `./catalog/run`. Build entrypoint: `python -m catalog.build_catalog`.
- Generator geometry tests use **synthetic** fixtures (not the real standard). Real dimensions come from the controller sourcing pass at the data task.

---

### Task 1: `retaining_ring` generator (DIN 471 / DIN 472)

**Files:**

- Create: `catalog/models/retaining_ring.py`
- Create: `catalog/tests/test_retaining_ring.py`
- Modify: `catalog/models/_registry.py` (add import + `KNOWN_FAMILIES` entry)

**Interfaces:**

- Consumes: `from catalog.models.hex_nut import _MIN_WALL_MM` (a float, the shared minimum wall thickness, currently `0.1`).
- Produces: `retaining_ring(d_seat, thickness, w_lug, w_back, gap_deg, lug_hole_d, lug_project, internal=False) -> build123d Part`. Registered as family key `"retaining_ring"`.

- [ ] **Step 1: Write the failing generator test**

Create `catalog/tests/test_retaining_ring.py`:

```python
import math

import pytest
from build123d import Box, Pos

from catalog.models.retaining_ring import retaining_ring

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
# Seated circle d=12 (r_seat=6). Section tapers from w_back=2 at the back (theta=180) to
# w_lug=3 at the free ends. 30 deg gap centred on +X. Round lug ear of diameter
# w_lug+lug_project = 4.5, plier hole d=2. Flat, 1.2 thick. External by default.
CFG = dict(d_seat=12.0, thickness=1.2, w_lug=3.0, w_back=2.0, gap_deg=30.0,
           lug_hole_d=2.0, lug_project=1.5, internal=False)
R_SEAT = CFG["d_seat"] / 2.0   # 6.0


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def _xy(r, deg):
    a = math.radians(deg)
    return (r * math.cos(a), r * math.sin(a))


def test_flat_thin_part_and_nonempty():
    part = retaining_ring(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["thickness"], 1)   # flat: Z extent == thickness
    assert part.volume > 0


def test_section_tapers_between_lugs_and_back():
    # CFG has w_lug (3) > w_back (2). Probe a radius (r_seat + 2.5) that the body reaches at a
    # wide mid-arc angle but not at the narrow back — discriminates a tapered ring from a
    # constant-width one. theta=60 is far from the lug ears (at +/-15).
    part = retaining_ring(**CFG)
    assert _solid_at(part, *_xy(R_SEAT + 2.5, 60), 0.0, probe=0.4)        # wide section: solid
    assert not _solid_at(part, *_xy(R_SEAT + 2.5, 180), 0.0, probe=0.4)  # narrow back: void


def test_gap_is_void():
    # The gap is centred on +X (theta=0); no material sits on the seated circle there.
    part = retaining_ring(**CFG)
    assert not _solid_at(part, *_xy(R_SEAT, 0), 0.0, probe=0.4)


def test_lug_ear_present_with_open_hole():
    part = retaining_ring(**CFG)
    r_ear = (CFG["w_lug"] + CFG["lug_project"]) / 2.0     # 2.25
    ear_c = R_SEAT + r_ear                                # ear-disc centre radius 8.25, at theta=15
    ear_outer = R_SEAT + CFG["w_lug"] + CFG["lug_project"]  # 10.5
    assert _solid_at(part, *_xy(ear_outer - 0.3, 15), 0.0, probe=0.4)    # ear material present
    # Plier hole (d=2) at the ear centre is open right through the thickness.
    assert not _solid_at(part, *_xy(ear_c, 15), 0.0, probe=0.4)
    assert not _solid_at(part, *_xy(ear_c, 15), CFG["thickness"] / 2 - 0.1, probe=0.3)


def test_external_vs_internal_flip():
    # External: material grows OUTWARD from the seated edge; nothing inside it.
    ext = retaining_ring(**CFG)
    assert _solid_at(ext, *_xy(R_SEAT + 1.0, 180), 0.0, probe=0.4)       # outside seat: solid
    assert not _solid_at(ext, *_xy(R_SEAT - 1.0, 180), 0.0, probe=0.4)  # inside seat: void
    # Internal: mirror — material grows INWARD; nothing outside the seated edge.
    intl = retaining_ring(**{**CFG, "internal": True})
    assert _solid_at(intl, *_xy(R_SEAT - 1.0, 180), 0.0, probe=0.4)      # inside seat: solid
    assert not _solid_at(intl, *_xy(R_SEAT + 1.0, 180), 0.0, probe=0.4) # outside seat: void


def test_builds_at_valid_configs():
    assert retaining_ring(**CFG).volume > 0                              # external
    assert retaining_ring(**{**CFG, "internal": True}).volume > 0        # internal


def test_retaining_ring_guards_bad_geometry():
    with pytest.raises(ValueError):
        retaining_ring(**{**CFG, "d_seat": 0.0})                         # non-positive dim
    with pytest.raises(ValueError):
        retaining_ring(**{**CFG, "gap_deg": 0.0})                        # gap not > 0
    with pytest.raises(ValueError):
        retaining_ring(**{**CFG, "gap_deg": 180.0})                      # gap not < 180
    with pytest.raises(ValueError):
        # Internal ring growing inward past the axis (w_lug+lug_project = 7.5 > r_seat).
        retaining_ring(**{**CFG, "internal": True, "w_lug": 6.0})
    with pytest.raises(ValueError):
        # Plier hole as wide as the whole ear leaves no wall.
        retaining_ring(**{**CFG, "lug_hole_d": CFG["w_lug"] + CFG["lug_project"]})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_retaining_ring.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.retaining_ring'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/retaining_ring.py`:

```python
"""Retaining-ring family generator (DIN 471 external / DIN 472 internal circlips).

A flat stamped split ring: a C with an angular gap whose radial section tapers between the
narrower back (opposite the gap) and the wider free ends, each free end carrying an enlarged
round eared lug with a plier hole. The ring lies in the XY plane and is a thin extrusion along
Z, so under the default camera the face view shows the tapered C + lugs + holes and the edge
view is a thin flat rectangle. External (DIN 471) grows the section outward from the seated
inner edge; internal (DIN 472) grows it inward from the seated outer edge — a pure radial
mirror selected by ``internal``. Only the metal envelope is drawn (no groove, no thread).
"""
import math

from build123d import BuildPart, BuildSketch, Polygon, Cylinder, Locations, Mode, extrude

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness

_ARC_SAMPLES = 90   # points per edge; dense enough for a smooth ring at label render scale


def retaining_ring(d_seat: float, thickness: float, w_lug: float, w_back: float,
                   gap_deg: float, lug_hole_d: float, lug_project: float,
                   internal: bool = False):
    """Retaining ring (circlip). ``d_seat`` is the constant-radius seated edge (the
    groove-contact circle): the ring's INNER edge for an external ring, its OUTER edge for an
    internal one. The radial section width tapers from ``w_back`` at the back (180 deg from the
    gap) to ``w_lug`` at the two free ends; ``gap_deg`` is the angular opening. Each free end
    carries a round eared lug of diameter ``w_lug + lug_project`` with a through plier hole of
    diameter ``lug_hole_d``. ``internal=False`` grows the section (and lugs) outward from
    ``d_seat`` (DIN 471); ``True`` grows it inward toward the axis (DIN 472).

    The ring is a closed ``Polygon`` in XY — the growing edge sampled around the material arc
    then the seated edge sampled back — extruded ``thickness`` along Z (centred), with the lug
    ears fused and the plier holes subtracted last.
    """
    for name, val in (("d_seat", d_seat), ("thickness", thickness), ("w_lug", w_lug),
                      ("w_back", w_back), ("lug_hole_d", lug_hole_d), ("lug_project", lug_project)):
        if val <= 0:
            raise ValueError(f"retaining_ring: need {name} > 0, got {val}")
    if not (0 < gap_deg < 180):
        raise ValueError(f"retaining_ring: need 0 < gap_deg < 180, got {gap_deg}")
    r_seat = d_seat / 2.0
    if internal:
        # Growing inward, the innermost reach — the wider of the body's max width or the
        # projecting ear — must leave a solid wall inside without crossing the axis.
        reach = max(w_back, w_lug + lug_project)
        if reach >= r_seat - _MIN_WALL_MM:
            raise ValueError(
                f"retaining_ring: internal ring grows inward by {reach} mm but only "
                f"{r_seat - _MIN_WALL_MM} mm of radius is available (d_seat {d_seat})")
    if lug_hole_d >= w_lug + lug_project - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"retaining_ring: plier hole {lug_hole_d} leaves too thin an ear wall vs lug "
            f"diameter {w_lug + lug_project} (needs < lug - {2.0 * _MIN_WALL_MM} mm)")

    sign = -1.0 if internal else 1.0
    half_gap = math.radians(gap_deg) / 2.0
    a0, a1 = half_gap, 2.0 * math.pi - half_gap    # material arc endpoints; gap centred on +X
    back = math.pi                                  # theta of the back (the min/max-width point)
    span = math.pi - half_gap                       # angular distance from the back to a free end

    def width(theta):
        return w_back + (w_lug - w_back) * abs(theta - back) / span

    growing, seated = [], []
    for i in range(_ARC_SAMPLES):
        theta = a0 + (a1 - a0) * i / (_ARC_SAMPLES - 1)
        r_grow = r_seat + sign * width(theta)
        growing.append((r_grow * math.cos(theta), r_grow * math.sin(theta)))
        seated.append((r_seat * math.cos(theta), r_seat * math.sin(theta)))

    r_ear = (w_lug + lug_project) / 2.0
    ear_r = r_seat + sign * r_ear                   # ear-disc centre radius (disc sits on the seat)
    lug_centres = [(ear_r * math.cos(a), ear_r * math.sin(a)) for a in (a0, a1)]

    with BuildPart() as bp:
        with BuildSketch():
            # Closed C: out along the growing edge (a0 -> a1), back along the seated edge
            # (a1 -> a0); the two straight jumps are the free-end caps. Explicit coords, no
            # auto-centring, so the polygon stays put on the seated circle.
            Polygon(*(growing + seated[::-1]), align=None)
        extrude(amount=thickness / 2.0, both=True)  # thin body centred on z = 0
        for cx, cy in lug_centres:                  # fuse a round eared lug at each free end
            with Locations((cx, cy, 0.0)):
                Cylinder(radius=r_ear, height=thickness)
        for cx, cy in lug_centres:                  # subtract the plier holes last
            with Locations((cx, cy, 0.0)):
                Cylinder(radius=lug_hole_d / 2.0, height=thickness * 3.0, mode=Mode.SUBTRACT)
    part = bp.part
    if part.volume <= 0:                            # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("retaining_ring: produced an empty solid")
    return part
```

- [ ] **Step 4: Register the family**

In `catalog/models/_registry.py`, add the import after the `tslot_nut` import (line 19):

```python
from catalog.models.retaining_ring import retaining_ring
```

and add to the `KNOWN_FAMILIES` dict (after the `tslot_nut` entry):

```python
    "retaining_ring": retaining_ring,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_retaining_ring.py -q`
Expected: PASS (all tests green). If a probe misses (bbox or solid/void mismatch), fix the construction — do not change the tests. Note `BuildSketch()` defaults to `Plane.XY`, so the polygon `(x, y)` maps to global `(x, y, 0)` and `extrude(both=True)` centres the thickness on Z; the default camera renders +X as up, so the gap centred on +X puts the lugs at the top of the face view.

- [ ] **Step 6: Commit**

```bash
git add catalog/models/retaining_ring.py catalog/tests/test_retaining_ring.py catalog/models/_registry.py
git commit -m "feat(catalog): add retaining_ring generator (DIN 471/472 circlips)"
```

---

### Task 2: Data entries + build (`din471`, `din472`)

> **Controller sourcing gate (do BEFORE dispatching this task's implementer).** The controller
> runs a sourcing subagent (constrained to summary tools / `pdftotext`, not full-page crawling)
> plus a controller perplexity cross-check to confirm every dimension against **≥2 independent
> public tables** and to resolve the shape questions against the raster: (1) the **taper
> direction** — which of `w_lug` (width at the eared free ends) / `w_back` (width at the back,
> 180° from the gap) is the wider, for both DIN 471 and DIN 472; (2) a representative free-state
> **`gap_deg`** (the angular opening; tabulated less consistently — documented as representative
> if read off the drawing); (3) **`lug_project`** (how far the ear projects past the body —
> representative if not cleanly tabulated). `d_seat` maps to the groove diameter `d2` (the ring's
> inner edge for `din471`/external, its outer edge for `din472`/internal). The reconciled result
> — including the **exact JSON** to write — goes to `.superpowers/sdd/sourcing-decision.md`. The
> implementer copies values from that file verbatim; it does not invent or adjust dimensions.

**Files:**

- Create: `catalog/dimensions/retaining_rings.json`
- Create: `catalog/tests/test_retaining_rings_data.py`

**Interfaces:**

- Consumes: `retaining_ring` (Task 1) via `build_part(family, shape)`; `validate_entry` from `catalog.schema`.
- Produces: two catalog entries `din471` (external, `internal: false`) and `din472` (internal, `internal: true`), family `retaining_ring`, `hardwareType: "ring"`, `source`, `verified: true`, `designations`.

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_retaining_rings_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/retaining_rings.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_retaining_ring_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 2
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_retaining_ring_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "retaining_ring", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "ring"


def test_has_external_and_internal_forms():
    entries = json.loads(DATA.read_text())
    assert "din471" in entries and entries["din471"]["shape"]["internal"] is False
    assert "din472" in entries and entries["din472"]["shape"]["internal"] is True


def test_every_retaining_ring_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_retaining_ring_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_retaining_rings_data.py -q`
Expected: FAIL — `FileNotFoundError` (the data file does not exist yet).

- [ ] **Step 3: Write the data file from the sourcing decision**

Create `catalog/dimensions/retaining_rings.json` by copying the exact `shape` and `source`
values from `.superpowers/sdd/sourcing-decision.md` (produced by the controller sourcing gate).
The structure is fixed; the numbers come from that file. The shape below shows the required keys
and illustrative nominal-size-12 values — the implementer uses the file's final numbers (which
resolve the taper direction, gap, and ear projection):

```json
{
	"din471": {
		"family": "retaining_ring",
		"shape": {
			"d_seat": 11.5,
			"thickness": 1.0,
			"w_lug": 1.7,
			"w_back": 1.05,
			"gap_deg": 40.0,
			"lug_hole_d": 1.7,
			"lug_project": 0.9,
			"internal": false
		},
		"hardwareType": "ring",
		"source": "<from sourcing-decision.md: cites >=2 public tables; d_seat = groove d2 for a 12 mm shaft, thickness s; states which of w_lug/w_back is wider (taper direction) and that gap_deg + lug_project are representative>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "471" }]
	},
	"din472": {
		"family": "retaining_ring",
		"shape": {
			"d_seat": 12.5,
			"thickness": 1.0,
			"w_lug": 1.7,
			"w_back": 1.05,
			"gap_deg": 40.0,
			"lug_hole_d": 1.7,
			"lug_project": 0.9,
			"internal": true
		},
		"hardwareType": "ring",
		"source": "<from sourcing-decision.md: cites >=2 public tables; d_seat = groove d2 for a 12 mm bore, thickness s; states the taper direction and that gap_deg + lug_project are representative>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "472" }]
	}
}
```

- [ ] **Step 4: Run the data test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_retaining_rings_data.py -q`
Expected: PASS (both entries validate and build).

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

Expected: two **new** files `catalog/out/din471.svg` and `catalog/out/din472.svg` appear in `git status` (plus a modified `catalog/out/manifest.json`, the build index); **no** existing `catalog/out/*.svg` is modified (byte-identical); both `grep -c` counts are `0` (opt-in gate held).

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/retaining_rings.json catalog/tests/test_retaining_rings_data.py catalog/out/din471.svg catalog/out/din472.svg catalog/out/manifest.json
git commit -m "feat(catalog): add DIN 471/472 retaining-ring data"
```

---

## Self-Review

**1. Spec coverage.** `retaining_ring` generator with the tapered split-C polygon + eared lugs + plier holes + through-thickness holes + `internal` mirror (Task 1) ✓; registration in `_registry.py` — 24 families (Task 1) ✓; data file with the two nominal-size-12 entries (`din471` external / `din472` internal) + sourcing gate resolving the taper direction, gap, and ear projection (Task 2) ✓; synthetic-fixture generator tests (incl. the taper discriminator, gap void, lug+hole, and external-vs-internal flip) + data tests ✓; no render change — `hardwareType: "ring"` → `DEFAULT_AXIS_Z` ✓; opt-in 0/0 + byte-identical SVGs + in-container build (Task 2, Step 6) ✓; no forbidden source token (data test) ✓.

**2. Placeholder scan.** The only `<...>` placeholders are the two `source` strings in Task 2, intentionally filled from `.superpowers/sdd/sourcing-decision.md` at execution — the controller sourcing gate is the documented mechanism (matching shipped families), not a plan gap. All code steps carry complete code.

**3. Type consistency.** `retaining_ring(d_seat, thickness, w_lug, w_back, gap_deg, lug_hole_d, lug_project, internal=False)` is used identically in the generator, tests, registry key (`"retaining_ring"`), and the data `shape` blocks (keys `d_seat, thickness, w_lug, w_back, gap_deg, lug_hole_d, lug_project, internal`). `_MIN_WALL_MM` is imported (not redefined). Data `family` matches the registry key and the data test's expected value; `hardwareType: "ring"` is in the schema enum and routes to `DEFAULT_AXIS_Z`.
