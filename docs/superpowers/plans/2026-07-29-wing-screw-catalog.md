# Wing Screw Family (DIN 316) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `wing_screw` generator family and DIN 316 (M12) data so the generative catalog closes the screw gap 36 -> 34 (`din316` + `din316p`).

**Architecture:** Extract the verified DIN 315 wing profile from `wing_nut.py` into a shared `wing_common.py`; the new `wing_screw` composes tapered hub + shared wings (head, z >= 0) with `screw_common._screw_shank` (z <= 0), with no bore. Data follows the base + `alias_of` pattern; rendered SVG and manifest entries are committed like every prior family.

**Tech Stack:** Python, build123d, pytest — all catalog commands run in the pinned Docker container via `./catalog/run`.

**Spec:** `docs/superpowers/specs/2026-07-29-wing-screw-design.md` (approved).

## Global Constraints

- Every catalog command runs in the pinned container: `./catalog/run <cmd>` (builds the Docker image on first use).
- Conventional Commits (`type(scope): description`); never mention AI assistance in commits.
- Envelope-only geometry: no drawn thread; smooth cylinder at major diameter.
- Dimensions: only values confirmed by >= 2 public tables go in as sourced; everything else is marked REPRESENTATIVE inside the `source` string. The tokens `reyher` and `stalmut` must never appear in any `source`.
- `wing_nut` behavior must not change (its existing tests are the refactor guard).
- Do NOT stop the running `pnpm dev` server; do NOT run `pnpm standards:build`.
- TDD: every new test file is run red before its implementation exists.

**Sourced DIN 316 M12 values (already researched, cite in `source`):**
fasteners.eu DIN 316-D table, M12 row: hub base dia d2 = 23 max, hub top dia d3 = 19.5 max, hub height m = 10–14, head height incl. wings h = 33.5 max, wing span e = 65 max, blade thickness g1 = 4.9 max. Confirmed by boltingspecialist.com DIN 316 M12 nominal row (d2 = 21.5, e = 63.5, g = 4.5, h = 32.3, m = 12 — mid-tolerance values of the same series). The head envelope equals the independently sourced DIN 315 M12 wing-nut envelope (shared German wing form). REPRESENTATIVE picks: `length = 30.0` (common M12 stock length, e.g. Accu M12x30 listings), `tip_chamfer = 1.2`, `boss_h = 14.0` (the `m` max, same reading as DIN 315).

---

### Task 1: Extract the shared wing profile into `wing_common.py`

**Files:**

- Create: `catalog/models/wing_common.py`
- Modify: `catalog/models/wing_nut.py`
- Test (existing, unchanged): `catalog/tests/test_wing_nut.py`

**Interfaces:**

- Consumes: nothing new.
- Produces: `catalog.models.wing_common._wing_profile(boss_d, span, height, wing_t) -> (A, B, C, D, m_BC, m_CD)` — six `(x, z)` tuples for one +X wing in the XZ plane — and the constant `_INNER_EDGE_DEG`. Task 2 imports `_wing_profile` from here.

- [ ] **Step 1: Create `catalog/models/wing_common.py`** (the function and constant are moved VERBATIM from `wing_nut.py`; only the docstrings are new):

```python
"""Shared DIN 315/316 German-form wing profile (rounded finger wings).

Two flat paddle wings rise from a tapered hub and spread apart, each with a rounded outer
ear and a concave valley toward the hub. The construction follows the DIN 315/316 geometry
as also implemented in the open-source FreeCAD Fasteners Workbench (LGPL,
github.com/shaise/FreeCAD_FastenersWB); it is reimplemented here in build123d. The shape is
dictated by the standards; the exact wing radii are not published, so the outline is
representative form and only the tabulated envelope dimensions are sourced. Consumed by
``wing_nut`` (DIN 315) and ``wing_screw`` (DIN 316).
"""
import math

_INNER_EDGE_DEG = 20.0   # rise angle of the wing's inner (valley-side) edge, per the DIN 315/316 form


def _wing_profile(boss_d, span, height, wing_t):
    """Points closing one (+X) finger wing in the XZ plane (x = radial, z = axial).

    A: root at the hub (low z); A->B: inner (valley-side) edge rising at ``_INNER_EDGE_DEG`` to
    the top; B->C: rounded outer ear (arc, the large ``r1`` radius); C->D: concave outer-lower
    edge (arc) back to the hub; D->A closes along the hub. Every coordinate is a proportion of
    the tabulated envelope (boss_d, span, height, wing_t), so the wing is representative form.
    """
    xin = boss_d / 4.0                          # inner edge x (buried in the hub -> fused)
    A = (xin, 0.75 * wing_t)
    B = (xin + (height - 0.75 * wing_t) * math.tan(math.radians(_INNER_EDGE_DEG)), height)
    C = (span / 2.0, 0.80 * height)             # ear outer tip (max x)
    D = (xin, wing_t / 4.0)
    m_BC = (0.375 * span, 0.95 * height)        # through-point of the rounded ear arc
    m_CD = ((boss_d + span) / 4.0, 0.25 * height)   # through-point of the concave lower arc
    return A, B, C, D, m_BC, m_CD
```

- [ ] **Step 2: Edit `catalog/models/wing_nut.py`** — three changes, nothing else:
  1. Delete `import math` (it was only used by `_wing_profile`).
  2. Delete the `_INNER_EDGE_DEG = 20.0 ...` line and the whole `def _wing_profile(...)` block (lines 19–37 in the current file).
  3. Below the `from catalog.models.hex_nut import _MIN_WALL_MM` import, add:

```python
from catalog.models.wing_common import _wing_profile
```

4. In the module docstring, replace the sentence starting "The construction follows the DIN 315 geometry" up to "only the tabulated envelope dimensions are sourced." with: `The wing outline comes from the shared ``wing_common._wing_profile`` (see that module for form provenance and attribution).`

- [ ] **Step 3: Run the wing_nut tests to verify the refactor changed nothing**

Run: `./catalog/run pytest catalog/tests/test_wing_nut.py -v`
Expected: ALL PASS (10 test items — 8 functions, one parametrized x3).

- [ ] **Step 4: Commit**

```bash
git add catalog/models/wing_common.py catalog/models/wing_nut.py
git commit -m "refactor(catalog): extract shared DIN 315/316 wing profile into wing_common"
```

---

### Task 2: `wing_screw` generator (TDD)

**Files:**

- Test: `catalog/tests/test_wing_screw.py` (create)
- Create: `catalog/models/wing_screw.py`
- Modify: `catalog/models/_registry.py`

**Interfaces:**

- Consumes: `wing_common._wing_profile` (Task 1), `screw_common._screw_shank(d, length, tip_chamfer)` (existing; returns a part with its top face on z=0).
- Produces: `wing_screw(d_shank, length, boss_d, collar_d, boss_h, span, height, wing_t, tip_chamfer=None) -> Part`, registered in `_registry.KNOWN_FAMILIES` under `"wing_screw"`. Task 3's data entries call it through `build_part("wing_screw", shape)`.

- [ ] **Step 1: Write the failing test** — create `catalog/tests/test_wing_screw.py`:

```python
import pytest
from build123d import Box, Pos, Compound

from catalog.models.wing_screw import wing_screw

# DIN 316 M12 fixture (German form, rounded wings); head envelope == DIN 315 M12
D_SHANK = 12.0
LENGTH = 30.0
BOSS_D = 23.0
COLLAR_D = 19.5
BOSS_H = 14.0
SPAN = 65.0
HEIGHT = 33.5
WING_T = 4.9
TIP_CHAMFER = 1.2


def _part(**over):
    cfg = dict(d_shank=D_SHANK, length=LENGTH, boss_d=BOSS_D, collar_d=COLLAR_D,
               boss_h=BOSS_H, span=SPAN, height=HEIGHT, wing_t=WING_T,
               tip_chamfer=TIP_CHAMFER)
    cfg.update(over)
    return wing_screw(**cfg)


def _intersect(part, x, z, sx, sy, sz):
    """Part ∩ a box centered at (x, 0, z). build123d returns None when the overlap is empty."""
    return part.intersect(Pos(x, 0.0, z) * Box(sx, sy, sz))


def _has_material(part, x, z, probe=1.0):
    return _intersect(part, x, z, probe, probe, probe) is not None


def _solid_at(part, x, y, z, probe=0.4):
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_head_above_bearing_plane_shank_below():
    part = _part()
    bb = part.bounding_box()
    assert SPAN - 1.0 <= bb.size.X <= SPAN + 0.05      # wing tips ~ span (ear fillet trims a hair)
    assert round(bb.size.Y, 1) == round(BOSS_D, 1)     # hub base diameter is widest along Y
    assert HEIGHT - 0.5 <= bb.max.Z <= HEIGHT + 0.05   # wing top ~ height above z=0
    assert round(bb.min.Z, 1) == round(-LENGTH, 1)     # shank free end at -length


def test_hub_tapers_from_boss_d_to_collar_d():
    # probe at radius ~10.4 (between collar_d/2=9.75 and boss_d/2=11.5), offset in Y clear of
    # the wing blades: solid at the hub base, empty near the hub top (same probe as wing_nut).
    part = _part()
    x, y = 10.0, 3.0
    assert _solid_at(part, x, y, 0.5)
    assert not _solid_at(part, x, y, BOSS_H - 0.5)


def test_no_bore_hub_center_is_solid():
    # the single structural difference from wing_nut: the screw hub has no through bore
    part = _part()
    assert _solid_at(part, 0.0, 0.0, 0.5)
    assert _solid_at(part, 0.0, 0.0, BOSS_H - 0.5)


def test_wing_blade_thickness_reads_wing_t():
    col = _intersect(_part(), x=0.60 * SPAN / 2.0, z=0.72 * HEIGHT, sx=0.4, sy=50.0, sz=0.4)
    assert col is not None
    assert round(Compound(col).bounding_box().size.Y, 2) == round(WING_T, 2)


def test_two_wings_spread_into_a_v_notch():
    part = _part()
    assert _has_material(part, x=0.60 * SPAN / 2.0, z=0.72 * HEIGHT)   # over an ear: material
    assert not _has_material(part, x=0.0, z=0.85 * HEIGHT)            # V opening at the top center


def test_shank_below_bearing_plane_with_lead_chamfer():
    part = _part()
    r = D_SHANK / 2.0
    assert _solid_at(part, r - 0.6, 0.0, -LENGTH / 2.0)        # solid to the shank wall
    assert not _solid_at(part, r + 0.6, 0.0, -LENGTH / 2.0)    # void beyond the shank
    assert not _solid_at(part, r - 0.2, 0.0, -LENGTH + 0.2)    # 45-deg lead chamfer trims the corner
    assert not _solid_at(part, 0.0, 0.0, -LENGTH - 0.6)        # nothing below the tip


def test_single_fused_solid():
    part = _part()
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        _part(wing_t=0.0)                    # non-positive dim
    with pytest.raises(ValueError):
        _part(length=-1.0)                   # non-positive dim (shank param)
    with pytest.raises(ValueError):
        _part(collar_d=BOSS_D + 1.0)         # hub top wider than its base
    with pytest.raises(ValueError):
        _part(d_shank=BOSS_D)                # shank not narrower than the hub
    with pytest.raises(ValueError):
        _part(span=BOSS_D)                   # wings don't reach past the hub
    with pytest.raises(ValueError):
        _part(height=BOSS_H)                 # wings don't rise above the hub
    with pytest.raises(ValueError):
        _part(tip_chamfer=D_SHANK)           # rejected by _screw_shank (chamfer >= radius)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_wing_screw.py -v`
Expected: FAIL at collection with `ModuleNotFoundError: No module named 'catalog.models.wing_screw'`

- [ ] **Step 3: Implement** — create `catalog/models/wing_screw.py`:

```python
"""Wing screw family generator (DIN 316 German form 'rounded wings'): the DIN 315 wing head
on a threaded shank.

The head is the wing_nut top without the bore: a tapered hub (``boss_d`` at the bearing face
up to ``collar_d`` at the top, height ``boss_h``) carrying two flat paddle wings from the
shared ``wing_common._wing_profile``. Below the z=0 bearing plane hangs a smooth
envelope-only shank (``screw_common._screw_shank``) — no drawn thread, per the epic's
fine-feature rule. Head and shank fuse by face contact at z=0 (the screw_common stacking
seam), guarded by net volume>0 + single-solid.
"""
from build123d import (
    BuildPart, BuildSketch, BuildLine, Line, Polyline, ThreePointArc,
    Plane, Axis, add, extrude, revolve, make_face, mirror, fillet,
)

from catalog.models.wing_common import _wing_profile
from catalog.models.screw_common import _screw_shank


def wing_screw(d_shank: float, length: float, boss_d: float, collar_d: float,
               boss_h: float, span: float, height: float, wing_t: float,
               tip_chamfer: float | None = None):
    """DIN 316 wing screw: a tapered hub plus two rounded finger wings (z in [0, height])
    over a smooth shank of diameter ``d_shank`` and ``length`` (z in [-length, 0], optional
    45-degree lead ``tip_chamfer``). No bore, no drawn thread.
    """
    for name, val in (("d_shank", d_shank), ("length", length), ("boss_d", boss_d),
                      ("collar_d", collar_d), ("boss_h", boss_h), ("span", span),
                      ("height", height), ("wing_t", wing_t)):
        if val <= 0:
            raise ValueError(f"wing_screw: need {name} > 0, got {val}")
    if collar_d > boss_d:
        raise ValueError(
            f"wing_screw: collar_d {collar_d} (hub top) must not exceed boss_d {boss_d} (hub base)")
    if d_shank >= boss_d:
        raise ValueError(
            f"wing_screw: d_shank {d_shank} must be < boss_d {boss_d} (the hub overhangs the shank)")
    if span <= boss_d:
        raise ValueError(
            f"wing_screw: span {span} must exceed boss_d {boss_d} (wings must reach past the hub)")
    if height <= boss_h:
        raise ValueError(
            f"wing_screw: height {height} must exceed boss_h {boss_h} (wings rise above the hub)")

    A, B, C, D, m_BC, m_CD = _wing_profile(boss_d, span, height, wing_t)
    ear_r = wing_t / 2.0                         # corner rounding of the exposed ear
    shank = _screw_shank(d_shank, length, tip_chamfer)   # z in [-length, 0], validates chamfer
    with BuildPart() as bp:
        # Tapered hub, z in [0, boss_h]: same revolved trapezoid as wing_nut (revolve handles
        # the cone and the degenerate cylinder collar_d == boss_d uniformly).
        with BuildSketch(Plane.XZ):
            with BuildLine():
                Polyline([(0.0, 0.0), (boss_d / 2.0, 0.0),
                          (collar_d / 2.0, boss_h), (0.0, boss_h)], close=True)
            make_face()
        revolve(axis=Axis.Z)
        with BuildSketch(Plane.XZ) as sk:
            with BuildLine():
                Line(A, B)                                       # inner (valley-side) edge, 20 deg
                ThreePointArc(B, m_BC, C)                        # rounded outer ear
                ThreePointArc(C, m_CD, D)                        # concave outer-lower edge
                Line(D, A)                                       # close along the hub
            make_face()
            # Filter on boss_d/2 (the wider hub base): any vertex outside it is outside the hub
            # at every height, so the narrower top (collar_d/2) is a subset — no corner missed.
            ear_corners = sk.vertices().filter_by(lambda v: v.X > boss_d / 2.0)
            if ear_corners:
                fillet(ear_corners, radius=ear_r)                # soften the exposed ear corners
            mirror(about=Plane.YZ)                               # duplicate onto the -X wing
        extrude(amount=wing_t / 2.0, both=True)                  # thickness wing_t, centered on Y=0
        add(shank)                                               # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                         # net guard (matches the family; not is_valid)
        raise ValueError("wing_screw: produced an empty solid")
    if len(part.solids()) != 1:                  # hub + wings + shank must fuse to one solid
        raise ValueError("wing_screw: head/shank did not fuse into a single solid")
    return part
```

- [ ] **Step 4: Register the family** — in `catalog/models/_registry.py`, after the `knurled_screw` import add:

```python
from catalog.models.wing_screw import wing_screw
```

and after the `"knurled_screw": knurled_screw,` entry in `KNOWN_FAMILIES` add:

```python
    "wing_screw": wing_screw,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_wing_screw.py -v`
Expected: ALL PASS (9 tests).

- [ ] **Step 6: Run the whole catalog suite (regression)**

Run: `./catalog/run pytest catalog/tests -v`
Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/tests/test_wing_screw.py catalog/models/wing_screw.py catalog/models/_registry.py
git commit -m "feat(catalog): add wing_screw generator (DIN 316 wings + shank)"
```

---

### Task 3: DIN 316 data + data tests (TDD)

**Files:**

- Test: `catalog/tests/test_wing_screws_data.py` (create)
- Create: `catalog/dimensions/wing_screws.json`

**Interfaces:**

- Consumes: `wing_screw` via `_registry.build_part` (Task 2), `catalog.schema.validate_entry` (existing).
- Produces: dimension entries `din316` (base) and `din316p` (alias) that `build_catalog.py` auto-globs from `catalog/dimensions/*.json` (Task 4 renders them; no extra wiring).

- [ ] **Step 1: Write the failing test** — create `catalog/tests/test_wing_screws_data.py` (pattern from `test_knurled_screws_data.py`):

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/wing_screws.json")
_FORBIDDEN = ("reyher", "stalmut")

_BASES = ("din316",)
_ALIASES = {"din316p": "din316"}
_DIN_CODE = {"din316": "316", "din316p": "316"}


def test_every_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "wing_screw", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"


def test_bases_are_real_and_build():
    entries = json.loads(DATA.read_text())
    for base_id in _BASES:
        assert base_id in entries and "alias_of" not in entries[base_id], f"{base_id} must be a base"
        build_part(entries[base_id]["family"], entries[base_id]["shape"])


def test_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from wing_screws.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"


def test_designations_name_the_right_din_standard():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        code = _DIN_CODE[sid]
        assert {"system": "DIN", "code": code} in entry["designations"], f"{sid}: DIN {code} missing"


def test_every_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_wing_screws_data.py -v`
Expected: ERROR/FAIL with `FileNotFoundError: ... catalog/dimensions/wing_screws.json`

- [ ] **Step 3: Create `catalog/dimensions/wing_screws.json`** (values are the sourced set from Global Constraints — do not alter them):

```json
{
	"din316": {
		"family": "wing_screw",
		"shape": {
			"d_shank": 12.0,
			"length": 30.0,
			"boss_d": 23.0,
			"collar_d": 19.5,
			"boss_h": 14.0,
			"span": 65.0,
			"height": 33.5,
			"wing_t": 4.9,
			"tip_chamfer": 1.2
		},
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "316" }],
		"source": "DIN 316 wing screw, German form 'rounded wings' (M12x30). Envelope confirmed vs fasteners.eu DIN 316-D table (M12: hub base dia d2=23 max, hub top dia d3=19.5 max, hub height m=10-14, head height incl. wings h=33.5 max, wing span e=65 max, blade thickness g1=4.9 max) + boltingspecialist.com DIN 316 (M12 nominal d2=21.5, e=63.5, g=4.5, h=32.3, m=12 -- mid-tolerance values of the same series). The head envelope equals the independently sourced DIN 315 M12 wing-nut envelope (shared German wing form; see wing_common). d_shank=12.0 is the M12 major diameter (envelope-only, no drawn thread). boss_h=14.0 taken as hub height (same 'm' reading as DIN 315) -> form, not asserted normative. length=30.0 REPRESENTATIVE (common M12 stock length, e.g. Accu M12x30); tip_chamfer=1.2 REPRESENTATIVE 45-degree lead. Wing radii are not published; the rounded wing outline is representative form shared with wing_nut."
	},
	"din316p": {
		"alias_of": "din316",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "316" }],
		"source": "DIN 316 M12, app image-variant key -- identical wing-screw envelope, aliases the din316 base."
	}
}
```

- [ ] **Step 4: Run the data tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_wing_screws_data.py -v`
Expected: ALL PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add catalog/tests/test_wing_screws_data.py catalog/dimensions/wing_screws.json
git commit -m "feat(catalog): add DIN 316 wing screw data (M12, sourced 2 tables)"
```

---

### Task 4: Render, QA, commit the drawing (gap 36 -> 34)

**Files:**

- Modify (generated): `catalog/out/manifest.json`
- Create (generated): `catalog/out/din316.svg`

**Interfaces:**

- Consumes: `build_catalog.build` auto-globbing `catalog/dimensions/wing_screws.json` (Task 3).
- Produces: committed `catalog/out/din316.svg` + manifest entries for `din316` and `din316p` — this is what the coverage gap counts.

- [ ] **Step 1: Build the catalog**

Run: `./catalog/run python catalog/build_catalog.py`
Expected: JSON report with `"failed": []` and `"skipped": []`; ok count grows by 2.

- [ ] **Step 2: Verify only the new entries changed**

Run: `git status --short catalog/out && git diff --stat catalog/out/manifest.json`
Expected: `catalog/out/din316.svg` untracked (new); `manifest.json` diff shows ONLY added `din316`/`din316p` blocks (renders are deterministic in the pinned container — if other SHAs changed, STOP and investigate before committing).

- [ ] **Step 3: Visual shape check against the legacy raster**

1. Run: `./catalog/run python catalog/qa/contact_sheet.py` and open the produced HTML — `din316` must show the two-view drawing.
2. Compare with the legacy raster: open `http://localhost:5173/dev/asset-compare` (the dev server is already running — do not restart it) and check `din316` side-by-side vs `static/images/standards/din_316.png`: rounded German wings, tapered hub, shank to the side/below, no bore.
   Expected: forms match (wings identical to DIN 315's, plus shank). If the form is off, STOP — fix geometry, do not commit.

- [ ] **Step 4: Coverage sanity**

Run (local python3 — reads JSON only, and `./catalog/run` does not forward stdin):

```bash
python3 - <<'EOF'
import json
gen = set(json.load(open('catalog/out/manifest.json'))['standards'])
maps = json.load(open('data/image-mappings.json'))
missing = [s for s, m in maps.items() if m.get('hardwareType') == 'screw' and s not in gen]
print('screw gap:', len(missing))
EOF
```

Expected: `screw gap: 34`

- [ ] **Step 5: Commit**

```bash
git add catalog/out/din316.svg catalog/out/manifest.json
git commit -m "feat(catalog): render DIN 316 wing screw drawing (gap 36->34)"
```

---

### Task 5: PR, external review, merge

**Files:** none (process task).

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin feature/screws-wing-screw
gh pr create --title "feat(catalog): add DIN 316 wing screw + wing_screw generator (gap 36->34)" --body "$(cat <<'EOF'
Adds the wing_screw generator family and DIN 316 data (feature).

**Problem**
The generative catalog has no wing screw family. `din316`/`din316p` still use the legacy raster; the screw coverage gap is 36.

**Goal**
Close two screw-gap IDs with a generated DIN 316 drawing, and share the verified DIN 315 wing form between the nut and the screw so future wing-shape fixes apply to both.

**How**
- Extracts `_wing_profile` from `wing_nut.py` into `wing_common.py` (behavior unchanged, existing wing_nut tests guard it).
- New `wing_screw`: tapered hub + shared wings above the bearing plane, envelope-only shank from `screw_common` below it, no bore.
- DIN 316 M12 envelope sourced from two public tables (fasteners.eu DIN 316-D, boltingspecialist.com); stock length and tip chamfer are marked REPRESENTATIVE in the source string.

**Test plan**
- [x] `catalog/tests/test_wing_screw.py` — envelope, hub taper, solid hub center (no bore), wing thickness, V notch, shank + lead chamfer, single-solid fusion, argument guards
- [x] `catalog/tests/test_wing_screws_data.py` — schema, family, alias resolution, designations, sourcing rules
- [x] `catalog/tests/test_wing_nut.py` — unchanged, guards the wing_common refactor
- [x] Full catalog suite in the pinned container
- Not covered: visual form is checked manually (contact sheet + /dev/asset-compare), not by an automated image diff

**Review notes**
Start with `catalog/models/wing_common.py` (the moved profile) and `wing_screw.py`. The dimension provenance is in `catalog/dimensions/wing_screws.json` `source`.
EOF
)"
```

- [ ] **Step 2: External pre-merge review (required — catalog generator is a shared surface)**

Run `mcp__zen__codereview` with `model="deepseek/deepseek-v4-pro"`, `thinking_mode="high"` on the branch diff (never `model="auto"`; fallback `gemini-3.1-pro-preview` if OpenRouter is down). Apply real findings as ADDITIONAL commits on the PR (no amend/force-push).

- [ ] **Step 3: Wait for CI green on the latest commit**

```bash
gh run list --branch feature/screws-wing-screw --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch <run-id> --exit-status   # run_in_background
```

Expected: exit 0. Never `sleep N && gh pr checks`.

- [ ] **Step 4: Merge (squash) after CI green + review findings addressed**

```bash
gh pr merge --squash --subject "feat(catalog): add DIN 316 wing screw + wing_screw generator (gap 36->34)"
```

- [ ] **Step 5: Post-merge sync**

```bash
git checkout master && git pull
./catalog/run python catalog/qa/coverage.py   # washer coverage still complete
```
