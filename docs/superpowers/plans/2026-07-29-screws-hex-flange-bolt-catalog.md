# Hex Flange Bolt (DIN 6921) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hex flange bolt coverage (DIN 6921) to the screw catalog — one new generator `hex_flange_bolt` composed from already-merged primitives, plus one base drawing and its alias. Screw gap 40 → 38.

**Architecture:** `hex_flange_bolt` stacks three existing pieces along +Z (bearing face on z=0): the `flange_nut` revolved conical flange at the base (z ∈ [0, flange_top]), the `hex_nut._chamfered_hex_solid` hex head spanning z ∈ [0, k], and the `screw_common._screw_shank` below (z ∈ [−length, 0]). It is `flange_nut`'s construction with no bore, plus a shank. Data lives in a new `hex_flange_bolts.json`.

**Tech Stack:** Python, build123d (container-only via `./catalog/run`), pytest. SVG render via `catalog.build_catalog`.

## Global Constraints

- **Container-only:** every build123d / pytest run goes through `./catalog/run <cmd>`. NEVER run build123d or pytest on the host.
- **Generate-only:** do NOT touch `data/image-mappings.json` or `src/lib/data/standards-generated.ts`; do NOT run `catalog/integrate.py`.
- **Additive & byte-identical:** the manifest gains only the new base; every pre-existing SVG must be byte-identical after a rebuild. Normalize manifest whitespace with `pnpm exec prettier --write catalog/out/manifest.json`.
- **Sourcing:** every committed dimension confirmed by ≥2 named public tables; representative fields (`length`, `tip_chamfer`, and the flange cone) flagged in the `source` string; `verified:true` only after cross-check. Source strings contain NO `reyher` / `stalmut` tokens.
- **Aliases never chain:** `din6921d` targets the real `din6921` base.
- **Commits:** Conventional Commits, ≤100-char header, NO AI/Claude/assistant mention.
- **Reuse, don't reinvent:** import `_chamfered_hex_solid` (hex_nut), `_FLANGE_CONE_ANGLE_DEG` (flange_nut), `_screw_shank` (screw_common). Do not re-derive the hex, the flange cone, or the shank.

---

## File Structure

- Create `catalog/models/hex_flange_bolt.py` — the new generator.
- Modify `catalog/models/_registry.py` — register `"hex_flange_bolt"`.
- Create `catalog/tests/test_hex_flange_bolt.py` — geometry-probe tests (synthetic fixtures).
- Create `catalog/dimensions/hex_flange_bolts.json` — `din6921` base + `din6921d` alias (Task 2).
- Create `catalog/tests/test_hex_flange_bolts_data.py` — data tests (Task 2).

---

### Task 1: `hex_flange_bolt` generator + registration + geometry tests

**Files:**

- Create: `catalog/models/hex_flange_bolt.py`
- Modify: `catalog/models/_registry.py`
- Test: `catalog/tests/test_hex_flange_bolt.py`

**Interfaces:**

- Consumes: `hex_nut._chamfered_hex_solid(s, m, chamfer=None)` → hex body z ∈ [0, m], vertex-up (corner on +X, flats on ±Y at radius s/2), chamfered top+bottom from the `chamfer`-diameter circle (defaults to s). `flange_nut._FLANGE_CONE_ANGLE_DEG` (20.0). `screw_common._screw_shank(d, length, tip_chamfer=None)` → shank z ∈ [−length, 0], top face on z=0.
- Produces: `hex_flange_bolt(s, k, dc, c, d_shank, length, head_chamfer=None, tip_chamfer=None)` → a single fused `build123d` Part. `_registry.build_part("hex_flange_bolt", shape_dict)` dispatches to it.

**Geometry (why each guard):** the flange (diameter `dc`) is wider than the hex across-corners, so the bearing face is the flange disc and the shank joins the flange disc — never the hex — so the only shank guard needed is `d_shank < s` (bolt shape: hex wider than shank; this also keeps the shank inside the flange disc since `d_shank < s < dc`). No hex/shank chamfer-overhang guard (the spec listed it under the general "mirrors hex_bolt" note, but that interface does not exist here — the shank meets the flange, not the hex bottom). `dc > 2·circumradius` guarantees a real flange; `flange_top < k` guarantees hex remains above the flange.

- [ ] **Step 1: Write the failing generator tests**

Create `catalog/tests/test_hex_flange_bolt.py`:

```python
import math

import pytest
from build123d import Box, Pos

from catalog.models.hex_flange_bolt import hex_flange_bolt

# Synthetic fixture (NOT a real standard). Hex s=18 (across-corners ~20.78), flange dc=26 (wider),
# rim c=2, total head height k=13, shank 12 x 40. flange_top = c + (dc/2 - s/sqrt3)*tan(20deg) ~= 2.95.
HFB = dict(s=18.0, k=13.0, dc=26.0, c=2.0, d_shank=12.0, length=40.0, tip_chamfer=1.0)

_CIRCUMRADIUS = 18.0 / math.sqrt(3.0)                       # ~10.392 (hex across-corners / 2)
_FLANGE_TOP = 2.0 + (26.0 / 2.0 - _CIRCUMRADIUS) * math.tan(math.radians(20.0))   # ~2.95


def _solid_at(part, x, y, z, probe=0.4):
    """True if the part has material in a small cube centered at (x, y, z). build123d ``intersect``
    returns None on empty overlap (do NOT use Box(mode=INTERSECT) inside a BuildPart)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_bounding_box_flange_is_widest_and_height_spans_shank_to_head():
    part = hex_flange_bolt(**HFB)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(HFB["dc"], 1)       # round flange (dc) is the widest feature
    assert round(bb.size.Y, 1) == round(HFB["dc"], 1)
    assert round(bb.max.Z, 1) == round(HFB["k"], 1)         # hex top at total head height k
    assert round(bb.min.Z, 1) == round(-HFB["length"], 1)   # shank free end
    assert round(bb.size.Z, 1) == round(HFB["length"] + HFB["k"], 1)


def test_flange_is_wider_than_the_hex_at_the_bearing_plane():
    part = hex_flange_bolt(**HFB)
    z = 0.5                                                  # just above the bearing face, inside the rim (c=2)
    r_flange = HFB["dc"] / 2.0                               # 13
    assert _solid_at(part, r_flange - 0.6, 0.0, z)          # solid out to the flange rim...
    assert not _solid_at(part, r_flange + 0.6, 0.0, z)      # ...void just beyond it
    # radius 12 is outside the hex corner circle (~10.39) but inside the flange -> flange-only material
    assert _solid_at(part, 12.0, 0.0, z)


def test_hex_flats_and_corners_above_the_flange():
    part = hex_flange_bolt(**HFB)
    z = (_FLANGE_TOP + HFB["k"]) / 2.0                       # ~8, pure-hex region (above the flange)
    # vertex-up: a corner points along +X at the circumradius; the flats are on +/-Y at radius s/2.
    assert _solid_at(part, _CIRCUMRADIUS - 0.6, 0.0, z)     # solid to the corner on +X
    assert not _solid_at(part, _CIRCUMRADIUS + 0.6, 0.0, z) # void just past the corner
    half_flat = HFB["s"] / 2.0                              # 9
    assert _solid_at(part, 0.0, half_flat - 0.6, z)         # solid to the flat on +Y
    assert not _solid_at(part, 0.0, half_flat + 0.6, z)     # void past the flat (hexagon, not a disc)


def test_shank_below_the_bearing_plane_and_nothing_above_the_head():
    part = hex_flange_bolt(**HFB)
    z = -5.0                                                # inside the shank
    r_shank = HFB["d_shank"] / 2.0                          # 6
    assert _solid_at(part, r_shank - 0.6, 0.0, z)          # solid to the shank wall
    assert not _solid_at(part, r_shank + 0.6, 0.0, z)      # void beyond the shank
    assert not _solid_at(part, 0.0, 0.0, HFB["k"] + 0.6)   # nothing above the hex top


def test_single_fused_solid():
    part = hex_flange_bolt(**HFB)
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        hex_flange_bolt(**{**HFB, "d_shank": HFB["s"]})        # shank not narrower than the hex (d_shank == s)
    with pytest.raises(ValueError):
        hex_flange_bolt(**{**HFB, "dc": 20.0})                 # dc <= hex across-corners (~20.78) -> no flange
    with pytest.raises(ValueError):
        hex_flange_bolt(**{**HFB, "k": 2.0})                   # k below flange_top (~2.95) -> no hex left
    with pytest.raises(ValueError):
        hex_flange_bolt(**{**HFB, "c": 0.0})                   # non-positive dimension
```

- [ ] **Step 2: Run the tests to verify they fail (no generator yet)**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_flange_bolt.py -q`
Expected: FAIL / collection error — `ModuleNotFoundError: catalog.models.hex_flange_bolt`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/hex_flange_bolt.py`:

```python
"""Hex flange bolt family generator (DIN 6921 / ISO 4162).

A vertex-up chamfered hex head (reused from ``hex_nut``) sitting on an integral conical flange
(the revolved profile reused from ``flange_nut``) over a smooth cylindrical shank
(``screw_common._screw_shank``). The flange is a flat bearing disc of diameter ``dc`` and rim
thickness ``c`` coning inward and up to the hex across-corners circle; it is wider than the hex, so
the bearing face is the flange disc, not the hex, and the shank emerges from the flange disc.
Envelope-only: no drawn thread, no bore, and the serrated (ribbed) bearing face of a real DIN 6921
is omitted (a smooth flange) — the same simplification ``flange_nut`` makes. Modelled axis-along-Z:
the flange/head occupy z in [0, k] (bearing face on z=0), the shank z in [-length, 0]; the front
view is the hexagon-on-flange end view, the side view the head+shank elevation.
"""
import math

from build123d import BuildPart, BuildSketch, Polygon, Plane, Axis, add, revolve

from catalog.models.flange_nut import _FLANGE_CONE_ANGLE_DEG
from catalog.models.hex_nut import _chamfered_hex_solid
from catalog.models.screw_common import _screw_shank


def hex_flange_bolt(s: float, k: float, dc: float, c: float, d_shank: float, length: float,
                    head_chamfer: float | None = None, tip_chamfer: float | None = None):
    """Hex flange bolt: across-flats ``s`` hex head of total height ``k`` (vertex-up, chamfered by
    ``head_chamfer``) on an integral conical flange of diameter ``dc`` and rim thickness ``c``, over
    a smooth shank of diameter ``d_shank`` and ``length`` (optional 45-degree lead ``tip_chamfer``).
    No bore, no drawn thread, smooth (unserrated) flange.
    """
    for name, val in (("s", s), ("k", k), ("dc", dc), ("c", c),
                      ("d_shank", d_shank), ("length", length)):
        if val <= 0:
            raise ValueError(f"hex_flange_bolt: need {name} > 0, got {val}")
    if d_shank >= s:
        raise ValueError(
            f"hex_flange_bolt: d_shank {d_shank} must be < across-flats {s} (the shank is narrower "
            f"than the hex head and, since s < dc, stays within the flange disc it joins)")
    circumradius = s / math.sqrt(3.0)                     # hex across-corners / 2
    if dc <= 2 * circumradius:
        raise ValueError(
            f"hex_flange_bolt: dc {dc} must exceed the hex across-corners {2 * circumradius:.3f} "
            f"(else there is no flange)")
    r_flange = dc / 2.0
    rise = (r_flange - circumradius) * math.tan(math.radians(_FLANGE_CONE_ANGLE_DEG))
    flange_top = c + rise
    if flange_top >= k:
        raise ValueError(
            f"hex_flange_bolt: flange ({flange_top:.3f}) leaves no hex below total head height {k}")

    # Flange silhouette in the XZ half-plane (x = radius, z = height), revolved about Z: flat bearing
    # disc out to the rim, up the rim edge, then coning inward and up to the hex corner circle. The
    # profile touches the Z axis at both ends (x=0); the volume/solid guards below are the net.
    flange_profile = [
        (0.0, 0.0),
        (r_flange, 0.0),
        (r_flange, c),
        (circumradius, flange_top),
        (0.0, flange_top),
    ]
    hex_solid = _chamfered_hex_solid(s, k, head_chamfer)   # z in [0, k], validates s/k/chamfer
    shank = _screw_shank(d_shank, length, tip_chamfer)     # z in [-length, 0], validates chamfer
    with BuildPart() as bp:
        add(hex_solid)
        with BuildSketch(Plane.XZ):
            Polygon(*flange_profile, align=None)
        revolve(axis=Axis.Z, revolution_arc=360)           # Mode.ADD (union) — flange around hex base
        add(shank)                                         # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell)
        raise ValueError("hex_flange_bolt: produced an empty solid")
    if len(part.solids()) != 1:                            # flange + hex + shank must fuse to one solid
        raise ValueError("hex_flange_bolt: flange/head/shank did not fuse into a single solid")
    return part
```

- [ ] **Step 4: Register the generator**

In `catalog/models/_registry.py`, add the import alongside the other model imports and the entry in the family map (match the file's existing alphabetical/grouping style):

```python
from catalog.models.hex_flange_bolt import hex_flange_bolt
```

and in the `KNOWN_FAMILIES` (or equivalent) dict:

```python
    "hex_flange_bolt": hex_flange_bolt,
```

- [ ] **Step 5: Run the generator tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_flange_bolt.py -q`
Expected: PASS (all tests).

- [ ] **Step 6: Confirm no existing SVG changed and the full suite is green**

Run: `./catalog/run python -m catalog.build_catalog` (no data uses the new family yet), then
`git status --short catalog/out/` — expect nothing modified. If `manifest.json` shows only whitespace churn, run `pnpm exec prettier --write catalog/out/manifest.json` and confirm `git diff -w catalog/out/manifest.json` is empty. If any `.svg` changed, STOP.
Run: `./catalog/run python -m pytest catalog/tests -q` — full suite green.

- [ ] **Step 7: Commit**

```bash
git add catalog/models/hex_flange_bolt.py catalog/models/_registry.py catalog/tests/test_hex_flange_bolt.py
git commit -m "feat(catalog): add hex_flange_bolt generator (hex head + conical flange + shank)"
```

---

### Task 2: DIN 6921 data + data tests + SVG

> **CONTROLLER — SOURCING GATE FIRST.** Before dispatching this task, run the sourcing gate: confirm the DIN 6921 representative-size dimensions (`s`, `k`, `dc`, `c`, `d_shank`) against ≥2 named public tables and verify the shape against a vendor drawing. Write the outcome (exact numbers, the named tables, the flagged representative fields, the final `source` string) to `.superpowers/sdd/task-2-sourcing.md`. That file's numbers govern this task — the values below are placeholders showing structure only. If a dimension cannot be sourced, pick a size that can, or drop to a smaller shipped set; never fabricate.

**Files:**

- Create: `catalog/dimensions/hex_flange_bolts.json`
- Test: `catalog/tests/test_hex_flange_bolts_data.py`
- Generated (build output): `catalog/out/din6921.svg`, manifest entry.

**Interfaces:**

- Consumes: `hex_flange_bolt(...)` from Task 1 via `_registry.build_part`. `catalog.schema.validate_entry(sid, entry)`.
- Produces: `din6921` base + `din6921d` alias in `hex_flange_bolts.json`; a rendered `din6921.svg`.

- [ ] **Step 1: Write the failing data tests**

Create `catalog/tests/test_hex_flange_bolts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/hex_flange_bolts.json")
_FORBIDDEN = ("reyher", "stalmut")

_BASES = ("din6921",)
_ALIASES = {"din6921d": "din6921"}


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
        assert entry["family"] == "hex_flange_bolt", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"


def test_bases_are_real_and_build():
    entries = json.loads(DATA.read_text())
    for base_id in _BASES:
        assert base_id in entries and "alias_of" not in entries[base_id], f"{base_id} must be a base"
        build_part(entries[base_id]["family"], entries[base_id]["shape"])


def test_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from hex_flange_bolts.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"


def test_designations_name_din_6921():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert {"system": "DIN", "code": "6921"} in entry["designations"], f"{sid}: DIN 6921 missing"


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

- [ ] **Step 2: Run the data tests to verify they fail (no data file yet)**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_flange_bolts_data.py -q`
Expected: FAIL — `FileNotFoundError` / empty file for `hex_flange_bolts.json`.

- [ ] **Step 3: Write the data file (numbers from `task-2-sourcing.md`)**

Create `catalog/dimensions/hex_flange_bolts.json`. The shape keys are exactly the generator parameters. **Replace the placeholder dimensions with the sourcing-gate numbers.**

```json
{
	"din6921": {
		"family": "hex_flange_bolt",
		"shape": {
			"s": 0.0,
			"k": 0.0,
			"dc": 0.0,
			"c": 0.0,
			"d_shank": 0.0,
			"length": 0.0,
			"tip_chamfer": 1.0
		},
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "6921" }],
		"source": "<<from task-2-sourcing.md: name >=2 public tables for s/k/dc/c/d_shank; flag length, tip_chamfer, flange cone, and the omitted serrations as representative/envelope>>"
	},
	"din6921d": {
		"alias_of": "din6921",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "6921" }],
		"source": "DIN 6921 M<size>, app image-variant key — identical hex-flange-bolt envelope, aliases the din6921 base."
	}
}
```

- [ ] **Step 4: Run the data tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_flange_bolts_data.py -q`
Expected: PASS.

- [ ] **Step 5: Build the catalog and confirm additive-only**

Run: `./catalog/run python -m catalog.build_catalog`
Then `pnpm exec prettier --write catalog/out/manifest.json` and `git status --short catalog/out/`.
Expected: exactly one new file `catalog/out/din6921.svg` and a manifest gaining only the `din6921` entry. `git diff -w` on any pre-existing SVG must be empty — if any existing `.svg` changed, STOP.

- [ ] **Step 6: Full suite green**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/hex_flange_bolts.json catalog/tests/test_hex_flange_bolts_data.py catalog/out/din6921.svg catalog/out/manifest.json
git commit -m "feat(catalog): add DIN 6921 hex flange bolt data + drawing (gap 40->38)"
```

---

## Self-Review

**Spec coverage:** Task 1 delivers the `hex_flange_bolt` generator (compose hex + flange + shank), registration, and geometry tests — covers the spec's generator design and testing sections. Task 2 delivers the `din6921` base + `din6921d` alias, data tests, and the SVG — covers the ids, data, and success-criteria sections. The sourcing gate is the controller step gating Task 2, matching the epic invariant.

**Placeholder scan:** Task 1 code is complete. Task 2's JSON dimensions are intentional placeholders (`0.0`) filled by the sourcing gate — this is the established pattern (family 7), not a plan gap; the data tests build the part, so any un-replaced `0.0` fails Step 4 loudly.

**Type consistency:** generator signature `hex_flange_bolt(s, k, dc, c, d_shank, length, head_chamfer=None, tip_chamfer=None)` is identical across the spec, Task 1 code, the `Produces` block, and the JSON `shape` keys (`s, k, dc, c, d_shank, length, tip_chamfer`). Reused helpers match their real signatures (`_chamfered_hex_solid(s, m, chamfer=None)`, `_screw_shank(d, length, tip_chamfer=None)`, `_FLANGE_CONE_ANGLE_DEG`).

**Deliberate refinement vs spec:** the spec listed a `d_shank ≤ head flat-chamfer diameter` guard "mirrors hex_bolt"; this plan drops it because the shank joins the flange disc (always wider than the hex), not the hex bottom — that interface does not exist here. The meaningful `d_shank < s` guard is kept. Flagged for the reviewer.
