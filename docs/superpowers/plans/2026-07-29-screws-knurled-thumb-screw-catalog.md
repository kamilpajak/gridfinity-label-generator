# Knurled Thumb Screw (DIN 464/653) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add knurled thumb screw coverage (DIN 653 low) to the screw catalog — one new generator `knurled_screw` composed from an already-shipped idiom, plus one base drawing and its alias. Screw gap 38 → 36. (DIN 464 high was deferred at the sourcing gate — see the Task 2 note.)

**Architecture:** `knurled_screw` stacks two pieces along Z (bearing face on z=0): a revolved knurled cylinder head with an optional top-rim chamfer (z ∈ [0, k]) and the shared `screw_common._screw_shank` below (z ∈ [−length, 0]). It is `knurled_nut`'s cylinder head with no bore, plus a shank. This draws the flat DIN 653 (low) form; the DIN 464 (high) form carries the same head on a raised collar (deferred). Data lives in a new `knurled_screws.json`.

**Tech Stack:** Python, build123d (container-only via `./catalog/run`), pytest. SVG render via `catalog.build_catalog`.

## Global Constraints

- **Container-only:** every build123d / pytest run goes through `./catalog/run <cmd>`. NEVER run build123d or pytest on the host.
- **Generate-only:** do NOT touch `data/image-mappings.json` or `src/lib/data/standards-generated.ts`; do NOT run `catalog/integrate.py`.
- **Additive & byte-identical:** the manifest gains only the two new bases; every pre-existing SVG must be byte-identical after a rebuild. Normalize manifest whitespace with `pnpm exec prettier --write catalog/out/manifest.json`.
- **Sourcing:** every committed dimension confirmed by ≥2 named public tables; representative fields (`length`, `tip_chamfer`, `head_chamfer`) flagged in the `source` string; the omitted knurl flagged; `verified:true` only after cross-check. Source strings contain NO `reyher` / `stalmut` tokens.
- **Aliases never chain:** `din464p` targets the real `din464` base; `din653p` targets `din653`.
- **Commits:** Conventional Commits, ≤100-char header, NO AI/Claude/assistant mention.
- **Reuse, don't reinvent:** import `_screw_shank` (screw_common). The head is a revolved cylinder (the `_screw_shank` meridian idiom) — do not re-derive the shank or reach for a fragile edge-selection chamfer.

---

## File Structure

- Create `catalog/models/knurled_screw.py` — the new generator.
- Modify `catalog/models/_registry.py` — register `"knurled_screw"`.
- Create `catalog/tests/test_knurled_screw.py` — geometry-probe tests (synthetic fixture).
- Create `catalog/dimensions/knurled_screws.json` — `din653` base + `din653p` alias (Task 2; DIN 464 deferred).
- Create `catalog/tests/test_knurled_screws_data.py` — data tests (Task 2).

---

### Task 1: `knurled_screw` generator + registration + geometry tests

**Files:**

- Create: `catalog/models/knurled_screw.py`
- Modify: `catalog/models/_registry.py`
- Test: `catalog/tests/test_knurled_screw.py`

**Interfaces:**

- Consumes: `screw_common._screw_shank(d, length, tip_chamfer=None)` → shank z ∈ [−length, 0], top face on z=0.
- Produces: `knurled_screw(d, k, d_shank, length, head_chamfer=None, tip_chamfer=None)` → a single fused `build123d` Part. `_registry.build_part("knurled_screw", shape_dict)` dispatches to it.

**Geometry (why each guard):** the head (diameter `d`) is the hand grip and is always wider than the thread, so `d_shank < d`; since the head sits on the z=0 bearing plane and the shank hangs below it, they share the z=0 face and fuse. The head is a revolved meridian profile (deterministic, no edge selection); the optional top-rim chamfer removes the top outer corner. `head_chamfer` must fit inside the head: `0 < c < d/2` (radially) and `c < k` (axially). Net `volume > 0` + `len(solids) == 1` are the fusion backstop.

- [ ] **Step 1: Write the failing generator tests**

Create `catalog/tests/test_knurled_screw.py`:

```python
import pytest
from build123d import Box, Pos

from catalog.models.knurled_screw import knurled_screw

# Synthetic fixture (NOT a real standard). Head d=20 (widest), tall head k=14, shank 8 x 30,
# top-rim chamfer 1.5. Head radius r=10; chamfer wall top at z=k-1.5=12.5, top face radius r-1.5=8.5.
KS = dict(d=20.0, k=14.0, d_shank=8.0, length=30.0, head_chamfer=1.5, tip_chamfer=1.0)


def _solid_at(part, x, y, z, probe=0.4):
    """True if the part has material in a small cube centered at (x, y, z). build123d ``intersect``
    returns None on empty overlap (do NOT use Box(mode=INTERSECT) inside a BuildPart)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_bounding_box_head_is_widest_and_height_spans_shank_to_head():
    part = knurled_screw(**KS)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(KS["d"], 1)         # round head (d) is the widest feature
    assert round(bb.size.Y, 1) == round(KS["d"], 1)
    assert round(bb.max.Z, 1) == round(KS["k"], 1)          # head top at head height k
    assert round(bb.min.Z, 1) == round(-KS["length"], 1)    # shank free end
    assert round(bb.size.Z, 1) == round(KS["length"] + KS["k"], 1)


def test_head_is_wider_than_the_shank_at_mid_head():
    part = knurled_screw(**KS)
    z = KS["k"] / 2.0                                        # mid-head, below the chamfer -> full radius
    r_head = KS["d"] / 2.0                                   # 10
    assert _solid_at(part, r_head - 0.6, 0.0, z)            # solid out to the head wall...
    assert not _solid_at(part, r_head + 0.6, 0.0, z)        # ...void just beyond it
    # radius 9 is well outside the shank (r_shank=4) but inside the head -> head-only material
    assert _solid_at(part, 9.0, 0.0, z)


def test_top_rim_is_chamfered_away():
    part = knurled_screw(**KS)
    r_head = KS["d"] / 2.0                                   # 10
    # The top outer corner (r_head, 0, k) is removed by the chamfer -> void there...
    assert not _solid_at(part, r_head - 0.2, 0.0, KS["k"] - 0.2)
    # ...but the wall is full-width just below the chamfer, and the top face is solid at the centre.
    assert _solid_at(part, r_head - 0.6, 0.0, KS["k"] - 2.0)   # z=12 < chamfer start (12.5): full wall
    assert _solid_at(part, 0.0, 0.0, KS["k"] - 0.2)           # centre of the top face


def test_shank_below_the_bearing_plane_and_nothing_above_the_head():
    part = knurled_screw(**KS)
    z = -5.0                                                # inside the shank
    r_shank = KS["d_shank"] / 2.0                           # 4
    assert _solid_at(part, r_shank - 0.6, 0.0, z)          # solid to the shank wall
    assert not _solid_at(part, r_shank + 0.6, 0.0, z)      # void beyond the shank
    assert not _solid_at(part, 0.0, 0.0, KS["k"] + 0.6)    # nothing above the head top


def test_single_fused_solid():
    part = knurled_screw(**KS)
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        knurled_screw(**{**KS, "d_shank": KS["d"]})           # shank not narrower than the head (d_shank == d)
    with pytest.raises(ValueError):
        knurled_screw(**{**KS, "head_chamfer": KS["d"]})      # head_chamfer >= head radius (d/2)
    with pytest.raises(ValueError):
        knurled_screw(**{**KS, "k": 3.0, "head_chamfer": 4.0})  # head_chamfer (4) >= head height (3)
    with pytest.raises(ValueError):
        knurled_screw(**{**KS, "k": 0.0})                     # non-positive dimension
```

- [ ] **Step 2: Run the tests to verify they fail (no generator yet)**

Run: `./catalog/run python -m pytest catalog/tests/test_knurled_screw.py -q`
Expected: FAIL / collection error — `ModuleNotFoundError: catalog.models.knurled_screw`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/knurled_screw.py`:

```python
"""Knurled thumb screw family generator (DIN 464 high, DIN 653 low).

A smooth knurled cylindrical head (the knurl is a fine feature and is NOT drawn, like the
thread) over a smooth cylindrical shank (``screw_common._screw_shank``). DIN 464 (high) and
DIN 653 (low) are the same envelope at different head heights ``k``. The head top edge carries
an optional small chamfer breaking the top knurl rim; the knurl on the head wall is omitted (a
smooth cylinder) — the same envelope convention ``knurled_nut`` makes. Modelled axis-along-Z:
the head occupies z in [0, k] (bearing face on z=0), the shank z in [-length, 0]. Head and shank
fuse by face contact at the z=0 bearing plane (the screw_common stacking seam), guarded by net
volume>0 + single-solid.
"""
from build123d import BuildPart, BuildSketch, Polygon, Plane, Axis, add, revolve

from catalog.models.screw_common import _screw_shank


def knurled_screw(d: float, k: float, d_shank: float, length: float,
                  head_chamfer: float | None = None, tip_chamfer: float | None = None):
    """Knurled thumb screw: a knurled cylindrical head of diameter ``d`` and height ``k`` (with an
    optional 45-degree top-rim chamfer of leg ``head_chamfer``) over a smooth shank of diameter
    ``d_shank`` and ``length`` (optional 45-degree lead ``tip_chamfer``). No bore, no drawn thread,
    no drawn knurl.
    """
    for name, val in (("d", d), ("k", k), ("d_shank", d_shank), ("length", length)):
        if val <= 0:
            raise ValueError(f"knurled_screw: need {name} > 0, got {val}")
    if d_shank >= d:
        raise ValueError(
            f"knurled_screw: d_shank {d_shank} must be < head diameter {d} "
            f"(the knurled head is the grip and is wider than the thread)")
    r = d / 2.0
    if head_chamfer is not None:
        if not (0 < head_chamfer < r):
            raise ValueError(
                f"knurled_screw: head_chamfer {head_chamfer} must be > 0 and < head radius {r}")
        if head_chamfer >= k:
            raise ValueError(
                f"knurled_screw: head_chamfer {head_chamfer} must be < head height {k}")
        hc = head_chamfer
        # (x=radius, z=height): bearing face -> outer wall -> 45-deg top-rim chamfer -> top face.
        head_profile = [(0.0, 0.0), (r, 0.0), (r, k - hc), (r - hc, k), (0.0, k)]
    else:
        head_profile = [(0.0, 0.0), (r, 0.0), (r, k), (0.0, k)]

    shank = _screw_shank(d_shank, length, tip_chamfer)     # z in [-length, 0], validates chamfer
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*head_profile, align=None)             # explicit coords -> no auto-centring
        revolve(axis=Axis.Z, revolution_arc=360)           # knurled head, z in [0, k]
        add(shank)                                         # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell)
        raise ValueError("knurled_screw: produced an empty solid")
    if len(part.solids()) != 1:                            # head + shank must fuse to one solid
        raise ValueError("knurled_screw: head/shank did not fuse into a single solid")
    return part
```

- [ ] **Step 4: Register the generator**

In `catalog/models/_registry.py`, add the import after the `prism_head_bolt`/`hex_flange_bolt` imports (the file appends new families at the end):

```python
from catalog.models.knurled_screw import knurled_screw
```

and append to the `KNOWN_FAMILIES` dict (after `"hex_flange_bolt": hex_flange_bolt,`):

```python
    "knurled_screw": knurled_screw,
```

- [ ] **Step 5: Run the generator tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_knurled_screw.py -q`
Expected: PASS (all tests).

- [ ] **Step 6: Confirm no existing SVG changed and the full suite is green**

Run: `./catalog/run python -m catalog.build_catalog` (no data uses the new family yet), then
`git status --short catalog/out/` — expect nothing modified. If `manifest.json` shows only whitespace churn, run `pnpm exec prettier --write catalog/out/manifest.json` and confirm `git diff -w catalog/out/manifest.json` is empty. If any `.svg` changed, STOP.
Run: `./catalog/run python -m pytest catalog/tests -q` — full suite green.

- [ ] **Step 7: Commit**

```bash
git add catalog/models/knurled_screw.py catalog/models/_registry.py catalog/tests/test_knurled_screw.py
git commit -m "feat(catalog): add knurled_screw generator (knurled cylinder head + shank)"
```

---

### Task 2: DIN 653 data + data tests + SVG

> **SOURCING GATE — DONE (controller).** `.superpowers/sdd/task-2-sourcing.md` governs this task. Outcome: **DIN 653 (low) PASSES** at M6 (`dk=24`, `k=5.0`, chamfer 0.5) confirmed by Westfield Fasteners + GlobalFastener + fasteners.eu (AFT confirms the head-diameter series). **DIN 464 (high) is DEFERRED** — the tables show the high/low difference is a raised collar (the DIN 466/467 knurled-nut relationship), not head height, and the collar height rests on one table (Fuller); the generator draws no collar. Use the exact numbers below (already filled from the gate — not placeholders).

**Files:**

- Create: `catalog/dimensions/knurled_screws.json`
- Test: `catalog/tests/test_knurled_screws_data.py`
- Generated (build output): `catalog/out/din653.svg`, manifest entry.

**Interfaces:**

- Consumes: `knurled_screw(...)` from Task 1 via `_registry.build_part`. `catalog.schema.validate_entry(sid, entry)`.
- Produces: `din653` base + `din653p` alias in `knurled_screws.json`; rendered `din653.svg`.

- [ ] **Step 1: Write the failing data tests**

Create `catalog/tests/test_knurled_screws_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/knurled_screws.json")
_FORBIDDEN = ("reyher", "stalmut")

_BASES = ("din653",)
_ALIASES = {"din653p": "din653"}
_DIN_CODE = {"din653": "653", "din653p": "653"}


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
        assert entry["family"] == "knurled_screw", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"


def test_bases_are_real_and_build():
    entries = json.loads(DATA.read_text())
    for base_id in _BASES:
        assert base_id in entries and "alias_of" not in entries[base_id], f"{base_id} must be a base"
        build_part(entries[base_id]["family"], entries[base_id]["shape"])


def test_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from knurled_screws.json"
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

- [ ] **Step 2: Run the data tests to verify they fail (no data file yet)**

Run: `./catalog/run python -m pytest catalog/tests/test_knurled_screws_data.py -q`
Expected: FAIL — `FileNotFoundError` / empty file for `knurled_screws.json`.

- [ ] **Step 3: Write the data file (numbers from `task-2-sourcing.md`)**

Create `catalog/dimensions/knurled_screws.json`. The shape keys are exactly the generator parameters. Use the sourced M6 numbers below verbatim, and the exact `source` strings from `task-2-sourcing.md` (the `<<...>>` markers below are stand-ins — copy the full source strings from the sourcing file).

```json
{
	"din653": {
		"family": "knurled_screw",
		"shape": {
			"d": 24.0,
			"k": 5.0,
			"d_shank": 6.0,
			"length": 20.0,
			"head_chamfer": 0.5,
			"tip_chamfer": 1.0
		},
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "653" }],
		"source": "<<copy the din653 source string verbatim from task-2-sourcing.md>>"
	},
	"din653p": {
		"alias_of": "din653",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "653" }],
		"source": "<<copy the din653p source string verbatim from task-2-sourcing.md>>"
	}
}
```

- [ ] **Step 4: Run the data tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_knurled_screws_data.py -q`
Expected: PASS.

- [ ] **Step 5: Build the catalog and confirm additive-only**

Run: `./catalog/run python -m catalog.build_catalog`
Then `pnpm exec prettier --write catalog/out/manifest.json` and `git status --short catalog/out/`.
Expected: exactly one new file `catalog/out/din653.svg` and a manifest gaining only the `din653` entry. `git diff -w` on any pre-existing SVG must be empty — if any existing `.svg` changed, STOP.

- [ ] **Step 6: Full suite green**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/knurled_screws.json catalog/tests/test_knurled_screws_data.py catalog/out/din653.svg catalog/out/manifest.json
git commit -m "feat(catalog): add DIN 653 knurled thumb screw data + drawing (gap 38->36)"
```

---

## Self-Review

**Spec coverage:** Task 1 delivers the `knurled_screw` generator (revolved knurled cylinder head + shank), registration, and geometry tests — covers the spec's generator design and testing sections. Task 2 delivers the `din653` base + `din653p` alias, data tests, and the SVG — covers the ids, data, and success-criteria sections. The sourcing gate (controller step) narrowed the shipped set to DIN 653 (low): the tables showed DIN 464's "high" is a raised collar, not a taller head, and its collar is not sourceable to ≥2 tables — deferred, per the sourcing-gate's own "drop to a smaller shipped set; never fabricate" rule.

**Placeholder scan:** Task 1 code is complete. Task 2's JSON dimensions are the real M6 numbers from the sourcing gate (`d=24, k=5, d_shank=6, head_chamfer=0.5`); the `source` strings are copied verbatim from `task-2-sourcing.md`. The data tests build the part, so any bad dimension fails Step 4 loudly.

**Type consistency:** generator signature `knurled_screw(d, k, d_shank, length, head_chamfer=None, tip_chamfer=None)` is identical across the spec, Task 1 code, the `Produces` block, and the JSON `shape` keys (`d, k, d_shank, length, head_chamfer, tip_chamfer`). The reused helper matches its real signature (`_screw_shank(d, length, tip_chamfer=None)`).
