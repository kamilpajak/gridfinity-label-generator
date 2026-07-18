# Hex-Head Bolt Family Implementation Plan (first screw family)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared screw shank helper (`screw_common._screw_shank`) and a `hex_bolt` generator (chamfered hex head + smooth lead-chamfered shank, no bore, no drawn thread), plus the `iso4014` M12×60 data entry and its `iso4017` alias.

**Architecture:** `hex_bolt` reuses `_chamfered_hex_solid` from `hex_nut` for the head (`z∈[0,k]`, vertex-up) and unions a smooth `_screw_shank` cylinder (`z∈[−length,0]`, optional 45° lead chamfer) below it. Screw axis = Z, so the existing `DEFAULT_AXIS_Z` preset renders the end view (down Z = hexagon) + the horizontal side elevation (along −Y). The thread is envelope-only (smooth shank), so full-thread `iso4017` aliases partial-thread `iso4014`.

**Tech Stack:** Python + build123d (in-container via `./catalog/run`), pytest, JSON data files.

## Global Constraints

- Representative size **M12 × 60**. Ships `iso4014` (drawing) + `iso4017` (alias).
- Every committed dimension confirmed by **≥2 independent public tables**; representative fields (the chosen `length`, `head_chamfer`, `tip_chamfer`) documented as such, never fabricated. Shape (hex head + smooth shank + lead chamfer) verified against `iso_4014.png` + tables.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- **New** base shape + a **new** shared helper — reuse `_chamfered_hex_solid`; do **not** modify it or any existing generator. Existing SVGs stay **byte-identical**.
- **Smooth envelope shank — no drawn thread.** No bore (external hex head is its own drive).
- **No render/preset change.** Axis-along-Z → `hardwareType: "screw"` → `preset_for_hardware_type("screw")` = `DEFAULT_AXIS_Z`. Confirm at build that a long M12×60 frames acceptably (end view + elevation); add a `SCREW_PRESET` only if it does not.
- **opt-in 0/0** after build: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts` → `0` for both. Do **not** run `catalog/integrate.py` or `pnpm standards:build`.
- In-container only via `./catalog/run`. Build entrypoint: `python -m catalog.build_catalog`.
- Generator geometry tests use **synthetic** fixtures. Real dimensions come from the controller sourcing pass at the data task.

---

### Task 1: `_screw_shank` shared helper (`screw_common`)

**Files:**

- Create: `catalog/models/screw_common.py`
- Create: `catalog/tests/test_screw_common.py`

**Interfaces:**

- Consumes: nothing from the catalog (only `build123d`).
- Produces: `_screw_shank(d, length, tip_chamfer=None) -> build123d Part` — a smooth cylinder of diameter `d`, spanning `z∈[−length, 0]` (top face on `z=0`), with an optional 45° lead chamfer of leg `tip_chamfer` at the free end (`z=−length`). Reused by every screw family.

- [ ] **Step 1: Write the failing test**

Create `catalog/tests/test_screw_common.py`:

```python
import pytest
from build123d import Box, Pos

from catalog.models.screw_common import _screw_shank

# Synthetic fixture (NOT a real standard): a 12-dia shank, 30 long, 2mm lead chamfer.
CFG = dict(d=12.0, length=30.0, tip_chamfer=2.0)


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_shank_extents():
    part = _screw_shank(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["length"], 1)     # axial length along Z
    assert round(bb.size.X, 1) == round(CFG["d"], 1)          # diameter across
    assert round(bb.max.Z, 1) == 0.0                          # top face on z=0
    assert round(bb.min.Z, 1) == round(-CFG["length"], 1)     # extends down to -length
    assert part.volume > 0


def test_shank_is_round_solid_core():
    part = _screw_shank(**CFG)
    r = CFG["d"] / 2.0
    z = -CFG["length"] / 2.0                                  # mid-shank
    assert _solid_at(part, 0.0, 0.0, z, probe=0.6)            # solid on the axis
    assert _solid_at(part, r - 0.5, 0.0, z, probe=0.4)        # solid to near the wall
    assert not _solid_at(part, r + 0.5, 0.0, z, probe=0.4)    # void just beyond the wall


def test_tip_chamfer_is_cut():
    part = _screw_shank(**CFG)
    r = CFG["d"] / 2.0
    # With a 2mm 45-deg lead chamfer, the extreme free-end outer corner is bevelled away:
    # the chamfer runs (r, -(length-c)) -> (r-c, -length); at z=-29.7 material reaches r=4.3.
    assert not _solid_at(part, r - 0.3, 0.0, -CFG["length"] + 0.3, probe=0.3)
    # Same shank without a chamfer: that corner is solid.
    square = _screw_shank(CFG["d"], CFG["length"], tip_chamfer=None)
    assert _solid_at(square, r - 0.3, 0.0, -CFG["length"] + 0.3, probe=0.3)


def test_shank_guards():
    with pytest.raises(ValueError):
        _screw_shank(0.0, 30.0)                               # non-positive diameter
    with pytest.raises(ValueError):
        _screw_shank(12.0, 0.0)                               # non-positive length
    with pytest.raises(ValueError):
        _screw_shank(12.0, 30.0, tip_chamfer=0.0)             # non-positive chamfer
    with pytest.raises(ValueError):
        _screw_shank(12.0, 30.0, tip_chamfer=6.0)             # chamfer >= radius
    with pytest.raises(ValueError):
        _screw_shank(12.0, 1.0, tip_chamfer=2.0)              # chamfer >= length
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_screw_common.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.screw_common'`.

- [ ] **Step 3: Write the helper**

Create `catalog/models/screw_common.py`:

```python
"""Shared helpers for the screw families (hex_bolt, socket_screw, slotted_screw, ...).

The threaded shank is drawn ENVELOPE-ONLY (a smooth cylinder at the major diameter) — no
thread lines — consistent with the epic's fine-feature rule. Every screw family reuses
``_screw_shank`` for the body below the head.
"""
from build123d import BuildPart, BuildSketch, Polygon, Plane, Axis, revolve


def _screw_shank(d: float, length: float, tip_chamfer: float | None = None):
    """A smooth cylindrical shank of diameter ``d`` and axial ``length``, built along -Z from
    the under-head bearing plane ``z=0`` down to ``z=-length``, with an optional 45-degree lead
    chamfer of leg ``tip_chamfer`` at the free end. Built by revolving a meridian profile in the
    XZ plane about Z (deterministic — no fragile edge selection). Envelope only; no thread.
    """
    if d <= 0:
        raise ValueError(f"_screw_shank: need d > 0, got {d}")
    if length <= 0:
        raise ValueError(f"_screw_shank: need length > 0, got {length}")
    r = d / 2.0
    if tip_chamfer is not None:
        if not (0 < tip_chamfer < r):
            raise ValueError(
                f"_screw_shank: tip_chamfer {tip_chamfer} must be > 0 and < radius {r}")
        if tip_chamfer >= length:
            raise ValueError(
                f"_screw_shank: tip_chamfer {tip_chamfer} must be < length {length}")
        c = tip_chamfer
        # (x=radius, z=axial): top face -> outer wall -> 45-deg lead chamfer -> bottom face.
        profile = [(0.0, 0.0), (r, 0.0), (r, -(length - c)), (r - c, -length), (0.0, -length)]
    else:
        profile = [(0.0, 0.0), (r, 0.0), (r, -length), (0.0, -length)]
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)          # explicit coords -> no auto-centring
        revolve(axis=Axis.Z, revolution_arc=360)
    if bp.part.volume <= 0:                          # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("_screw_shank: produced an empty solid")
    return bp.part
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_screw_common.py -q`
Expected: PASS (all tests green). If extents are off, fix the construction — do not change the tests. Note `BuildSketch(Plane.XZ)` maps profile `(u, v)` to global `(u, 0, v)`, and `revolve(axis=Axis.Z)` sweeps the meridian about Z.

- [ ] **Step 5: Commit**

```bash
git add catalog/models/screw_common.py catalog/tests/test_screw_common.py
git commit -m "feat(catalog): add _screw_shank shared helper for the screw families"
```

---

### Task 2: `hex_bolt` generator (ISO 4014)

**Files:**

- Create: `catalog/models/hex_bolt.py`
- Create: `catalog/tests/test_hex_bolt.py`
- Modify: `catalog/models/_registry.py` (add import + `KNOWN_FAMILIES` entry)

**Interfaces:**

- Consumes: `from catalog.models.hex_nut import _chamfered_hex_solid`; `from catalog.models.screw_common import _screw_shank`. `_chamfered_hex_solid(s, m, chamfer=None)` returns the vertex-up hex body spanning `z∈[0, m]` (bearing face at `z=0`). (No `_MIN_WALL_MM` — `hex_bolt` has no bore, so it is not imported.)
- Produces: `hex_bolt(s, k, length, d_shank, head_chamfer=None, tip_chamfer=None) -> build123d Part`. Registered as family key `"hex_bolt"`.

- [ ] **Step 1: Write the failing test**

Create `catalog/tests/test_hex_bolt.py`:

```python
import math

import pytest
from build123d import Box, Pos

from catalog.models.hex_bolt import hex_bolt

# Synthetic fixture (NOT a real standard): across-flats 18, head 8 tall, shank dia 12 x 30 long,
# 2mm lead chamfer, no head chamfer. Head z in [0,8] vertex-up; shank z in [-30,0].
CFG = dict(s=18.0, k=8.0, length=30.0, d_shank=12.0, head_chamfer=None, tip_chamfer=2.0)
CIRCUMR = CFG["s"] / math.sqrt(3.0)        # 10.39: hex corner radius (across-corners / 2)


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = hex_bolt(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["k"] + CFG["length"], 1)   # head + shank along Z
    assert round(bb.size.X, 1) == round(2 * CIRCUMR, 1)                # head across-corners on X
    assert round(bb.max.Z, 1) == round(CFG["k"], 1)                    # head top
    assert round(bb.min.Z, 1) == round(-CFG["length"], 1)             # shank free end
    assert part.volume > 0


def test_hex_head_present():
    # Vertex-up head reaches the corner radius on +X in the head band; a plain cylinder head
    # (radius s/2 = 9) would not — discriminates the hexagon.
    part = hex_bolt(**CFG)
    z = CFG["k"] / 2.0
    assert _solid_at(part, CIRCUMR - 0.4, 0.0, z, probe=0.3)          # solid out to the corner
    assert not _solid_at(part, CIRCUMR + 0.4, 0.0, z, probe=0.3)      # void beyond the corner


def test_shank_narrower_than_head():
    part = hex_bolt(**CFG)
    r = CFG["d_shank"] / 2.0                                          # 6
    z_shank = -CFG["length"] / 2.0
    assert _solid_at(part, r - 0.5, 0.0, z_shank, probe=0.4)          # shank solid to its wall
    assert not _solid_at(part, r + 0.5, 0.0, z_shank, probe=0.4)      # void just beyond the shank
    # A head-band radius (8, inside the head corners) is solid in the head but void in the shank.
    assert _solid_at(part, 8.0, 0.0, CFG["k"] / 2.0, probe=0.4)
    assert not _solid_at(part, 8.0, 0.0, z_shank, probe=0.4)


def test_solid_core_no_bore():
    part = hex_bolt(**CFG)
    assert _solid_at(part, 0.0, 0.0, CFG["k"] / 2.0, probe=0.6)       # solid on axis in the head
    assert _solid_at(part, 0.0, 0.0, -CFG["length"] / 2.0, probe=0.6) # solid on axis in the shank


def test_tip_chamfer_is_cut():
    part = hex_bolt(**CFG)
    r = CFG["d_shank"] / 2.0
    assert not _solid_at(part, r - 0.3, 0.0, -CFG["length"] + 0.3, probe=0.3)   # corner bevelled
    square = hex_bolt(**{**CFG, "tip_chamfer": None})
    assert _solid_at(square, r - 0.3, 0.0, -CFG["length"] + 0.3, probe=0.3)     # corner solid


def test_builds_at_valid_config():
    assert hex_bolt(**CFG).volume > 0
    assert hex_bolt(**{**CFG, "tip_chamfer": None}).volume > 0        # plain end also builds


def test_hex_bolt_guards():
    with pytest.raises(ValueError):
        hex_bolt(**{**CFG, "s": 0.0})                                 # non-positive dim
    with pytest.raises(ValueError):
        hex_bolt(**{**CFG, "length": 0.0})                           # non-positive dim
    with pytest.raises(ValueError):
        hex_bolt(**{**CFG, "d_shank": CFG["s"]})                     # shank not narrower than head
    with pytest.raises(ValueError):
        hex_bolt(**{**CFG, "tip_chamfer": CFG["d_shank"] / 2})       # lead chamfer >= shank radius
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_bolt.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.hex_bolt'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/hex_bolt.py`:

```python
"""Hex-head bolt family generator (ISO 4014 / 4017 and the hex-head screw family).

A chamfered hex head (reused from ``hex_nut``) with a smooth cylindrical shank hanging below it.
The shank is envelope-only (no drawn thread) and there is no bore — the external hex head is the
bolt's own drive. Modelled axis-along-Z: the head sits z in [0, k] (bearing face on z=0), the
shank z in [-length, 0]; under the default camera the front view is the hexagon end view and the
side view is the horizontal head+shank elevation.
"""
from build123d import BuildPart, add

from catalog.models.hex_nut import _chamfered_hex_solid
from catalog.models.screw_common import _screw_shank


def hex_bolt(s: float, k: float, length: float, d_shank: float,
             head_chamfer: float | None = None, tip_chamfer: float | None = None):
    """Hex-head bolt: across-flats ``s`` head of height ``k`` (vertex-up, chamfered by
    ``head_chamfer``) over a smooth shank of diameter ``d_shank`` and ``length`` (with an
    optional lead ``tip_chamfer`` at the free end). No bore, no drawn thread.
    """
    for name, val in (("s", s), ("k", k), ("length", length), ("d_shank", d_shank)):
        if val <= 0:
            raise ValueError(f"hex_bolt: need {name} > 0, got {val}")
    if d_shank >= s:
        raise ValueError(
            f"hex_bolt: d_shank {d_shank} must be < across-flats {s} (the shank emerges from "
            f"the head bearing face and is narrower than the head)")

    head = _chamfered_hex_solid(s, k, head_chamfer)          # z in [0, k], validates s/k/chamfer
    shank = _screw_shank(d_shank, length, tip_chamfer)       # z in [-length, 0], validates chamfer
    with BuildPart() as bp:
        add(head)
        add(shank)                                           # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                                     # net guard (not is_valid)
        raise ValueError("hex_bolt: produced an empty solid")
    return part
```

- [ ] **Step 4: Register the family**

In `catalog/models/_registry.py`, add the import after the `retaining_ring` import:

```python
from catalog.models.hex_bolt import hex_bolt
```

and add to the `KNOWN_FAMILIES` dict (after the `retaining_ring` entry):

```python
    "hex_bolt": hex_bolt,
```

(`_screw_shank` is a private helper, NOT a registered family.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_bolt.py -q`
Expected: PASS (all tests green). If the head and shank do not fuse into one solid (a probe finds a gap at `z=0`, or `volume` is off), the two bodies share the `z=0` plane and should fuse via `add`; if a hairline seam appears, embed the shank slightly into the head (build the shank a touch longer and shift its top a small amount above `z=0`) — do not change the tests.

- [ ] **Step 6: Commit**

```bash
git add catalog/models/hex_bolt.py catalog/tests/test_hex_bolt.py catalog/models/_registry.py
git commit -m "feat(catalog): add hex_bolt generator (ISO 4014 hex-head bolt)"
```

---

### Task 3: Data entries + build (`iso4014` + `iso4017` alias)

> **Controller sourcing gate (do BEFORE dispatching this task's implementer).** The controller
> runs a sourcing subagent (constrained to summary tools / `pdftotext`, not full-page crawling)
> plus a controller perplexity cross-check to confirm every dimension against **≥2 independent
> public tables**: the M12 ISO 4014 hex-head across-flats `s` (18), head height `k` (≈7.5), and a
> representative overall length `length` (a standard catalog length, e.g. 60 mm — documented as
> the chosen representative). `d_shank = 12` (nominal major diameter). `head_chamfer` and
> `tip_chamfer` are representative (the head top chamfer and the shank lead chamfer), documented
> as such. Confirm `iso4017`'s M12 head + the chosen length equal `iso4014`'s so the alias is
> exact. The reconciled result — including the **exact JSON** to write — goes to
> `.superpowers/sdd/sourcing-decision.md`. The implementer copies values from that file verbatim.

**Files:**

- Create: `catalog/dimensions/hex_bolts.json`
- Create: `catalog/tests/test_hex_bolts_data.py`

**Interfaces:**

- Consumes: `hex_bolt` (Task 2) via `build_part(family, shape)`; `validate_entry` from `catalog.schema`.
- Produces: `iso4014` (family `hex_bolt`, `hardwareType: "screw"`) + `iso4017` (`alias_of: "iso4014"`).

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_hex_bolts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/hex_bolts.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_hex_bolt_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 2
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_hex_bolt_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "hex_bolt", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"


def test_iso4017_aliases_iso4014():
    entries = json.loads(DATA.read_text())
    assert "iso4014" in entries and "family" in entries["iso4014"]      # base is a real drawing
    assert entries["iso4017"]["alias_of"] == "iso4014"                  # full thread -> alias
    assert entries["iso4017"]["hardwareType"] == "screw"


def test_every_hex_bolt_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_hex_bolt_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_bolts_data.py -q`
Expected: FAIL — `FileNotFoundError` (the data file does not exist yet).

- [ ] **Step 3: Write the data file from the sourcing decision**

Create `catalog/dimensions/hex_bolts.json` by copying the exact `shape` and `source` values from
`.superpowers/sdd/sourcing-decision.md` (produced by the controller sourcing gate). The structure
is fixed; the numbers come from that file. Shape below shows the required keys and illustrative
M12×60 values — the implementer uses the file's final numbers:

```json
{
	"iso4014": {
		"family": "hex_bolt",
		"shape": {
			"s": 18.0,
			"k": 7.5,
			"length": 60.0,
			"d_shank": 12.0,
			"head_chamfer": 18.0,
			"tip_chamfer": 1.5
		},
		"hardwareType": "screw",
		"source": "<from sourcing-decision.md: cites >=2 public tables; s=18, k~7.5 (M12 ISO 4014 head), length=60 representative catalog length, d_shank=12 (M12 major); head_chamfer + tip_chamfer representative; the head bearing-face chamfer from _chamfered_hex_solid is a sub-visible simplification; shank is smooth envelope (no drawn thread)>",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "4014" }]
	},
	"iso4017": {
		"alias_of": "iso4014",
		"hardwareType": "screw",
		"source": "<from sourcing-decision.md: ISO 4017 (fully threaded hex bolt) shares the M12 head and the chosen length with ISO 4014; since the shank is drawn envelope-only, the full-thread and partial-thread forms have an identical drawing, so this aliases iso4014>",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "4017" }]
	}
}
```

- [ ] **Step 4: Run the data test to verify it passes**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_bolts_data.py -q`
Expected: PASS (both entries validate; `iso4014` builds; `iso4017` alias resolves).

- [ ] **Step 5: Run the full catalog suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — all prior tests plus the three new files green.

- [ ] **Step 6: Build the catalog in-container and check invariants**

Run:

```bash
./catalog/run python -m catalog.build_catalog
git status --short catalog/out
grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts
```

Expected: one **new** file `catalog/out/iso4014.svg` in `git status` (plus a modified
`catalog/out/manifest.json`, which also records `iso4017` as an alias of `iso4014` — no separate
`iso4017.svg` file); **no** existing `catalog/out/*.svg` is modified (byte-identical); both
`grep -c` counts are `0` (opt-in gate held). **Visually confirm** `iso4014.svg` (rsvg-convert →
view): hexagon end view + head-and-shank side elevation, matching `static/images/standards/iso_4014.png`; confirm the axis-along-Z framing is acceptable for the long screw (if not, that is
the signal to add a `SCREW_PRESET` before merge).

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/hex_bolts.json catalog/tests/test_hex_bolts_data.py catalog/out/iso4014.svg catalog/out/manifest.json
git commit -m "feat(catalog): add ISO 4014 hex bolt data (+ ISO 4017 alias)"
```

---

## Self-Review

**1. Spec coverage.** `_screw_shank` shared helper with lead chamfer (Task 1) ✓; `hex_bolt` generator reusing `_chamfered_hex_solid` head + `_screw_shank` shank, no bore (Task 2) ✓; registration in `_registry.py` — 25 families (Task 2) ✓; data file `iso4014` M12×60 + `iso4017` alias with the sourcing gate (Task 3) ✓; synthetic-fixture geometry tests (envelope, hex-head discriminator, shank-narrower-than-head, solid core, tip chamfer) + shank-helper tests + data tests (incl. alias resolves) ✓; no render change — `hardwareType: "screw"` → `DEFAULT_AXIS_Z`, axis-along-Z, confirmed at build (Task 3, Step 6) ✓; opt-in 0/0 + byte-identical SVGs + in-container build (Task 3, Step 6) ✓; no forbidden source token (data test) ✓; smooth envelope shank / no thread / no bore ✓.

**2. Placeholder scan.** The only `<...>` placeholders are the two `source` strings in Task 3, intentionally filled from `.superpowers/sdd/sourcing-decision.md` at execution — the controller sourcing gate is the documented mechanism (matching shipped families), not a plan gap. All code steps carry complete code.

**3. Type consistency.** `hex_bolt(s, k, length, d_shank, head_chamfer=None, tip_chamfer=None)` and `_screw_shank(d, length, tip_chamfer=None)` are used identically in the generators, tests, registry key (`"hex_bolt"`), and the data `shape` block (keys `s, k, length, d_shank, head_chamfer, tip_chamfer`). `_chamfered_hex_solid` and `_MIN_WALL_MM` are imported from `hex_nut` (not redefined); `_screw_shank` is imported from `screw_common` (not registered). Data `family` matches the registry key and the data test's expected value; `hardwareType: "screw"` routes to `DEFAULT_AXIS_Z`.
