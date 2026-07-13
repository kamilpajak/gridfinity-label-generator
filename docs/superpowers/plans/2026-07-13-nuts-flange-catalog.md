# Conical Flange Nut Family — Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the conical flange nut family (DIN 6923 + prevailing-torque/weld variants) as maintainer-only generated two-view SVG drawings, reusing the plain-hex nut pipeline.

**Architecture:** Extract the chamfered vertex-up hex body from `hex_nut` into a shared `_chamfered_hex_solid(s, m, chamfer)` helper (behavior-preserving), then add a `flange_nut` generator = helper + a revolved conical flange unioned at the base + bore. Register the family, add sourced M12 data, build in-container. No render change — flange nuts are `hardwareType: "nut"` and already receive the vertex-up `NUT_PRESET`.

**Tech Stack:** Python 3, build123d (OCP kernel), pytest, JSON Schema (Draft 7), Docker via `./catalog/run`.

## Global Constraints

- **Opt-in only.** Never edit `data/image-mappings.json` or `src/lib/data/standards-generated.ts`. After build, `grep -c '.svg'` on **both** returns `0`.
- **Model per FAMILY, standard = data entry.** One `flange_nut` generator; standards are rows in `catalog/dimensions/flange_nuts.json`.
- **Do not fabricate dimensions.** Every tabulated M12 value (`s`, `m`, `d_flange`, `flange_thickness`, `bore`) is confirmed against **≥2** tables and cited with `verified: true`. Only the internal flange-cone rise (rarely tabulated) may be representative, noted in `source`. Reference values in this plan are STARTING POINTS TO VERIFY.
- **Never run `pnpm standards:build`.** Touch only files under `catalog/`.
- **In-container only** via `./catalog/run …` (Docker). Never host Python.
- **Representative size M12.**
- **Vertex-up orientation** inherited from `_chamfered_hex_solid` (a corner on +X).
- **The refactor must be behavior-preserving:** `hex_nut`'s existing tests stay green and the committed plain-hex SVGs (`iso4032`, `iso4033`, `iso4035`, `din6330`, `din936`, `din80705`, `din431`) remain byte-identical after rebuild.
- Conventional Commits, imperative, never mention AI.

---

### Task 1: Extract `_chamfered_hex_solid` helper (behavior-preserving refactor)

Pull the chamfered vertex-up hex body (everything except the bore) out of `hex_nut` into a module-level helper so `flange_nut` can reuse it. `hex_nut`'s observable behavior is unchanged.

**Files:**

- Modify: `catalog/models/hex_nut.py`
- Modify: `catalog/tests/test_hex_nut.py` (add one helper test; existing tests unchanged)

**Interfaces:**

- Consumes: build123d.
- Produces: `_chamfered_hex_solid(s: float, m: float, chamfer: float | None = None) -> Part` — the vertex-up chamfered hexagonal solid (no bore), `bbox.size.X == 2s/√3` (across-corners), `bbox.size.Y == s`, `bbox.size.Z == m`. Consumed by `hex_nut` (this task) and `flange_nut` (Task 2).

- [ ] **Step 1: Write the failing test for the helper**

Append to `catalog/tests/test_hex_nut.py`:

```python
def test_chamfered_hex_solid_is_a_solid_hex_with_no_bore():
    import math
    from catalog.models.hex_nut import _chamfered_hex_solid, hex_nut

    solid = _chamfered_hex_solid(s=S, m=M)
    bb = solid.bounding_box()
    assert round(bb.size.X, 2) == round(ACROSS_CORNERS, 2)   # vertex-up: corners on X
    assert round(bb.size.Y, 2) == round(S, 2)                # flats on Y
    assert round(bb.size.Z, 2) == round(M, 2)
    # No bore: the solid body holds more material than the same nut with a hole.
    assert solid.volume > hex_nut(s=S, m=M, bore=BORE).volume
```

- [ ] **Step 2: Run it to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_hex_nut.py::test_chamfered_hex_solid_is_a_solid_hex_with_no_bore -v`
Expected: FAIL — `_chamfered_hex_solid` does not exist yet.

- [ ] **Step 3: Refactor `hex_nut.py`**

Replace the body of `catalog/models/hex_nut.py` from the imports down with:

```python
"""Hex nut family generator: a chamfered hexagonal nut with a central bore."""
import math

from build123d import (
    BuildPart, BuildSketch, RegularPolygon, Polygon, Cylinder,
    Plane, Axis, Mode, extrude, revolve, add,
)

# Standard hex-nut chamfer angle (ISO 4032 and its family), measured from the
# flat bearing (end) face. A non-standard nut needing a different angle would
# pass its own value rather than change this constant.
_CHAMFER_ANGLE_DEG = 30.0

# Leave at least this much wall between the bore and the across-flats faces, so a
# near-tangent bore cannot leave a razor-thin sliver the volume check would miss.
_MIN_WALL_MM = 0.1


def _chamfered_hex_solid(s: float, m: float, chamfer: float | None = None):
    """The vertex-up chamfered hexagonal body (no bore), shared by hex_nut and flange_nut.

    across-flats ``s``, height ``m``, top/bottom chamfer from the ``chamfer``-diameter
    circle (defaults to ``s``). Oriented vertex-up: a corner points along +X (the view's
    up axis), flats on the left/right (``s`` along Y), across-corners (``2s/√3``) along X.
    Built as a revolved silhouette (full corner radius coned to the chamfer circle at each
    end face) intersected with the hex prism, so only the corners are beveled.
    """
    if s <= 0 or m <= 0:
        raise ValueError(f"chamfered hex: need s, m > 0, got s={s}, m={m}")
    chamfer_d = s if chamfer is None else chamfer
    circumradius = s / math.sqrt(3.0)          # hex corner radius (across-corners / 2)
    r_flat = chamfer_d / 2.0                    # radius of the flat end-face circle
    if not (0 < r_flat < circumradius):
        raise ValueError(
            f"chamfered hex: chamfer circle radius {r_flat} must sit between 0 and the "
            f"corner radius {circumradius:.3f}")
    rise = (circumradius - r_flat) * math.tan(math.radians(_CHAMFER_ANGLE_DEG))
    if 2 * rise >= m:
        raise ValueError(f"chamfered hex: chamfers ({2 * rise:.3f}) do not fit in height {m}")

    profile = [
        (0.0, 0.0),
        (r_flat, 0.0),
        (circumradius, rise),
        (circumradius, m - rise),
        (r_flat, m),
        (0.0, m),
    ]
    # rotation=0: a vertex (corner) points along +X, the view's up axis -> vertex-up.
    with BuildPart() as bp:
        with BuildSketch():
            RegularPolygon(radius=circumradius, side_count=6, rotation=0)
        extrude(amount=m)
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)
        revolve(axis=Axis.Z, revolution_arc=360, mode=Mode.INTERSECT)
    return bp.part


def hex_nut(s: float, m: float, bore: float, chamfer: float | None = None):
    """Chamfered hex nut: across-flats ``s``, height ``m``, drawn bore ``bore``.

    ``chamfer`` is the chamfer-circle diameter the top/bottom bevel starts from; by ISO
    it equals the across-flats ``s``, so it defaults to ``s``. Vertex-up, matching the
    legacy nut drawings. See ``_chamfered_hex_solid`` for the body construction.
    """
    if bore <= 0:
        raise ValueError(f"hex_nut: need bore > 0, got {bore}")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"hex_nut: bore {bore} leaves too thin a wall (needs to be under "
            f"across-flats {s} by at least {_MIN_WALL_MM} mm)")
    hex_solid = _chamfered_hex_solid(s, m, chamfer)   # validates s, m, chamfer geometry
    with BuildPart() as bp:
        add(hex_solid)
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)
    part = bp.part
    if part.volume <= 0:                        # guard on volume, not is_valid (sewn-shell gotcha)
        raise ValueError("hex_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Run the hex_nut tests to verify they pass (behavior preserved)**

Run: `./catalog/run pytest catalog/tests/test_hex_nut.py -v`
Expected: PASS — the new helper test plus all pre-existing `hex_nut` tests (extents, open bore, chamfer, guards). If a guard test now raises a different message that a test asserted on, keep the test asserting only `pytest.raises(ValueError)` (they already do).

- [ ] **Step 5: Confirm the plain-hex drawings are byte-identical**

Rebuild and confirm the refactor changed no rendered output:

```bash
./catalog/run python -m catalog.build_catalog
git status --porcelain catalog/out
```

Expected: **empty** `git status` for `catalog/out` (no SVG or manifest change). If any plain-hex SVG changed, the refactor altered geometry — STOP and reconcile before committing.

- [ ] **Step 6: Commit**

```bash
git add catalog/models/hex_nut.py catalog/tests/test_hex_nut.py
git commit -m "refactor(catalog): extract shared chamfered-hex-solid helper from hex_nut"
```

---

### Task 2: `flange_nut` generator + registry

**Files:**

- Create: `catalog/models/flange_nut.py`
- Modify: `catalog/models/_registry.py`
- Create: `catalog/tests/test_flange_nut.py`
- Modify: `catalog/tests/test_families.py` (add a dispatch case)

**Interfaces:**

- Consumes: `_chamfered_hex_solid(s, m, chamfer)` (Task 1); build123d.
- Produces: `flange_nut(s, m, bore, d_flange, flange_thickness, chamfer=None) -> Part` — a vertex-up chamfered hex body with a conical flange (outer diameter `d_flange`, rim thickness `flange_thickness`) unioned at the base and the bore subtracted. `bbox.size.X == bbox.size.Y == d_flange` (the flange is the widest, circular), `bbox.size.Z == m`. Registered under key `"flange_nut"`. Consumed by the data (Task 3).

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_flange_nut.py`:

```python
import math

import pytest

from catalog.models.flange_nut import flange_nut

S = 18.0            # M12 across-flats
M = 15.0            # total height (illustrative fixture, not shipped data)
BORE = 10.1
D_FLANGE = 26.0
FLANGE_T = 2.6
CIRCUMRADIUS = S / math.sqrt(3.0)


def _radii(part):
    return [math.hypot(v.X, v.Y) for v in part.vertices()]


def test_flange_nut_flange_is_wider_than_the_hex():
    part = flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    bb = part.bounding_box()
    # The circular flange is the widest feature: both plan extents equal d_flange.
    assert round(bb.size.X, 1) == round(D_FLANGE, 1)
    assert round(bb.size.Y, 1) == round(D_FLANGE, 1)
    # and it reaches past the hex corners.
    assert max(_radii(part)) > CIRCUMRADIUS + 0.5
    assert round(bb.size.Z, 1) == round(M, 1)
    assert part.volume > 0


def test_flange_nut_flange_sits_at_the_base():
    # The widest ring of vertices is near the bearing face (z ~ 0), not the top.
    part = flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    rim = [v for v in part.vertices() if math.hypot(v.X, v.Y) > CIRCUMRADIUS + 0.5]
    assert rim, "expected flange-rim vertices beyond the hex corners"
    assert min(v.Z for v in rim) < FLANGE_T + 0.5      # rim lives at the bottom


def test_flange_nut_has_an_open_bore():
    solid = flange_nut(s=S, m=M, bore=0.001, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    holed = flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    assert holed.volume < solid.volume                 # the bore removes material


def test_flange_nut_top_is_a_chamfered_hex():
    # Near the top face the section is the hex (bounded by the corner circle), not the flange.
    part = flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    top = [math.hypot(v.X, v.Y) for v in part.vertices() if v.Z > M - 0.2]
    assert top and max(top) <= CIRCUMRADIUS + 0.01     # top is within the hex, not the flange


def test_flange_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        flange_nut(s=0.0, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    with pytest.raises(ValueError):
        flange_nut(s=S, m=M, bore=S, d_flange=D_FLANGE, flange_thickness=FLANGE_T)       # bore too big
    with pytest.raises(ValueError):
        flange_nut(s=S, m=M, bore=BORE, d_flange=CIRCUMRADIUS, flange_thickness=FLANGE_T)  # flange not past corners
    with pytest.raises(ValueError):
        flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=0.0)         # no flange
    with pytest.raises(ValueError):
        flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=M)           # flange eats whole height
```

- [ ] **Step 2: Run to verify failure**

Run: `./catalog/run pytest catalog/tests/test_flange_nut.py -v`
Expected: FAIL — `catalog/models/flange_nut.py` does not exist.

- [ ] **Step 3: Write the generator**

Create `catalog/models/flange_nut.py`:

```python
"""Flange nut family generator: a chamfered hex body with a conical flange at the base."""
import math

from build123d import (
    BuildPart, BuildSketch, Polygon, Cylinder, Plane, Axis, Mode, revolve, add,
)

from catalog.models.hex_nut import _chamfered_hex_solid, _MIN_WALL_MM

# Representative flange-cone angle (from horizontal) for the tapered top surface of the
# flange, used where a table does not publish the internal cone. The tabulated dimensions
# (s, m, d_flange, flange_thickness, bore) are always sourced; only this transition is
# representative.
_FLANGE_CONE_ANGLE_DEG = 20.0


def flange_nut(s: float, m: float, bore: float, d_flange: float,
               flange_thickness: float, chamfer: float | None = None):
    """Hex flange nut: across-flats ``s``, total height ``m``, drawn bore ``bore``,
    conical flange of outer diameter ``d_flange`` and rim thickness ``flange_thickness``.

    A shared chamfered vertex-up hex body (``_chamfered_hex_solid``) with a revolved
    conical flange unioned at the base: a flat bearing bottom of diameter ``d_flange``
    and rim thickness ``flange_thickness`` whose top cones inward and up to meet the hex
    corner circle. Bore subtracted through both.
    """
    if bore <= 0:
        raise ValueError(f"flange_nut: need bore > 0, got {bore}")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"flange_nut: bore {bore} leaves too thin a wall (under across-flats {s})")
    circumradius = s / math.sqrt(3.0)
    if d_flange <= 2 * circumradius:
        raise ValueError(
            f"flange_nut: d_flange {d_flange} must exceed the hex across-corners "
            f"{2 * circumradius:.3f} (else there is no flange)")
    if flange_thickness <= 0:
        raise ValueError(f"flange_nut: flange_thickness must be > 0, got {flange_thickness}")
    r_flange = d_flange / 2.0
    rise = (r_flange - circumradius) * math.tan(math.radians(_FLANGE_CONE_ANGLE_DEG))
    flange_top = flange_thickness + rise
    if flange_top >= m:
        raise ValueError(
            f"flange_nut: flange ({flange_top:.3f}) leaves no hex above height {m}")

    # Flange silhouette in the XZ half-plane (x = radius, y = height), revolved about Z:
    # flat bearing bottom out to the rim, up the thin rim edge, then coning inward and up
    # to the hex corner circle.
    flange_profile = [
        (0.0, 0.0),
        (r_flange, 0.0),
        (r_flange, flange_thickness),
        (circumradius, flange_top),
        (0.0, flange_top),
    ]
    hex_solid = _chamfered_hex_solid(s, m, chamfer)
    with BuildPart() as bp:
        add(hex_solid)
        with BuildSketch(Plane.XZ):
            Polygon(*flange_profile, align=None)
        revolve(axis=Axis.Z, revolution_arc=360)          # Mode.ADD (union) by default
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)
    part = bp.part
    if part.volume <= 0:
        raise ValueError("flange_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Run to verify pass**

Run: `./catalog/run pytest catalog/tests/test_flange_nut.py -v`
Expected: PASS (5 tests). If the union/revolve winding trips the kernel, adjust the flange profile winding / `align` until the extents and base-position asserts hold; the intended solid (hex + skirt) is unambiguous.

- [ ] **Step 5: Register the family**

In `catalog/models/_registry.py`, add the import alongside the existing ones:

```python
from catalog.models.flange_nut import flange_nut
```

and add to the `KNOWN_FAMILIES` dict:

```python
    "flange_nut": flange_nut,
```

- [ ] **Step 6: Add a registry dispatch test**

Append to `catalog/tests/test_families.py`:

```python
def test_flange_nut_dispatches_via_registry():
    from catalog.models._registry import build_part

    part = build_part("flange_nut",
                      {"s": 18.0, "m": 15.0, "bore": 10.1,
                       "d_flange": 26.0, "flange_thickness": 2.6})
    assert part.volume > 0
    assert round(part.bounding_box().size.X, 1) == 26.0   # flange diameter is the widest
```

- [ ] **Step 7: Run the touched tests**

Run: `./catalog/run pytest catalog/tests/test_flange_nut.py catalog/tests/test_families.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add catalog/models/flange_nut.py catalog/models/_registry.py catalog/tests/test_flange_nut.py catalog/tests/test_families.py
git commit -m "feat(catalog): add conical flange nut generator"
```

---

### Task 3: `flange_nuts.json` data + data tests

Add the data. **Core work is dimensional sourcing** — every tabulated number confirmed against ≥2 tables and cited. Reference values below are STARTING POINTS TO VERIFY.

**Files:**

- Create: `catalog/dimensions/flange_nuts.json`
- Create: `catalog/tests/test_flange_nuts_data.py`

**Interfaces:**

- Consumes: `validate_entry`, `build_part`, `flange_nut`.
- Produces: `catalog/dimensions/flange_nuts.json` — auto-globbed by `build_catalog`.

**Distinct drawings (verify each `s`, `m`, `d_flange`, `flange_thickness`, `bore` against ≥2 of Fasteners.eu, Würth/Bossard/Fabory tables, DIN/ISO tables):**

| id         | standard                          | ref s |  ref m | ref d_flange | ref flange_thickness | ref bore | note                                           |
| ---------- | --------------------------------- | ----: | -----: | -----------: | -------------------: | -------: | ---------------------------------------------- |
| `din6923`  | DIN 6923 hex flange nut           |  18.0 |   15.0 |         26.0 |                  2.6 |     10.1 | verify all; canonical base                     |
| `din6926`  | DIN 6926 prevailing, nylon insert |  18.0 | verify |         26.0 |               verify |     10.1 | distinct **or** alias of din6923 if dims match |
| `din6927`  | DIN 6927 prevailing, all-metal    |  18.0 | verify |         26.0 |               verify |     10.1 | distinct or alias                              |
| `iso21670` | ISO 21670 weld flange             |  18.0 | verify |         26.0 |               verify |     10.1 | distinct or alias                              |

> **Alias rule:** an entry is `alias_of: "din6923"` ONLY when its sourced `(s, m, d_flange, flange_thickness, bore)` match the base within rounding; otherwise a distinct drawing. Resolve from the sourced numbers.

- [ ] **Step 1: Write the failing data tests**

Create `catalog/tests/test_flange_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/flange_nuts.json")


def test_every_flange_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_all_flange_bases_are_flange_nuts():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "flange_nut", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_flange_aliases_point_at_real_non_alias_bases():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" not in entry:
            continue
        target = entry["alias_of"]
        assert target in entries, f"{sid}: alias_of '{target}' unknown"
        assert "alias_of" not in entries[target], f"{sid}: alias points at another alias"


def test_every_flange_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"
```

- [ ] **Step 2: Run to verify failure**

Run: `./catalog/run pytest catalog/tests/test_flange_nuts_data.py -v`
Expected: FAIL — `flange_nuts.json` does not exist.

- [ ] **Step 3: Source the dimensions**

For each standard, open ≥2 tables, confirm `s`, `m`, `d_flange`, `flange_thickness`, `bore`, and record where in the `source` string. Decide distinct-vs-alias from the confirmed numbers. Do not commit a number confirmed in only one place — drop that standard to a follow-up and note it. (The controller supplies the verified numbers before this task runs, as in the plain-hex family.)

- [ ] **Step 4: Write `catalog/dimensions/flange_nuts.json`**

Create with the confirmed data. Skeleton (fill VERIFIED values; add/remove rows per Step 3):

```json
{
	"din6923": {
		"family": "flange_nut",
		"shape": { "s": 18.0, "m": 15.0, "bore": 10.1, "d_flange": 26.0, "flange_thickness": 2.6 },
		"hardwareType": "nut",
		"source": "DIN 6923 hex flange nut (M12); s/m/d_flange/flange_thickness confirmed vs <table A> + <table B>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "6923" }]
	}
}
```

- [ ] **Step 5: Run to verify pass**

Run: `./catalog/run pytest catalog/tests/test_flange_nuts_data.py -v`
Expected: PASS (4 tests). If `build_part` raises, a sourced value violates a `flange_nut` guard — recheck.

- [ ] **Step 6: Commit**

```bash
git add catalog/dimensions/flange_nuts.json catalog/tests/test_flange_nuts_data.py
git commit -m "feat(catalog): add conical flange nut family data (M12, sourced)"
```

---

### Task 4: In-container build, opt-in gate, no-regression, manifest commit

**Files:**

- Generated: `catalog/out/*.svg` (new flange drawings), `catalog/out/manifest.json`

**Interfaces:**

- Consumes: everything from Tasks 1-3.
- Produces: committed maintainer-only assets.

- [ ] **Step 1: Full catalog suite in-container**

Run: `./catalog/run pytest catalog/tests -q`
Expected: PASS (washer + plain-hex + flange tests).

- [ ] **Step 2: Build the catalog**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: JSON report with the flange ids under `ok`, empty `failed`. New `catalog/out/din6923.svg` etc.; any alias appears in the manifest pointing at its base SVG with no new file.

- [ ] **Step 3: Verify the opt-in invariant**

```bash
echo "image-mappings: $(grep -c '\.svg' data/image-mappings.json)"
echo "standards-generated: $(grep -c '\.svg' src/lib/data/standards-generated.ts)"
```

Expected: both `0`. If not, STOP — a flange leaked into shipped app data.

- [ ] **Step 4: Verify no existing drawing regressed**

Run: `git status --porcelain catalog/out`
Expected: ONLY new flange `.svg` files + the manifest addition. CRITICAL: if any existing washer OR plain-hex `.svg` shows as modified, the Task 1 refactor changed geometry — STOP and report BLOCKED with the changed files. (The refactor must be behavior-preserving.)

- [ ] **Step 5: Normalize manifest and commit**

```bash
npx prettier --write catalog/out/manifest.json
git add catalog/out
git commit -m "feat(catalog): generate conical flange nut drawings"
```

- [ ] **Step 6: Visual check (manual, non-blocking)**

Start `pnpm dev`, open `/dev/asset-compare`, filter to the flange ids; confirm each reads as a vertex-up hex inside a concentric flange circle with a conical skirt in the side view, beside its legacy PNG.

---

## Post-implementation (outside the task loop)

- Push, open PR (What/Why/How + Test plan).
- `zen codereview` with `deepseek/deepseek-v4-pro` (thinking=high) on `flange_nut.py` **and** the `hex_nut.py` refactor (shared surfaces); apply findings as follow-up commits.
- CI green on the latest commit, then squash-merge (admin bypass authorized).
- Update `catalog-epic-approach.md` with the flange family result and any new gotchas.

## Coverage note

This spec covers only the conical flange family (~4 nut standards). The remaining nut families stay uncovered by design. Do NOT add a nut coverage gate to CI; it would fail on the intentional gaps.

---

## Self-Review

**Spec coverage:**

- `_chamfered_hex_solid` refactor → Task 1. ✓
- `flange_nut` generator (hex + conical flange union + bore) → Task 2. ✓
- Registry registration → Task 2 Steps 5-6. ✓
- `flange_nuts.json`, M12, sourced ≥2 tables, distinct/alias → Task 3. ✓
- No render change (NUT_PRESET reuse) → nothing to do; asserted by Task 4 (no washer/hex regression) + the flange render coming out vertex-up. ✓
- In-container build, opt-in 0/0, no-regression, manifest commit → Task 4. ✓
- Behavior-preserving refactor (existing tests green, plain-hex SVGs byte-identical) → Task 1 Steps 4-5 + Task 4 Step 4. ✓
- `/dev/asset-compare` visual check → Task 4 Step 6. ✓

**Placeholder scan:** Reference dimensions are flagged "verify against ≥2 tables" with a sourcing step (Task 3 Step 3) producing the committed numbers — the don't-fabricate discipline, not a lazy placeholder. `<table A>/<table B>` filled in Step 3. `_FLANGE_CONE_ANGLE_DEG` is an explicit, documented representative constant. No other TBDs.

**Type consistency:** `_chamfered_hex_solid(s, m, chamfer)` defined in Task 1, consumed identically in Task 2. `flange_nut(s, m, bore, d_flange, flange_thickness, chamfer=None)` used identically in Tasks 2 and 3. `_MIN_WALL_MM` imported by `flange_nut` from `hex_nut` (defined Task 1). `build(dims, out, manifest)` unchanged. Manifest stores `family` = `"flange_nut"`. ✓
