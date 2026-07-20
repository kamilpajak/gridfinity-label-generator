# Hex-Socket Set Screw (Grub Screw) Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a headless hex-socket set screw (grub screw) family (`set_screw`) to the maintainer-only generative catalog — one generator, four point types (flat / cone / dog / cup) — at a representative M12 × 30.

**Architecture:** New self-contained generator `catalog/models/set_screw.py`. It revolves a **point-specific outer meridian** in the XZ plane about Z (body + tip in one solid — the same revolve technique as `_screw_shank`), then subtracts a **blind hex socket** from the top face. All four points (including `cup`, whose annular rim + conical recess is expressed in a single meridian) build from one revolve + one socket subtract. Registered in `_registry.py`; data in a new `set_screws.json`. No render/preset change (`hardwareType "screw"` → `DEFAULT_AXIS_Z`).

**Tech Stack:** Python 3, build123d, pytest — all run **in the pinned container** via `./catalog/run`. Never run these on the host.

## Global Constraints

- Representative size **M12 × 30** only. No user-facing toggle (epic END goal).
- Every committed **envelope** dimension (`d`, `length`, `socket_af`, `socket_depth`) confirmed by **≥2 independent public tables**; point-specific and representative fields documented as such in the `source` string, never fabricated as normative. The M12 hex key is **6 mm** (already confirmed vs fasteners.eu DIN 916 + ISO 4029 and Aspen Fasteners DIN 916) — **not** the 10 mm of an M12 cap screw.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- **Self-contained generator:** do **not** import from or modify `socket_screw.py`, `screw_common.py`, or any existing generator. The hex-socket cut is reimplemented locally. Existing SVGs must stay **byte-identical** (`git status catalog/out` shows no change to existing files).
- **No render/preset change.** Axis-along-Z; `hardwareType "screw"` → `DEFAULT_AXIS_Z`.
- **Opt-in 0/0:** do **not** run `catalog/integrate.py`. `data/image-mappings.json` and `src/lib/data/standards-generated.ts` stay untouched — `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts` must return `0` for both.
- All builds/tests run in-container via `./catalog/run`. **Pre-warm the image once** (`./catalog/run python -c "print(1)"`) before the first timed step.
- Apply the drive-aware wall guard lesson from `socket_screw` I1: bound the hex socket **circumradius** (`socket_af/√3`), not the apothem.

---

## Task 1: `set_screw` generator + tests + registry

**Files:**

- Create: `catalog/models/set_screw.py`
- Create: `catalog/tests/test_set_screw.py`
- Modify: `catalog/models/_registry.py` (add the import + one `KNOWN_FAMILIES` entry)

**Interfaces:**

- Consumes: build123d only (`BuildPart, BuildSketch, Polygon, RegularPolygon, Plane, Axis, Mode, revolve, extrude`). No catalog imports — self-contained.
- Produces: `set_screw(d, length, socket_af, socket_depth, point, point_h=None, point_d=None, tip_chamfer=None) -> Part` and the registry key `"set_screw"`.

The fixtures in the tests below are **synthetic** — geometrically valid numbers chosen to exercise the code, **not** claimed as any real standard. Real standards come in Task 2.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_set_screw.py`:

```python
import pytest
from build123d import Box, Pos

from catalog.models.set_screw import set_screw

# Synthetic fixtures (NOT real standards): body dia 12 x 30 long, hex socket across-flats 6 x
# 4.5 deep in the top (z=30) end; point at the bottom (z=0) end. Body z in [0, 30].
BASE = dict(d=12.0, length=30.0, socket_af=6.0, socket_depth=4.5)
FLAT = {**BASE, "point": "flat"}
CONE = {**BASE, "point": "cone", "point_h": 5.0, "point_d": 3.0}
DOG = {**BASE, "point": "dog", "point_h": 4.0, "point_d": 8.0}
CUP = {**BASE, "point": "cup", "point_h": 3.0, "point_d": 8.0}


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = set_screw(**FLAT)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(FLAT["length"], 1)      # cylinder length along Z
    assert round(bb.size.X, 1) == round(FLAT["d"], 1)           # body diameter on X
    assert round(bb.max.Z, 1) == round(FLAT["length"], 1)       # top (socket) face
    assert round(bb.min.Z, 1) == 0.0                            # bottom (point) end
    assert part.volume > 0


def test_socket_is_blind_and_opens_from_the_top():
    part = set_screw(**FLAT)
    top = FLAT["length"]                                        # 30
    floor = FLAT["length"] - FLAT["socket_depth"]              # 25.5
    assert not _solid_at(part, 0.0, 0.0, top - 0.4, probe=0.3)  # void inside the socket
    assert _solid_at(part, 0.0, 0.0, floor - 0.5, probe=0.3)    # solid below the socket floor
    assert _solid_at(part, 0.0, 0.0, 15.0, probe=0.6)          # solid core mid-body


def test_flat_point_is_a_full_flat_end():
    # A flat point is solid across the whole bottom face: solid near the rim and on the axis.
    part = set_screw(**FLAT)
    assert _solid_at(part, 4.5, 0.0, 0.5, probe=0.3)           # solid near the outer bottom
    assert _solid_at(part, 0.0, 0.0, 0.5, probe=0.3)           # solid on the axis at the bottom


def test_cone_point_removes_the_bottom_outer_corner():
    # Cone tapers from r=6 at z=point_h=5 to a small flat tip (point_d/2=1.5) at z=0. At z=0.5
    # the cone radius is ~1.95, so the outer bottom is void where the flat point is solid.
    cone = set_screw(**CONE)
    flat = set_screw(**FLAT)
    assert not _solid_at(cone, 4.5, 0.0, 0.5, probe=0.3)       # cone: outer bottom cut away
    assert _solid_at(flat, 4.5, 0.0, 0.5, probe=0.3)          # flat: solid there


def test_dog_point_is_a_narrow_pilot():
    # Dog: a point_d/2=4 radius cylinder for z in [0, point_h=4]. On the axis it is solid; the
    # outer ring (r=5, beyond the dog) is void below the shoulder, where the flat point is solid.
    dog = set_screw(**DOG)
    flat = set_screw(**FLAT)
    assert _solid_at(dog, 0.0, 0.0, 2.0, probe=0.4)           # dog present on the axis
    assert not _solid_at(dog, 5.0, 0.0, 2.0, probe=0.3)       # outer ring cut to the dog dia
    assert _solid_at(flat, 5.0, 0.0, 2.0, probe=0.3)         # flat: solid there


def test_cup_point_is_a_concave_recess_with_a_rim():
    # Cup: a conical recess (apex at z=point_h=3 on the axis, mouth point_d/2=4 at z=0). On the
    # axis the bottom is void (inside the recess); the outer rim is solid.
    cup = set_screw(**CUP)
    flat = set_screw(**FLAT)
    assert not _solid_at(cup, 0.0, 0.0, 0.5, probe=0.3)       # recess void on the axis
    assert _solid_at(cup, 5.0, 0.0, 0.5, probe=0.3)          # solid rim near the outer edge
    assert _solid_at(flat, 0.0, 0.0, 0.5, probe=0.3)        # flat: solid on the axis there


@pytest.mark.parametrize("cfg", [FLAT, CONE, DOG, CUP])
def test_each_point_builds_one_solid(cfg):
    part = set_screw(**cfg)
    assert part.volume > 0
    assert len(part.solids()) == 1                            # one fused solid


def test_set_screw_guards():
    with pytest.raises(ValueError):
        set_screw(**{**FLAT, "d": 0.0})                       # non-positive dim
    with pytest.raises(ValueError):
        set_screw(**{**FLAT, "point": "ball"})               # unknown point
    with pytest.raises(ValueError):
        set_screw(**{**FLAT, "socket_af": 11.0})             # socket corner pierces the body wall
    with pytest.raises(ValueError):
        set_screw(**{**CONE, "point_d": 12.0})               # point_d not narrower than the body
    with pytest.raises(ValueError):
        set_screw(**{**CONE, "point_h": None})               # shaped point needs point_h
    with pytest.raises(ValueError):
        set_screw(**{**CONE, "socket_depth": 28.0})          # socket collides with the point
    with pytest.raises(ValueError):
        set_screw(**{**CONE, "tip_chamfer": 1.0})            # tip_chamfer is flat-only
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_set_screw.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.set_screw'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/set_screw.py`:

```python
"""Hex-socket set screw (grub screw) family generator (DIN 913/914/915/916, ISO 4026-4029).

A headless smooth cylinder (envelope-only, no drawn thread) with a BLIND hex socket in the top
(+Z) end and a point feature at the bottom (-Z) end. The four standards differ only by the point,
so ``point`` selects the tip silhouette: ``"flat"`` (din913), ``"cone"`` (din914), ``"dog"``
(din915), ``"cup"`` (din916). Modelled axis-along-Z: the body sits z in [0, length]; under the
default camera the front view is the hex-socket end view and the side view is the horizontal
cylinder+point elevation.

The body + point is one revolve of a point-specific outer meridian in the XZ plane (the same
deterministic technique as ``_screw_shank`` — no fragile edge selection); ``cup`` expresses its
annular rim + conical recess directly in that meridian, so every point is one revolve + one hex
socket subtract. The hex-socket cut is the same idiom as ``socket_screw`` but is reimplemented
here so this generator stays self-contained (no dependency on socket_screw / screw_common).
"""
import math

from build123d import (
    BuildPart, BuildSketch, Polygon, RegularPolygon, Plane, Axis, Mode, revolve, extrude,
)

_MIN_WALL_MM = 0.1               # local min wall (self-contained generator)
_POINTS = ("flat", "cone", "dog", "cup")
_RECESS_EPS = 0.05               # socket cutter overshoot above the top face for a clean rim cut


def set_screw(d: float, length: float, socket_af: float, socket_depth: float, point: str,
              point_h: float | None = None, point_d: float | None = None,
              tip_chamfer: float | None = None):
    """Headless hex-socket set screw: cylinder of diameter ``d`` and ``length`` with a blind hex
    socket (across-flats ``socket_af``, depth ``socket_depth``) in the top face and a ``point`` at
    the bottom. ``point``: "flat" (optional 45-degree ``tip_chamfer`` edge break), "cone" (tapers
    to a flat tip of diameter ``point_d`` over axial ``point_h``), "dog" (a cylindrical pilot of
    diameter ``point_d`` and length ``point_h``), or "cup" (a conical recess of mouth diameter
    ``point_d`` and depth ``point_h``, leaving an annular rim). No drawn thread.
    """
    for name, val in (("d", d), ("length", length), ("socket_af", socket_af),
                      ("socket_depth", socket_depth)):
        if val <= 0:
            raise ValueError(f"set_screw: need {name} > 0, got {val}")
    if point not in _POINTS:
        raise ValueError(f"set_screw: point must be one of {_POINTS}, got {point!r}")
    if socket_af / math.sqrt(3.0) >= d / 2.0 - _MIN_WALL_MM:
        raise ValueError(
            f"set_screw: hex socket across-flats {socket_af} (corner radius "
            f"{socket_af / math.sqrt(3.0):.3f}) leaves too thin a wall vs body radius {d / 2.0} "
            f"(needs corner < d/2 - {_MIN_WALL_MM} mm)")

    shaped = point in ("cone", "dog", "cup")
    if shaped:
        if point_h is None or point_d is None or point_h <= 0 or point_d <= 0:
            raise ValueError(
                f"set_screw: {point} point needs point_h > 0 and point_d > 0, "
                f"got point_h={point_h}, point_d={point_d}")
        if point_d >= d:
            raise ValueError(f"set_screw: point_d {point_d} must be < body d {d}")
        if point_h >= length:
            raise ValueError(f"set_screw: point_h {point_h} must be < length {length}")
    if point != "flat" and tip_chamfer is not None:
        raise ValueError("set_screw: tip_chamfer applies only to the flat point")
    if tip_chamfer is not None and not (0.0 < tip_chamfer < d / 2.0 and tip_chamfer < length):
        raise ValueError(
            f"set_screw: tip_chamfer {tip_chamfer} must be > 0 and < d/2 and < length")

    point_h_eff = point_h if shaped else 0.0
    if socket_depth >= length - point_h_eff:
        raise ValueError(
            f"set_screw: socket_depth {socket_depth} collides with the point (needs a solid core: "
            f"socket_depth < length - point-height = {length - point_h_eff})")

    r = d / 2.0
    # Outer meridian in XZ (x=radius, z=axial): body z in [0, length], point at the z=0 end.
    if point == "cone":
        profile = [(0.0, length), (r, length), (r, point_h), (point_d / 2.0, 0.0), (0.0, 0.0)]
    elif point == "dog":
        profile = [(0.0, length), (r, length), (r, point_h),
                   (point_d / 2.0, point_h), (point_d / 2.0, 0.0), (0.0, 0.0)]
    elif point == "cup":                                     # rim at z=0, conical recess to apex
        profile = [(0.0, length), (r, length), (r, 0.0), (point_d / 2.0, 0.0), (0.0, point_h)]
    elif tip_chamfer is not None:                            # flat with a 45-degree edge break
        c = tip_chamfer
        profile = [(0.0, length), (r, length), (r, c), (r - c, 0.0), (0.0, 0.0)]
    else:                                                    # plain flat
        profile = [(0.0, length), (r, length), (r, 0.0), (0.0, 0.0)]

    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)                    # explicit coords -> no auto-centring
        revolve(axis=Axis.Z, revolution_arc=360)             # body + point, one solid
        with BuildSketch(Plane.XY.offset(length - socket_depth)):   # hex socket at its floor
            RegularPolygon(radius=socket_af / 2.0, side_count=6, major_radius=False)
        extrude(amount=socket_depth + _RECESS_EPS, mode=Mode.SUBTRACT)   # blind socket from top
    part = bp.part
    if part.volume <= 0:                                     # net guard (not is_valid — sewn-shell)
        raise ValueError("set_screw: produced an empty solid")
    if len(part.solids()) != 1:                             # must be a single fused solid
        raise ValueError("set_screw: produced more than one solid")
    return part
```

- [ ] **Step 4: Register the family**

In `catalog/models/_registry.py`, add the import next to the other screw imports:

```python
from catalog.models.socket_screw import socket_screw
from catalog.models.set_screw import set_screw
```

and add the entry to `KNOWN_FAMILIES` (after `"socket_screw": socket_screw,`):

```python
    "socket_screw": socket_screw,
    "set_screw": set_screw,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_set_screw.py -v`
Expected: PASS — all tests green (4 parametrized build cases + the point/guard tests).

- [ ] **Step 6: Confirm no existing test regressed**

Run: `./catalog/run pytest catalog/tests -q`
Expected: the full catalog suite passes (existing families + the new set-screw tests).

- [ ] **Step 7: Commit**

```bash
git add catalog/models/set_screw.py catalog/tests/test_set_screw.py catalog/models/_registry.py
git commit -m "feat(catalog): add hex-socket set screw generator (flat/cone/dog/cup points)"
```

---

## Task 2: `set_screws.json` data + data test + in-container build

**Files:**

- Create: `catalog/dimensions/set_screws.json`
- Create: `catalog/tests/test_set_screws_data.py`

**Interfaces:**

- Consumes: `set_screw(...)` (Task 1) via `build_part(family, shape)`; `catalog.schema.validate_entry(sid, entry)`.
- Produces: rendered SVGs under `catalog/out/` for the four base standards (din913-916); the four ISO ids alias them.

**SOURCING GATE — do this before writing final numbers.** Envelope fields are **normative, ≥2 independent public tables**. Already confirmed: `socket_af=6.0`, `socket_depth≈4.5` (fasteners.eu DIN 916 + ISO 4029, Aspen Fasteners DIN 916); `d=12.0` (M12 major); `length=30.0` representative. Confirm the **point-specific** fields for M12 (tables often live in PDFs — Perplexity and the Playwright MCP may be used to read them):

- **din914 cone:** cone point angle (90° for M12) and tip flat diameter `dt` → `point_d`; derive `point_h` from the 90° cone (`point_h ≈ (d - point_d)/2`) as representative, documented.
- **din915 dog:** dog diameter `dp` (`point_d`, ≈8 for M12) and dog length `z` (`point_h`, ≈6 for M12) — both tabulated; confirm vs ≥2 tables.
- **din916 cup:** cup mouth diameter `dv` (`point_d`, ≈7.6 for M12 per Aspen 8 max / 7.64 min) — tabulated; `point_h` (cup depth) representative.
- **din913 flat:** plain flat end; optional representative `tip_chamfer` (≈1.0 mm, the DIN 913 chamfered edge), documented as representative.
  Each `source` string states tabulated vs representative fields, cites ≥2 public tables, names **no** private catalogue.

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_set_screws_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/set_screws.json")
_FORBIDDEN = ("reyher", "stalmut")
_ALIASES = {"iso4026": "din913", "iso4027": "din914", "iso4028": "din915", "iso4029": "din916"}


def test_every_set_screw_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 8                                  # 4 bases + 4 aliases
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_set_family_hardware_type_and_point():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "set_screw", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"
        assert entry["shape"]["point"] in ("flat", "cone", "dog", "cup")


def test_iso_aliases_point_at_their_din_bases():
    entries = json.loads(DATA.read_text())
    for iso_id, din_id in _ALIASES.items():
        assert din_id in entries and "family" in entries[din_id], f"{din_id} base missing"
        assert entries[iso_id]["alias_of"] == din_id, f"{iso_id} must alias {din_id}"
        assert "alias_of" not in entries[din_id], f"{din_id} must be a base, not an alias"


def test_every_set_screw_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_set_screw_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the data test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_set_screws_data.py -v`
Expected: FAIL — `FileNotFoundError` on `set_screws.json`.

- [ ] **Step 3: Write the data file (after the sourcing gate)**

Create `catalog/dimensions/set_screws.json`. The point-specific numbers below are **candidates** — confirm/correct each at the sourcing gate before committing, and rewrite each `source` string to cite the tables you actually read. The envelope fields (`d`, `length`, `socket_af`, `socket_depth`) are already confirmed and used verbatim.

```json
{
	"din913": {
		"family": "set_screw",
		"shape": {
			"d": 12.0,
			"length": 30.0,
			"socket_af": 6.0,
			"socket_depth": 4.5,
			"point": "flat",
			"tip_chamfer": 1.0
		},
		"hardwareType": "screw",
		"source": "DIN 913 hexagon socket set screw with flat point, M12 x 30 (representative length). socket_af=6.0 and socket_depth=4.5 tabulated (fasteners.eu DIN 916/ISO 4029 + Aspen Fasteners DIN 916); d=12.0 (M12 major). Cylinder drawn as a smooth envelope (no thread). tip_chamfer=1.0 is a representative flat-point edge break.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "913" }]
	},
	"iso4026": {
		"alias_of": "din913",
		"hardwareType": "screw",
		"source": "ISO 4026 hexagon socket set screw with flat point, M12 — same envelope as DIN 913 (socket_af=6.0, socket_depth=4.5), so it aliases the DIN base. Confirmed vs fasteners.eu ISO 4026/4029 + Aspen.",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "4026" }]
	},
	"din914": {
		"family": "set_screw",
		"shape": {
			"d": 12.0,
			"length": 30.0,
			"socket_af": 6.0,
			"socket_depth": 4.5,
			"point": "cone",
			"point_h": 5.25,
			"point_d": 1.5
		},
		"hardwareType": "screw",
		"source": "DIN 914 hexagon socket set screw with cone point, M12 x 30. socket_af=6.0/socket_depth=4.5 tabulated; cone point is 90 degrees for M12 (tabulated angle) with a small flat tip point_d=1.5 (representative) -> point_h=(d-point_d)/2=5.25 representative for the 90-degree cone. Confirm vs >=2 tables.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "914" }]
	},
	"iso4027": {
		"alias_of": "din914",
		"hardwareType": "screw",
		"source": "ISO 4027 cone-point socket set screw, M12 — same envelope + cone as DIN 914, aliases the DIN base. Confirmed vs fasteners.eu + Aspen.",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "4027" }]
	},
	"din915": {
		"family": "set_screw",
		"shape": {
			"d": 12.0,
			"length": 30.0,
			"socket_af": 6.0,
			"socket_depth": 4.5,
			"point": "dog",
			"point_h": 6.0,
			"point_d": 8.0
		},
		"hardwareType": "screw",
		"source": "DIN 915 hexagon socket set screw with dog point, M12 x 30. socket_af=6.0/socket_depth=4.5 tabulated; dog diameter dp=8.0 (point_d) and dog length z=6.0 (point_h) tabulated for M12. Confirm vs >=2 tables.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "915" }]
	},
	"iso4028": {
		"alias_of": "din915",
		"hardwareType": "screw",
		"source": "ISO 4028 dog-point socket set screw, M12 — same envelope + dog as DIN 915, aliases the DIN base. Confirmed vs fasteners.eu + Aspen.",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "4028" }]
	},
	"din916": {
		"family": "set_screw",
		"shape": {
			"d": 12.0,
			"length": 30.0,
			"socket_af": 6.0,
			"socket_depth": 4.5,
			"point": "cup",
			"point_h": 2.0,
			"point_d": 7.6
		},
		"hardwareType": "screw",
		"source": "DIN 916 hexagon socket set screw with cup point, M12 x 30. socket_af=6.0/socket_depth=4.5 and cup mouth diameter dv=7.6 (point_d, from 8 max / 7.64 min) tabulated (fasteners.eu + Aspen DIN 916); cup depth point_h=2.0 representative. d=12.0 (M12 major).",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "916" }]
	},
	"iso4029": {
		"alias_of": "din916",
		"hardwareType": "screw",
		"source": "ISO 4029 cup-point socket set screw, M12 — same envelope + cup as DIN 916, aliases the DIN base. Confirmed vs fasteners.eu ISO 4029 + Aspen.",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "4029" }]
	}
}
```

Rules while filling in:

- One **base** entry (`family` + `shape`) per point; each ISO id is an `alias_of` its DIN base (a base, never another alias).
- Keep `d=12.0`, `length=30.0`, `socket_af=6.0`, `socket_depth=4.5` identical across all four bases (same body + socket; only the point differs).
- `verified: true` only when the entry's fields were actually cross-checked (the data test enforces the flag; you enforce the truth).

- [ ] **Step 4: Run the data test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_set_screws_data.py -v`
Expected: PASS — all five checks green.

- [ ] **Step 5: Build the catalog in-container and confirm the new drawings render**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: build succeeds; new `catalog/out/din913.svg`, `din914.svg`, `din915.svg`, `din916.svg` appear (the four ISO aliases reuse the DIN svgs/shas).

- [ ] **Step 6: Verify existing SVGs are byte-identical and opt-in stays 0/0**

Run: `git status --short catalog/out`
Expected: only **new** set-screw SVG files listed; **no** modifications to existing SVGs. (If `manifest.json` shows a whitespace-only reformat with identical content, discard it with `git checkout -- catalog/out/manifest.json`.)

Run: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts`
Expected: `0` for both files (opt-in invariant preserved — `integrate.py` was not run).

- [ ] **Step 7: Run the full catalog suite once more**

Run: `./catalog/run pytest catalog/tests -q`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add catalog/dimensions/set_screws.json catalog/tests/test_set_screws_data.py catalog/out
git commit -m "feat(catalog): add M12 hex-socket set screw standards (DIN 913-916 / ISO 4026-4029)"
```

---

## Self-review notes (for the executor)

- **Spec coverage:** Task 1 delivers the generator (four points via one revolve + socket subtract), the drive-aware wall guard, collision guard, and registration; Task 2 delivers the data (≥2-table sourcing gate, key size 6 mm already confirmed), the data test, the in-container build, and the opt-in/byte-identical checks. Silhouette mapping (flat/cone/dog/cup), envelope-only body, blind socket, and DIN→ISO aliases are all encoded.
- **Signature consistency:** `set_screw(d, length, socket_af, socket_depth, point, point_h=None, point_d=None, tip_chamfer=None)` is identical in the generator, the tests, and the data `shape` keys.
- **Self-contained:** imports build123d only — no `socket_screw` / `screw_common` dependency, no modification to existing generators; existing SVGs byte-identical.
- **Visual confirmation before merge:** all four drawings checked — each point reads correctly (flat / cone / dog / cup) and the M12×30 frames acceptably under `DEFAULT_AXIS_Z`.
- **Not covered by design (leave alone):** integration into the app (`integrate.py`), `image-mappings.json`, `standards-generated.ts`, any render/preset change, slotted-drive set screws — all out of scope by the opt-in invariant and the spec's non-goals.

```

```
