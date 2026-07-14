# Wing Nut Family Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the DIN 315 wing nut family (German Form D, "rounded wings") to the maintainer-only generative catalog: a new `wing_nut` generator (cylindrical boss + two rounded wing lobes + bore), one M12 data entry (`din315`), and its rendered drawing.

**Architecture:** A new `catalog/models/wing_nut.py` builds a cylindrical hub with two flat rounded wing lobes in the XZ plane (so the butterfly renders in the profile view with no preset change) unioned to the hub, bore subtracted last — the same union shape as `collar_nut`. It imports only `_MIN_WALL_MM` from `hex_nut`; it does **not** touch `_chamfered_hex_solid`. Registered in `_registry.py`, driven by `catalog/dimensions/wing_nuts.json`, rendered by the existing `NUT_PRESET`.

**Tech Stack:** Python, build123d (OCP kernel), pytest, all run in-container via `./catalog/run`.

## Global Constraints

- Representative size **M12**; ship one entry `din315` (German Form D). No American Form A, no DIN 314, no sizes beyond M12.
- Every committed **envelope** dimension confirmed by **≥2 independent public tables**; representative form fields (`boss_h`, wing profile) documented as such in the `source` string, never asserted as normative.
- Source strings must **not** contain `reyher`, `stalmut`, or any private/internal catalogue.
- New geometry: does **not** modify `_chamfered_hex_solid` or any existing generator. `wing_nut.py` imports only `_MIN_WALL_MM` from `hex_nut`.
- **No render/preset change.** Wing orientation is set entirely by the generator (wings in the XZ plane).
- Existing nut/washer SVGs stay **byte-identical** after the build (only `din315.svg` is new).
- **Opt-in invariant 0/0**: `data/image-mappings.json` and `src/lib/data/standards-generated.ts` reference **zero** generated `.svg` files.
- All builds and tests run **in-container** via `./catalog/run`.

---

### Task 1: `wing_nut` generator

**Files:**

- Create: `catalog/models/wing_nut.py`
- Test: `catalog/tests/test_wing_nut.py`

**Interfaces:**

- Consumes: `catalog.models.hex_nut._MIN_WALL_MM` (float, `0.1`).
- Produces: `wing_nut(bore: float, boss_d: float, boss_h: float, span: float, height: float, wing_t: float, tip_r: float) -> build123d Part`. Boss axis is Z (bore along Z); wings spread along ±X in the XZ plane, thickness `wing_t` along Y; lobe radius `tip_r`, lobe center at `x_c = ±(span/2 - tip_r)`, `z_c = height - tip_r`. Raises `ValueError` on bad geometry.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_wing_nut.py`:

```python
import math

import pytest
from build123d import BuildPart, Box, Locations, Mode, add

from catalog.models.wing_nut import wing_nut

BORE = 10.1        # DIN 315 M12 fixture (German Form D)
BOSS_D = 23.0
BOSS_H = 14.0
SPAN = 65.0
HEIGHT = 33.5
WING_T = 4.9
TIP_R = 10.0


def _part():
    return wing_nut(bore=BORE, boss_d=BOSS_D, boss_h=BOSS_H, span=SPAN,
                    height=HEIGHT, wing_t=WING_T, tip_r=TIP_R)


def _material_at(part, x, z, probe=1.0):
    """Volume of a small cube of the part centered at (x, 0, z) — 0 means empty there."""
    with BuildPart() as bp:
        add(part)
        with Locations((x, 0.0, z)):
            Box(probe, probe, probe, mode=Mode.INTERSECT)
    return bp.part.volume if bp.part is not None else 0.0


def test_wing_nut_envelope_extents():
    bb = _part().bounding_box()
    assert round(bb.size.X, 2) == round(SPAN, 2)       # wing tips define the width (X)
    assert round(bb.size.Z, 2) == round(HEIGHT, 2)     # boss axis height (Z)
    assert round(bb.size.Y, 2) == round(BOSS_D, 2)     # hub diameter is widest along Y
    assert _part().volume > 0


def test_wing_blade_thickness_reads_wing_t():
    verts = list(_part().vertices())
    wing_ys = [abs(v.Y) for v in verts if abs(v.X) > BOSS_D]   # out past the hub -> wing only
    assert wing_ys
    assert round(max(wing_ys) * 2.0, 2) == round(WING_T, 2)


def test_two_wings_leave_a_central_dip():
    part = _part()
    top = HEIGHT - 1.0
    assert _material_at(part, x=SPAN / 2.0 - TIP_R, z=top) > 0   # over a lobe: material
    assert _material_at(part, x=0.0, z=top) == 0                 # center near top: dip, empty


def test_wing_lobe_is_rounded_not_square():
    # the square envelope corner (tip, top) is cut away by the rounded lobe arc
    assert _material_at(_part(), x=SPAN / 2.0 - 0.5, z=HEIGHT - 0.5, probe=0.6) == 0


def test_boss_wall_and_open_bore():
    part = _part()
    assert _material_at(part, x=BOSS_D / 2.0 - 0.6, z=1.0, probe=0.5) > 0    # inside the hub wall
    assert _material_at(part, x=BOSS_D / 2.0 + 0.6, z=1.0, probe=0.5) == 0   # just outside the hub
    solid = wing_nut(bore=0.4, boss_d=BOSS_D, boss_h=BOSS_H, span=SPAN,
                     height=HEIGHT, wing_t=WING_T, tip_r=TIP_R)
    assert part.volume < solid.volume            # the M12 bore removes more than a pinhole


def test_wing_nut_guards_bad_geometry():
    base = dict(bore=BORE, boss_d=BOSS_D, boss_h=BOSS_H, span=SPAN,
                height=HEIGHT, wing_t=WING_T, tip_r=TIP_R)
    with pytest.raises(ValueError):
        wing_nut(**{**base, "bore": 0.0})                       # non-positive dim
    with pytest.raises(ValueError):
        wing_nut(**{**base, "boss_d": BORE})                    # wall too thin around bore
    with pytest.raises(ValueError):
        wing_nut(**{**base, "span": BOSS_D})                    # wings don't reach past the hub
    with pytest.raises(ValueError):
        wing_nut(**{**base, "height": BOSS_H})                  # wings don't rise above the hub
    with pytest.raises(ValueError):
        wing_nut(**{**base, "tip_r": HEIGHT})                   # lobe taller than half the height
    with pytest.raises(ValueError):
        wing_nut(**{**base, "span": BOSS_D + 2.0 * TIP_R})      # lobe center == hub radius -> no dip
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_wing_nut.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.wing_nut'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/wing_nut.py`:

```python
"""Wing nut family generator (DIN 315 German Form D): a cylindrical threaded boss with two rounded finger wings."""
from build123d import (
    BuildPart, BuildSketch, Circle, Polygon, Cylinder, Locations,
    Plane, Align, Mode, extrude,
)

from catalog.models.hex_nut import _MIN_WALL_MM


def wing_nut(bore: float, boss_d: float, boss_h: float, span: float,
             height: float, wing_t: float, tip_r: float):
    """DIN 315 (German Form D) wing nut: a cylindrical hub of diameter ``boss_d`` and height
    ``boss_h`` on the bearing face, two rounded finger wings, and a through ``bore``.

    Boss axis is Z (bore drilled along Z). The two wings live in the XZ plane: each is a flat
    rounded lobe of thickness ``wing_t`` (along Y) whose outer arc has radius ``tip_r``, its
    tip at ``x = ±span/2`` and its top at ``z = height``, blended to the hub by a wedge neck.
    The lobes are mirror images across x=0 and do not meet at the center, leaving the hub top
    exposed as the central dip. Bore is subtracted last, like ``hex_nut``.
    """
    for name, val in (("bore", bore), ("boss_d", boss_d), ("boss_h", boss_h),
                      ("span", span), ("height", height), ("wing_t", wing_t),
                      ("tip_r", tip_r)):
        if val <= 0:
            raise ValueError(f"wing_nut: need {name} > 0, got {val}")
    if boss_d <= bore + 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"wing_nut: boss_d {boss_d} leaves too thin a wall around bore {bore} "
            f"(needs > bore + {2.0 * _MIN_WALL_MM} mm)")
    if span <= boss_d:
        raise ValueError(
            f"wing_nut: span {span} must exceed boss_d {boss_d} (wings must reach past the hub)")
    if height <= boss_h:
        raise ValueError(
            f"wing_nut: height {height} must exceed boss_h {boss_h} (wings rise above the hub)")
    if tip_r > height / 2.0:
        raise ValueError(
            f"wing_nut: tip_r {tip_r} must be <= height/2 ({height / 2.0}) so the lobe fits "
            f"below the top face")
    if span / 2.0 - tip_r <= boss_d / 2.0:
        raise ValueError(
            f"wing_nut: lobe center {span / 2.0 - tip_r} must clear the hub radius "
            f"{boss_d / 2.0} (else the two wings merge — no central dip)")

    z_c = height - tip_r                         # lobe center height
    with BuildPart() as bp:
        Cylinder(radius=boss_d / 2.0, height=boss_h,
                 align=(Align.CENTER, Align.CENTER, Align.MIN))   # hub on the bearing face z=0
        for sign in (1.0, -1.0):
            x_c = sign * (span / 2.0 - tip_r)    # lobe center; tip at sign*span/2
            with BuildSketch(Plane.XZ):
                with Locations((x_c, z_c)):
                    Circle(radius=tip_r)                          # rounded outer/top lobe
                Polygon(                                          # wedge neck lobe -> hub
                    (0.0, 0.0),
                    (x_c, z_c - tip_r),
                    (x_c, z_c),
                    (0.0, boss_h),
                    align=None,
                )
            extrude(amount=wing_t / 2.0, both=True)               # thickness wing_t, centered on Y=0
        Cylinder(radius=bore / 2.0, height=height * 3.0, mode=Mode.SUBTRACT)   # through bore, last
    part = bp.part
    if part.volume <= 0:                         # net guard (matches the family; not is_valid)
        raise ValueError("wing_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_wing_nut.py -q`
Expected: PASS — 6 passed.

If the −X wing's `Polygon` fails to build (winding), reverse that side's point order to `(0.0, 0.0), (0.0, boss_h), (x_c, z_c), (x_c, z_c - tip_r)` for `sign == -1.0`. Re-run until green — do not weaken any assertion.

- [ ] **Step 5: Commit**

```bash
git add catalog/models/wing_nut.py catalog/tests/test_wing_nut.py
git commit -m "feat(catalog): add DIN 315 wing nut generator"
```

---

### Task 2: Register the family and add the M12 data entry

**Files:**

- Modify: `catalog/models/_registry.py`
- Create: `catalog/dimensions/wing_nuts.json`
- Test: `catalog/tests/test_wing_nuts_data.py`

**Interfaces:**

- Consumes: `wing_nut` from Task 1; `catalog.schema.validate_entry`; `catalog.models._registry.build_part`.
- Produces: `KNOWN_FAMILIES["wing_nut"]`; a `din315` entry with `shape` keys `bore, boss_d, boss_h, span, height, wing_t, tip_r`.

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_wing_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/wing_nuts.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_wing_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_all_wing_bases_are_wing_nuts():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "wing_nut", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_every_wing_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_wing_nut_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the data test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_wing_nuts_data.py -q`
Expected: FAIL — `FileNotFoundError` on `catalog/dimensions/wing_nuts.json` (the data file does not exist yet).

- [ ] **Step 3: Register the family**

In `catalog/models/_registry.py`, add the import after the `square_nut` import (line 12):

```python
from catalog.models.wing_nut import wing_nut
```

and add the entry after `"square_nut": square_nut,` in `KNOWN_FAMILIES`:

```python
    "wing_nut": wing_nut,
```

- [ ] **Step 4: Add the data entry**

Create `catalog/dimensions/wing_nuts.json`:

```json
{
	"din315": {
		"family": "wing_nut",
		"shape": {
			"bore": 10.1,
			"boss_d": 23.0,
			"boss_h": 14.0,
			"span": 65.0,
			"height": 33.5,
			"wing_t": 4.9,
			"tip_r": 10.0
		},
		"hardwareType": "nut",
		"source": "DIN 315 wing nut, German Form D 'rounded wings' (M12), current standard (DIN 315:2016-12; no ISO equivalent). Envelope confirmed vs fasteners.eu + Fuller Fasteners + schrauben-lexikon + ITA Fasteners + globalfastener DIN 315-D tables: overall height h=33.5 (max), boss/hub dia dk=23 (max), wing span e=65 (max, tip-to-tip), blade thickness g1=4.9 (max), tip radius R~10 (approximate reference, no tolerance). bore=10.1 is the M12 thread minor (ISO 724, external to DIN 315's table). boss_h=14.0 is a representative hub height (the DIN 'm' symbol 10-14, read inconsistently across sources, taken as hub height) -> form, not asserted normative; wing depth and exact rounded profile are non-tabulated form features.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "315" }]
	}
}
```

- [ ] **Step 5: Run the data test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_wing_nuts_data.py -q`
Expected: PASS — 4 passed.

- [ ] **Step 6: Run the full in-container suite to confirm nothing regressed**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — the whole catalog suite green (existing nut/washer tests unaffected).

- [ ] **Step 7: Commit**

```bash
git add catalog/models/_registry.py catalog/dimensions/wing_nuts.json catalog/tests/test_wing_nuts_data.py
git commit -m "feat(catalog): register wing_nut family and ship DIN 315 M12"
```

---

### Task 3: Build the drawing and verify invariants

**Files:**

- Create (build output): `catalog/out/din315.svg`
- Modify (build output): `catalog/out/manifest.json`

**Interfaces:**

- Consumes: everything from Tasks 1–2, `catalog/build_catalog.py` (unchanged).
- Produces: the committed `din315.svg` drawing and its manifest entry.

- [ ] **Step 1: Record the pre-build checksums of existing drawings**

Run: `sha256sum catalog/out/*.svg | sort > /tmp/pre-wing.sha`
Expected: a checksum line per existing SVG (no `din315.svg` yet).

- [ ] **Step 2: Build the catalog in-container**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: JSON report printed with `din315` in the built set and `"failed": []`.

- [ ] **Step 3: Verify existing drawings are byte-identical**

Run: `sha256sum catalog/out/*.svg | sort | grep -v 'din315.svg' > /tmp/post-wing.sha && diff /tmp/pre-wing.sha /tmp/post-wing.sha && echo IDENTICAL`
Expected: `IDENTICAL` — no existing SVG changed; only `din315.svg` is new.

- [ ] **Step 4: Verify the opt-in invariant is still 0/0**

Run: `grep -c '.svg' data/image-mappings.json src/lib/data/standards-generated.ts`
Expected: both files report `0` — no generated SVG is wired into the user-facing app.

- [ ] **Step 5: Visually confirm the butterfly framing**

Run: `./catalog/run rsvg-convert -w 520 catalog/out/din315.svg -o catalog/out/_din315_preview.png`
Then Read `catalog/out/_din315_preview.png` and confirm: a hub circle + bore + two wings edge-on in the axial view, and the rounded two-lobe butterfly (axis horizontal, central dip) in the profile view.
Then remove the preview: `rm catalog/out/_din315_preview.png`
If the framing is poor, note it in the task report (no new preset is introduced in this family — this matches the square-nut precedent).

- [ ] **Step 6: Normalize the manifest formatting**

The build serializer writes JSON with space indent; the committed manifest uses Prettier's tabs. Re-format before committing so the diff is only the new `din315` entry:

Run: `npx prettier --write catalog/out/manifest.json`
Then confirm only the `din315` entry was added: `git diff --stat catalog/out/manifest.json`
Expected: `manifest.json` shows a small insertion (the `din315` block), no churn on other entries.

- [ ] **Step 7: Commit the build output**

```bash
git add catalog/out/din315.svg catalog/out/manifest.json
git commit -m "build(catalog): render DIN 315 wing nut drawing"
```

---

## Self-Review

**1. Spec coverage:**

- New `wing_nut.py`, imports only `_MIN_WALL_MM` → Task 1. ✓
- Cylinder boss + two rounded lobes + central dip + bore, wings in XZ plane → Task 1 generator + tests. ✓
- All 7 guards (positives, wall, span>boss_d, height>boss_h, tip_r<=height/2, dip clearance, volume>0) → Task 1 code + `test_wing_nut_guards_bad_geometry`. ✓
- Register `wing_nut` → Task 2 Step 3. ✓
- `din315` M12 entry, envelope tabulated + representative fields documented → Task 2 Step 4. ✓
- Data tests (validates/builds, family/hardwareType, sourced+verified, no forbidden token) → Task 2 Step 1. ✓
- No render/preset change → build_catalog untouched (Task 3 uses it as-is). ✓
- Opt-in 0/0 → Task 3 Step 4. ✓
- Existing SVGs byte-identical → Task 3 Steps 1 & 3. ✓
- Visual butterfly framing confirm → Task 3 Step 5. ✓
- In-container everything → all runs prefixed `./catalog/run` (host-only steps are checksum/grep/prettier/git). ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows complete code; every command has expected output. ✓

**3. Type consistency:** `wing_nut(bore, boss_d, boss_h, span, height, wing_t, tip_r)` identical in the generator, both test files' fixtures, the `din315` shape keys, and the Interfaces blocks. Lobe geometry (`x_c = ±(span/2 - tip_r)`, `z_c = height - tip_r`) matches between the generator and the tests' probe coordinates. ✓
