# Plain Hexagon Nut Family — Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the plain hexagon nut family as maintainer-only generated two-view SVG technical drawings, reusing the washer catalog pipeline, without touching shipped app data.

**Architecture:** Upgrade the existing `hex_nut` generator to model the top/bottom chamfer via a revolved silhouette intersected with the hex prism (the same revolve-∩ pattern `countersunk_toothed_washer` uses). Add a nut `CameraPreset` and a per-family preset selector so `build_catalog` renders nuts flats-horizontal while washers keep their preset. Add `catalog/dimensions/nuts.json` with M12-sourced data plus fine-pitch aliases. Build in-container, assert the opt-in invariant, commit the generated SVGs + manifest.

**Tech Stack:** Python 3, build123d (OCP kernel), pytest, JSON Schema (Draft 7), Docker via `./catalog/run`.

## Global Constraints

- **Opt-in only.** Never edit `data/image-mappings.json` or `src/lib/data/standards-generated.ts`. After build, `grep -c '.svg'` on **both** must return `0`.
- **Model per FAMILY, standard = data entry.** One `hex_nut` generator; each standard is a row in `catalog/dimensions/nuts.json`.
- **Do not fabricate dimensions.** Every committed M12 value is confirmed against **≥2** manufacturer/standard tables and cited in the entry's `source` string with `verified: true`. Reference values in this plan are STARTING POINTS TO VERIFY, not gospel — correct them to what the sources say.
- **Never run `pnpm standards:build`.** Nuts touch only files under `catalog/`.
- **In-container only.** All builds/tests run via `./catalog/run …` (Docker), never against the host Python.
- **Representative size M12** for the whole family (except DIN 431 pipe nuts, which use a representative pipe size — see Task 4), matching the washer set.
- **Chamfer angle:** 30° from the bearing (end) face — the standard hex-nut chamfer.
- **Orientation:** flats-horizontal (a flat at top and bottom); across-flats `s` lies along X, across-corners `e = 2s/√3` along Y. Both views keep X vertical (the #80 height-alignment rule).
- Commit style: Conventional Commits (`feat(catalog): …`, `test(catalog): …`). Never mention AI in messages.

---

### Task 1: Chamfered `hex_nut` generator

Upgrade the Phase-0 spike (a plain prism) into a chamfered nut, oriented flats-horizontal. The old spike smoke-test asserts the _old_ corner-up extents, so it is updated here in the same task.

**Files:**

- Modify: `catalog/models/hex_nut.py` (replace the whole `hex_nut` function)
- Create: `catalog/tests/test_hex_nut.py`
- Modify: `catalog/tests/test_spike_models.py:15-24` (the `test_hex_nut_has_six_side_faces_and_a_bore` smoke test — new orientation + chamfer)
- Modify: `catalog/tests/test_families.py` (add a nut dispatch assertion)

**Interfaces:**

- Consumes: build123d (`BuildPart`, `BuildSketch`, `RegularPolygon`, `Polygon`, `Cylinder`, `Plane`, `Axis`, `Mode`, `extrude`, `revolve`).
- Produces: `hex_nut(s: float, m: float, bore: float, chamfer: float | None = None) -> Part`. `s` = across-flats, `m` = height, `bore` = drawn hole diameter, `chamfer` = chamfer-circle diameter (defaults to `s`). The returned part has axis Z, height `m` along Z, `bbox.size.X == s`, `bbox.size.Y == 2*s/√3`, and its top/bottom corners beveled at 30°. Consumed by the registry (already wired) and Task 3/4.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_hex_nut.py`:

```python
import math

import pytest

from catalog.models.hex_nut import hex_nut

S = 18.0   # M12 ISO 4032 across-flats (illustrative fixture, not shipped data)
M = 10.8
BORE = 10.2
CIRCUMRADIUS = S / math.sqrt(3.0)          # corner radius
ACROSS_CORNERS = 2.0 * CIRCUMRADIUS


def test_hex_nut_is_flats_horizontal_with_correct_extents():
    part = hex_nut(s=S, m=M, bore=BORE)
    bb = part.bounding_box()
    assert round(bb.size.X, 2) == round(S, 2)               # flats top/bottom -> across-flats on X
    assert round(bb.size.Y, 2) == round(ACROSS_CORNERS, 2)  # corners left/right -> across-corners on Y
    assert round(bb.size.Z, 2) == round(M, 2)               # height along Z
    assert part.volume > 0


def test_hex_nut_has_an_open_bore():
    part = hex_nut(s=S, m=M, bore=BORE)
    # A ring of material only: volume is far below a solid hex prism of the same envelope.
    hex_area = (math.sqrt(3.0) / 2.0) * S * S                # regular hexagon, across-flats S
    solid_prism = hex_area * M
    bore_col = math.pi * (BORE / 2.0) ** 2 * M
    assert part.volume < solid_prism - bore_col * 0.9        # the bore removed roughly a full column


def test_hex_nut_top_face_is_chamfered():
    # The chamfer bevels the corners at the top and bottom faces: vertices near the end
    # faces sit at the chamfer radius (~s/2), well inside the full corner radius at mid-height.
    part = hex_nut(s=S, m=M, bore=BORE)
    verts = list(part.vertices())
    top = [v for v in verts if v.Z > M - 0.2]
    assert top, "expected vertices on the top face"
    top_max_r = max(math.hypot(v.X, v.Y) for v in top)
    # a plain (unchamfered) prism would have top corners out at the circumradius;
    # the chamfer pulls them in to ~s/2, so the top radius is clearly smaller.
    assert top_max_r < CIRCUMRADIUS - 0.3


def test_hex_nut_chamfer_removes_material_vs_a_plain_prism():
    from build123d import BuildPart, BuildSketch, RegularPolygon, Cylinder, extrude, Mode

    def plain_prism(s, m, bore):
        with BuildPart() as bp:
            with BuildSketch():
                RegularPolygon(radius=s / math.sqrt(3.0), side_count=6)
            extrude(amount=m)
            Cylinder(radius=bore / 2, height=m * 3, mode=Mode.SUBTRACT)
        return bp.part

    chamfered = hex_nut(s=S, m=M, bore=BORE)
    prism = plain_prism(S, M, BORE)
    assert chamfered.volume < prism.volume       # chamfer shaves the eight corners


def test_hex_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        hex_nut(s=0.0, m=M, bore=BORE)           # zero across-flats
    with pytest.raises(ValueError):
        hex_nut(s=S, m=0.0, bore=BORE)           # zero height
    with pytest.raises(ValueError):
        hex_nut(s=S, m=M, bore=S)                # bore >= across-flats: no wall left
    with pytest.raises(ValueError):
        hex_nut(s=S, m=M, bore=BORE, chamfer=S * 3)   # chamfer circle wider than the corners
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_hex_nut.py -v`
Expected: FAIL — the current `hex_nut` has no `chamfer` param, is corner-up (X extent ≈ across-corners, not `s`), and no guards (raises nothing).

- [ ] **Step 3: Replace the generator**

Replace the entire body of `catalog/models/hex_nut.py` with:

```python
"""Hex nut family generator: a chamfered hexagonal nut with a central bore."""
import math

from build123d import (
    BuildPart, BuildSketch, RegularPolygon, Polygon, Cylinder,
    Plane, Axis, Mode, extrude, revolve,
)

# Standard hex-nut chamfer angle, measured from the flat bearing (end) face.
_CHAMFER_ANGLE_DEG = 30.0


def hex_nut(s: float, m: float, bore: float, chamfer: float | None = None):
    """Chamfered hex nut: across-flats ``s``, height ``m``, drawn bore ``bore``.

    ``chamfer`` is the chamfer-circle diameter the top/bottom bevel starts from
    (the flat end-face circle); by ISO it equals the across-flats ``s``, so it
    defaults to ``s``. The nut is oriented flats-horizontal: a flat lies at the
    top and bottom (``s`` along X), corners left and right (``2s/√3`` along Y),
    height along Z.

    Built as a revolved silhouette (a full-radius body coned down to the chamfer
    circle at each end face) intersected with the hex prism, so the cone bevels
    only the eight corners — producing the arcs across the flats in the face view.
    Revolved surfaces project cleanly (swept/filleted edges can leave a seam).
    """
    if s <= 0 or m <= 0 or bore <= 0:
        raise ValueError(f"hex_nut: need s, m, bore > 0, got s={s}, m={m}, bore={bore}")
    chamfer_d = s if chamfer is None else chamfer
    circumradius = s / math.sqrt(3.0)          # hex corner radius (across-corners / 2)
    r_flat = chamfer_d / 2.0                    # radius of the flat end-face circle
    if bore >= s:
        raise ValueError(f"hex_nut: bore {bore} leaves no wall (>= across-flats {s})")
    if not (0 < r_flat < circumradius):
        raise ValueError(
            f"hex_nut: chamfer circle radius {r_flat} must sit between 0 and the "
            f"corner radius {circumradius:.3f}")
    rise = (circumradius - r_flat) * math.tan(math.radians(_CHAMFER_ANGLE_DEG))
    if 2 * rise >= m:
        raise ValueError(
            f"hex_nut: chamfers ({2 * rise:.3f}) do not fit in height {m}")

    # Silhouette in the XZ half-plane (x = radius, y = height), revolved about Z.
    # Full corner radius at mid-height; coned in to r_flat at each end face.
    profile = [
        (0.0, 0.0),
        (r_flat, 0.0),
        (circumradius, rise),
        (circumradius, m - rise),
        (r_flat, m),
        (0.0, m),
    ]
    # Rotate the hex 30° so a flat (not a corner) points along +X -> flats-horizontal.
    with BuildPart() as bp:
        with BuildSketch():
            RegularPolygon(radius=circumradius, side_count=6, rotation=30)
        extrude(amount=m)
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)
        revolve(axis=Axis.Z, revolution_arc=360, mode=Mode.INTERSECT)
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)
    part = bp.part
    if part.volume <= 0:                        # guard on volume, not is_valid (sewn-shell gotcha)
        raise ValueError("hex_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_hex_nut.py -v`
Expected: PASS (5 tests). If the `revolve … Mode.INTERSECT` orientation or `Polygon` winding trips the kernel, adjust the profile winding/`align` until the extents assert; the intended solid is unambiguous.

- [ ] **Step 5: Update the spike smoke-test to the new orientation**

In `catalog/tests/test_spike_models.py`, replace `test_hex_nut_has_six_side_faces_and_a_bore` with:

```python
def test_hex_nut_has_six_side_faces_and_a_bore():
    import math
    from catalog.models.hex_nut import hex_nut

    part = hex_nut(s=34.0, m=8.5, bore=20.96)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == 8.5
    # flats-horizontal: X extent is across-flats (34), Y extent is across-corners (~39.3)
    assert round(bb.size.X, 1) == 34.0
    assert round(bb.size.Y, 1) == round(2 * 34.0 / math.sqrt(3.0), 1)
    assert part.volume > 0
```

- [ ] **Step 6: Add a registry dispatch assertion**

In `catalog/tests/test_families.py`, append:

```python
def test_hex_nut_dispatches_via_registry():
    from catalog.models._registry import build_part

    part = build_part("hex_nut", {"s": 18.0, "m": 10.8, "bore": 10.2})
    assert part.volume > 0
    assert round(part.bounding_box().size.X, 1) == 18.0   # across-flats on X
```

- [ ] **Step 7: Run the touched test files**

Run: `./catalog/run pytest catalog/tests/test_hex_nut.py catalog/tests/test_spike_models.py catalog/tests/test_families.py -v`
Expected: PASS (all).

- [ ] **Step 8: Commit**

```bash
git add catalog/models/hex_nut.py catalog/tests/test_hex_nut.py catalog/tests/test_spike_models.py catalog/tests/test_families.py
git commit -m "feat(catalog): model the chamfer on the hex nut generator"
```

---

### Task 2: Nut render preset and per-family preset selection

`build_catalog` currently hardcodes `render_two_views(part, DEFAULT_AXIS_Z, …)` for every entry. Add a nut preset and a family→preset selector so nuts render with their own preset while washers are unchanged.

**Files:**

- Modify: `catalog/render.py` (add `NUT_PRESET` + `preset_for_family`)
- Modify: `catalog/build_catalog.py:9` (import) and `:51` (the `render_two_views` call)
- Modify: `catalog/tests/test_render.py` (preset selection + nut face render)

**Interfaces:**

- Consumes: `hex_nut` (Task 1), existing `CameraPreset`, `render_two_views`, `DEFAULT_AXIS_Z`.
- Produces: `NUT_PRESET: CameraPreset` and `preset_for_family(family: str) -> CameraPreset` (returns `NUT_PRESET` for `"nut"`, else `DEFAULT_AXIS_Z`). Consumed by `build_catalog.build`.

- [ ] **Step 1: Write the failing tests**

In `catalog/tests/test_render.py`, append:

```python
def test_preset_for_family_selects_the_nut_preset():
    from catalog.render import preset_for_family, NUT_PRESET, DEFAULT_AXIS_Z

    assert preset_for_family("nut") is NUT_PRESET
    assert preset_for_family("flat_washer") is DEFAULT_AXIS_Z
    assert preset_for_family("anything-else") is DEFAULT_AXIS_Z


def test_nut_preset_renders_two_height_aligned_views(tmp_path):
    import re
    from catalog.models.hex_nut import hex_nut
    from catalog.render import render_two_views, NUT_PRESET

    part = hex_nut(s=18.0, m=10.8, bore=10.2)
    out = tmp_path / "nut.svg"
    render_two_views(part, NUT_PRESET, str(out))

    text = out.read_text()
    assert out.exists()
    assert "Visible" in text and "Hidden" in text and "Center" in text
    # Two views side by side: wider than a single face view of an 18mm-across-flats nut.
    vb = re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+"', text)
    assert vb is not None and float(vb.group(1)) > 20.0
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_render.py -k "preset_for_family or nut_preset" -v`
Expected: FAIL — `NUT_PRESET` / `preset_for_family` do not exist yet.

- [ ] **Step 3: Add the preset and selector**

In `catalog/render.py`, immediately after the `DEFAULT_AXIS_Z = CameraPreset(...)` block, add:

```python
# Nuts share the washer camera geometry: look down the axis for the hex face view,
# look along -Y for the profile, X vertical in both so the two views are height-aligned
# (the orthographic-projection rule). The hex itself is oriented flats-horizontal by the
# generator, so no preset change is needed beyond reusing these axes.
NUT_PRESET = DEFAULT_AXIS_Z


def preset_for_family(family: str) -> CameraPreset:
    """Camera preset for a family. Nuts use NUT_PRESET; everything else the default."""
    return NUT_PRESET if family == "nut" else DEFAULT_AXIS_Z
```

- [ ] **Step 4: Wire the selector into the build**

In `catalog/build_catalog.py`, change the import on line 9 from:

```python
from catalog.render import render_two_views, DEFAULT_AXIS_Z
```

to:

```python
from catalog.render import render_two_views, preset_for_family
```

Then in the pass-1 loop, replace:

```python
            part = build_part(entry["family"], entry["shape"])
            svg_path = out / f"{sid}.svg"
            render_two_views(part, DEFAULT_AXIS_Z, str(svg_path))
```

with:

```python
            part = build_part(entry["family"], entry["shape"])
            svg_path = out / f"{sid}.svg"
            render_two_views(part, preset_for_family(entry["family"]), str(svg_path))
```

- [ ] **Step 5: Run the render + build-catalog tests**

Run: `./catalog/run pytest catalog/tests/test_render.py catalog/tests/test_build_catalog.py -v`
Expected: PASS (existing washer/build tests still green — `preset_for_family("flat_washer")` returns the same `DEFAULT_AXIS_Z` they used before).

- [ ] **Step 6: Commit**

```bash
git add catalog/render.py catalog/build_catalog.py catalog/tests/test_render.py
git commit -m "feat(catalog): add nut render preset and per-family preset selection"
```

---

### Task 3: Nut build integration test (a nut flows end-to-end through `build`)

Prove a nut-shaped data entry renders an SVG and lands in the manifest, using the real registry + preset selection.

**Files:**

- Modify: `catalog/tests/test_build_catalog.py` (add one nut integration test)

**Interfaces:**

- Consumes: `catalog.build_catalog.build`, `hex_nut`, `preset_for_family` (Tasks 1-2).
- Produces: nothing new — a regression gate that nuts build through the pipeline.

- [ ] **Step 1: Write the failing test**

In `catalog/tests/test_build_catalog.py`, append:

```python
def test_build_renders_a_hex_nut_entry(tmp_path: Path):
    from catalog.build_catalog import build

    dims = tmp_path / "dimensions"
    dims.mkdir()
    (dims / "nuts.json").write_text(json.dumps({
        "iso4032": {
            "family": "hex_nut",
            "shape": {"s": 18.0, "m": 10.8, "bore": 10.2},
            "hardwareType": "nut",
            "source": "ISO 4032 (M12) — fixture",
            "verified": False,
            "designations": [{"system": "ISO", "code": "4032"}],
        }
    }))
    out = tmp_path / "out"
    manifest = tmp_path / "manifest.json"

    report = build(str(dims), str(out), str(manifest))

    assert report["ok"] == ["iso4032"]
    assert (out / "iso4032.svg").exists()
    m = json.loads(manifest.read_text())["standards"]
    assert m["iso4032"]["family"] == "nut" or m["iso4032"]["svg"] == "iso4032.svg"
    assert len(m["iso4032"]["sha256"]) == 64
```

Note: the manifest stores `family` from `entry["family"]` (which is `"hex_nut"`), so assert on the SVG filename primarily; the `or` keeps the test robust if the family label is later normalized.

- [ ] **Step 2: Run the test to verify it fails, then passes**

Run: `./catalog/run pytest catalog/tests/test_build_catalog.py::test_build_renders_a_hex_nut_entry -v`
Expected: with Tasks 1-2 merged this should PASS immediately (the pipeline already supports it). If it fails, the failure pinpoints a wiring gap in Task 2 — fix there. This test's value is as a permanent regression gate.

- [ ] **Step 3: Commit**

```bash
git add catalog/tests/test_build_catalog.py
git commit -m "test(catalog): cover a hex nut flowing through the build pipeline"
```

---

### Task 4: `nuts.json` data with sourced M12 dimensions

Add the data rows. **This task's core work is dimensional research** — every committed number is confirmed against ≥2 tables and cited. The reference values below are starting points to verify, not final data.

**Files:**

- Create: `catalog/dimensions/nuts.json`
- Create: `catalog/tests/test_nuts_data.py`

**Interfaces:**

- Consumes: `validate_entry` (schema + family check), `build_part` (must build without raising), `hex_nut`.
- Produces: `catalog/dimensions/nuts.json` — the family data file `build_catalog` picks up automatically (it globs `*.json` skipping `_`-prefixed).

**Distinct drawings (verify each `s`, `m`, `bore` against ≥2 of: Fasteners.eu, Würth-class distributor tables, the DIN/ISO dimensional table):**

| id         | standard                   | reference s | reference m | reference bore | note                                                                                   |
| ---------- | -------------------------- | ----------: | ----------: | -------------: | -------------------------------------------------------------------------------------- |
| `iso4032`  | ISO 4032 regular (style 1) |        18.0 |        10.8 |           10.2 | bore = M12 minor dia (drawn hole)                                                      |
| `iso4033`  | ISO 4033 high (style 2)    |        18.0 |        12.0 |           10.2 | verify m (style-2 height)                                                              |
| `iso4035`  | ISO 4035 thin (style 0)    |        18.0 |         6.0 |           10.2 |                                                                                        |
| `din6330`  | DIN 6330 high 1.5 d        |        18.0 |        18.0 |           10.2 | m = 1.5·12; verify s (18 vs 19)                                                        |
| `din80705` | DIN 80705 thin small-AF    |      verify |      verify |           10.2 | small across-flats; distinct **unless** dims match a base                              |
| `din936`   | DIN 936 thin/jam           |      verify |      verify |           10.2 | thicker than ISO 4035 thin — likely distinct, **not** an alias; confirm                |
| `din431`   | DIN 431 pipe nut           |      verify |      verify |         verify | pipe thread, NOT M12 — pick a representative pipe size (e.g. G 1/4) and source its row |

**Aliases (only if verification confirms identical geometry to the base within rounding):**

| id        | alias_of  | reason                                                               |
| --------- | --------- | -------------------------------------------------------------------- |
| `iso8673` | `iso4032` | fine-pitch regular; same body, thread pitch invisible at label scale |
| `iso8674` | `iso4033` | fine-pitch high                                                      |
| `iso8675` | `iso4035` | fine-pitch thin                                                      |

> **Alias rule:** a standard is an alias ONLY when its sourced `(s, m, bore)` equal a rendered base within rounding. `din936` and `din80705` default to **distinct drawings**; promote to `alias_of` only if the sourced numbers match a base. The fine-pitch ISO 867x aliases are safe because they differ from their coarse twins only in thread pitch.

- [ ] **Step 1: Write the failing data tests**

Create `catalog/tests/test_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/nuts.json")


def test_every_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 6                       # the distinct drawings at minimum
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue                               # aliases carry no geometry
        build_part(entry["family"], entry["shape"])   # must build without raising
    assert problems == []


def test_all_nut_bases_are_hex_nuts():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "hex_nut", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_nut_aliases_point_at_real_non_alias_bases():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" not in entry:
            continue
        target = entry["alias_of"]
        assert target in entries, f"{sid}: alias_of '{target}' unknown"
        assert "alias_of" not in entries[target], f"{sid}: alias points at another alias"


def test_every_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_nuts_data.py -v`
Expected: FAIL — `catalog/dimensions/nuts.json` does not exist.

- [ ] **Step 3: Research and record dimensions**

For each distinct drawing above, open **≥2** source tables, confirm `s` / `m` (and the representative pipe size for DIN 431), and write the confirmed numbers. If a "distinct-or-alias" candidate's numbers match a base within rounding, make it an `alias_of`; otherwise a distinct row. Record where each number came from in the `source` string (e.g. `"ISO 4032:2012 (M12), s/m confirmed vs Fasteners.eu + Würth catalogue"`).

Do NOT commit a number you could not confirm in ≥2 places — drop that standard to a follow-up instead (like the deliberate washer gaps) and note it in the commit body.

- [ ] **Step 4: Write `catalog/dimensions/nuts.json`**

Create the file with the confirmed data. Skeleton (fill `s`/`m`/`bore` with VERIFIED values and complete the `source` citations; add/remove rows per Step 3 findings):

```json
{
	"iso4032": {
		"family": "hex_nut",
		"shape": { "s": 18.0, "m": 10.8, "bore": 10.2 },
		"hardwareType": "nut",
		"source": "ISO 4032 (M12); s/m confirmed vs <table A> + <table B>",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "4032" }]
	},
	"iso4033": {
		"family": "hex_nut",
		"shape": { "s": 18.0, "m": 12.0, "bore": 10.2 },
		"hardwareType": "nut",
		"source": "ISO 4033 (M12, style 2); s/m confirmed vs <table A> + <table B>",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "4033" }]
	},
	"iso4035": {
		"family": "hex_nut",
		"shape": { "s": 18.0, "m": 6.0, "bore": 10.2 },
		"hardwareType": "nut",
		"source": "ISO 4035 (M12, style 0); s/m confirmed vs <table A> + <table B>",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "4035" }]
	},
	"din6330": {
		"family": "hex_nut",
		"shape": { "s": 18.0, "m": 18.0, "bore": 10.2 },
		"hardwareType": "nut",
		"source": "DIN 6330 (M12, height 1.5d); s/m confirmed vs <table A> + <table B>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "6330" }]
	},
	"din936": {
		"family": "hex_nut",
		"shape": { "s": 18.0, "m": 8.0, "bore": 10.2 },
		"hardwareType": "nut",
		"source": "DIN 936 (M12, thin/jam); s/m confirmed vs <table A> + <table B>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "936" }]
	},
	"din80705": {
		"family": "hex_nut",
		"shape": { "s": 17.0, "m": 6.0, "bore": 10.2 },
		"hardwareType": "nut",
		"source": "DIN 80705 (M12, thin small-AF); s/m confirmed vs <table A> + <table B>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "80705" }]
	},
	"din431": {
		"family": "hex_nut",
		"shape": { "s": 22.0, "m": 8.0, "bore": 13.16 },
		"hardwareType": "nut",
		"source": "DIN 431 pipe nut (representative G1/4); s/m/bore confirmed vs <table A> + <table B>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "431" }]
	},
	"iso8673": {
		"alias_of": "iso4032",
		"hardwareType": "nut",
		"source": "ISO 8673 = ISO 4032 regular nut with fine pitch; body geometry identical, aliased to the base drawing.",
		"designations": [{ "system": "ISO", "code": "8673" }]
	},
	"iso8674": {
		"alias_of": "iso4033",
		"hardwareType": "nut",
		"source": "ISO 8674 = ISO 4033 high nut with fine pitch; identical body, aliased to the base.",
		"designations": [{ "system": "ISO", "code": "8674" }]
	},
	"iso8675": {
		"alias_of": "iso4035",
		"hardwareType": "nut",
		"source": "ISO 8675 = ISO 4035 thin nut with fine pitch; identical body, aliased to the base.",
		"designations": [{ "system": "ISO", "code": "8675" }]
	}
}
```

- [ ] **Step 5: Run the data tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_nuts_data.py -v`
Expected: PASS (4 tests). If a `build_part` raises, the geometry values violate a `hex_nut` guard (e.g. `bore >= s`) — recheck the sourced numbers.

- [ ] **Step 6: Commit**

```bash
git add catalog/dimensions/nuts.json catalog/tests/test_nuts_data.py
git commit -m "feat(catalog): add plain hex nut family data (M12, sourced)"
```

---

### Task 5: In-container build, opt-in gate, and manifest commit

Generate the real SVGs + manifest entries, prove the opt-in invariant holds, and commit the artifacts.

**Files:**

- Generated: `catalog/out/*.svg` (new nut drawings), `catalog/out/manifest.json` (updated)

**Interfaces:**

- Consumes: everything from Tasks 1-4.
- Produces: committed generated assets (maintainer-only; never referenced by shipped app data).

- [ ] **Step 1: Run the full catalog test suite in-container**

Run: `./catalog/run pytest catalog/tests -q`
Expected: PASS (all washer tests + the new nut tests).

- [ ] **Step 2: Build the catalog in-container**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: JSON report on stdout with the new nut ids under `ok` and an empty `failed` list. New `catalog/out/iso4032.svg` etc. exist; aliases (`iso8673`…) appear in the manifest pointing at their base SVG with no new file.

- [ ] **Step 3: Verify the opt-in invariant (the hard gate)**

Run:

```bash
echo "image-mappings svg refs: $(grep -c '\.svg' data/image-mappings.json)"
echo "standards-generated svg refs: $(grep -c '\.svg' src/lib/data/standards-generated.ts)"
```

Expected: both `0`. If either is non-zero, STOP — a nut leaked into shipped app data; revert that change. Nuts must live only in `catalog/out/manifest.json`.

- [ ] **Step 4: Sanity-check the manifest diff**

Run: `git status --porcelain catalog/out && git diff --stat catalog/out/manifest.json`
Expected: only new nut `.svg` files and manifest additions for the nut ids. If washer SVGs changed, the preset selection accidentally altered washer rendering — investigate Task 2 before committing. (Manifest key order is stable: `build` writes `sort_keys=True`.)

- [ ] **Step 5: Normalize manifest formatting and commit the artifacts**

```bash
npx prettier --write catalog/out/manifest.json
git add catalog/out
git commit -m "feat(catalog): generate plain hex nut family drawings"
```

- [ ] **Step 6: Visual check (manual, non-blocking)**

Start the dev server (`pnpm dev`) and open `/dev/asset-compare`; filter to the nut ids and confirm each generated hex nut reads flats-horizontal with chamfer arcs and centerlines, beside its legacy PNG. Legacy nuts stay the app default — this page is the only place the generated nuts appear.

---

## Post-implementation (outside the task loop)

- Push the branch, open the PR (What/Why/How + Test plan, per the repo conventions).
- Run `zen codereview` with `deepseek/deepseek-v4-pro` (thinking=high) on the generator + render preset (shared code surfaces); apply findings as follow-up commits.
- Wait for CI green on the latest commit, then squash-merge (admin bypass authorized).
- Update the project memory (`catalog-epic-approach.md`) with the nut family result and any new gotchas.

## Coverage note

This spec covers only the plain hex family (~10 of 47 nut standards). The remaining nut standards (flange, castle, cap, square, wing, knurled, round/slotted-round, prevailing-torque) stay uncovered by design — each is a future spec. Do NOT add the nut coverage gate (`qa/coverage.py … "nut"`) to CI; it would fail on the intentional gaps, exactly as the washer gate only runs manually.

---

## Self-Review

**Spec coverage:**

- Plain hex family drawings → Tasks 1, 4. ✓
- Chamfer (revolve ∩ hex, 30°) → Task 1. ✓
- Flats-horizontal orientation, height alignment → Tasks 1 (generator rotation) + 2 (preset). ✓
- `nuts.json`, M12, sourced ≥2 tables, aliases → Task 4. ✓
- Registry dispatch (already wired) → asserted in Task 1 Step 6. ✓
- build_catalog picks up `nuts.json` (auto-glob) + nut preset → Task 2. ✓
- In-container build, opt-in 0/0 gate, manifest commit → Task 5. ✓
- `/dev/asset-compare` visual check → Task 5 Step 6. ✓
- Tests mirror washer structure → Tasks 1, 3, 4. ✓

**Placeholder scan:** Reference dimensions are explicitly flagged "verify against ≥2 tables" with a research step (Task 4 Step 3) that produces the committed numbers — this is the don't-fabricate discipline, not a lazy placeholder. `<table A>/<table B>` in the JSON are filled during Step 3. No other TBDs.

**Type consistency:** `hex_nut(s, m, bore, chamfer=None)` used identically in Tasks 1, 3, 4. `preset_for_family(family)` and `NUT_PRESET` used identically in Tasks 2, 3. `build(dims, out, manifest)` signature matches the existing code. Manifest stores `family` from `entry["family"]` (`"hex_nut"`) — Task 3's assertion accounts for this. ✓
