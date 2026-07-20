# Slotted & Cross-Recess Machine Screw Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `slotted_screw` generator and data so the catalog ships seven slotted &
cross-recess machine screws (DIN 84/85/963/966 + ISO 7045/7046/7047) at a representative M10.

**Architecture:** A new self-contained generator `catalog/models/slotted_screw.py` reuses the
shared `_screw_shank` (top face on the under-head bearing plane `z=0`) and builds a shaped head
above it, then subtracts a slot or cross recess from the head top. Two orthogonal string
parameters select the standard: `head` (cheese / pan / countersunk / raised) and `drive` (slot /
cross). Flat-topped heads are one revolve of a straight-segment XZ meridian (the `set_screw`
technique); domed portions reuse the `cap_nut` spherical-cap idiom (a `Sphere` trimmed by a `Box`).
The cross recess is a representative tapered-pyramidal icon built with `loft()`.

**Tech Stack:** Python, `build123d` (run **only** in the pinned container via `./catalog/run`),
pytest.

## Global Constraints

- Representative size **M10** (deliberate deviation from the epic M12: M12 is out of range for the
  dimensional tables of ISO 1207, ISO 1580 / DIN 84, DIN 85, and the ISO 7045/7046/7047 series).
- Ships **7 base drawings** — `din84`, `din85`, `din963`, `din966`, `iso7045`, `iso7046`,
  `iso7047` — + **6 aliases** — `iso1207`, `iso1580`, `iso2009`, `iso2010` (alias the DIN slotted
  bases) and `din7985`, `din965` (alias the ISO cross bases). `iso7047` has **no** alias.
- Every committed **envelope** dimension (`dk`, `k`, `length`, `d_shank`) confirmed by **≥2
  independent public tables**; drive-, crown-, and raised-lens fields tabulated where the standard
  defines them, else documented as representative. Never fabricate a value as normative.
- The cross recess is a **representative** tapered-pyramidal icon, **not** the dimensioned ISO 4757
  form (same philosophy as the Torx lobular in `socket_screw`).
- `source` strings cite only public tables — **no** `reyher`, `stalmut`, or any private catalogue;
  `verified: true` only after the cross-check.
- New self-contained generator: do **not** modify `socket_screw.py`, `set_screw.py`, or any
  existing generator, and add **nothing** to `screw_common.py` (only consume `_screw_shank`).
- **Opt-in invariant 0/0:** do not touch `data/image-mappings.json` or
  `src/lib/data/standards-generated.ts` (`grep -c '.svg'` on the diff of both must be 0); do not run
  `integrate.py`. Existing SVGs stay **byte-identical** after rebuild.
- `hardwareType: "screw"` → `DEFAULT_AXIS_Z`. **No render/preset change.** Smooth envelope shank
  (no drawn thread).
- All `build123d` work runs in-container: `./catalog/run python -m pytest ...` and
  `./catalog/run python -m catalog.build_catalog`. Never run build123d on the host.

---

### Task 1: `slotted_screw` generator + registry

**Files:**

- Create: `catalog/models/slotted_screw.py`
- Modify: `catalog/models/_registry.py` (add the import + `KNOWN_FAMILIES` entry, after
  `set_screw`)
- Test: `catalog/tests/test_slotted_screw.py`

**Interfaces:**

- Consumes: `_screw_shank(d, length, tip_chamfer=None)` from `catalog.models.screw_common` —
  returns a `build123d` part, shank `z ∈ [-length, 0]`, top face on `z=0`, validates
  `tip_chamfer`.
- Produces: `slotted_screw(head, drive, dk, k, length, d_shank, drive_w, drive_t, crown_r=None,
raised_f=None, drive_m=None, tip_chamfer=None)` → a single fused `build123d` part; head above
  `z=0`, shank below. Registered under family key `"slotted_screw"`.

- [ ] **Step 1: Write the failing generator tests**

Create `catalog/tests/test_slotted_screw.py` with the complete content below. Fixtures are
**synthetic** (geometrically valid, not any real standard). Head fixtures share `dk=16, k=6` so
head-shape probes discriminate cleanly; `raised` lowers the cone to `k=5` and adds a `raised_f=1.5`
lens (apex at `z=6.5`).

```python
import pytest
from build123d import Box, Pos

from catalog.models.slotted_screw import slotted_screw

# Synthetic fixtures (NOT real standards). Head z in [0, k] (raised -> k+raised_f); shank z in
# [-length, 0]. Slot: width drive_w in Y, spans X edge-to-edge, depth drive_t from the crown.
CHEESE = dict(head="cheese", drive="slot", dk=16.0, k=6.0, length=30.0, d_shank=10.0,
              drive_w=2.5, drive_t=2.0)
PAN = {**CHEESE, "head": "pan"}
CSK = {**CHEESE, "head": "countersunk"}
RAISED = {**CHEESE, "head": "raised", "k": 5.0, "raised_f": 1.5}       # cone k=5, lens to z=6.5
CROSS = {**CHEESE, "drive": "cross", "drive_m": 8.0, "drive_w": 2.0, "drive_t": 2.0}


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart -- it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = slotted_screw(**CHEESE)
    bb = part.bounding_box()
    assert round(bb.max.Z, 1) == round(CHEESE["k"], 1)                  # cheese flat top at z=k
    assert round(bb.min.Z, 1) == round(-CHEESE["length"], 1)           # shank free end
    assert round(bb.size.X, 1) == round(CHEESE["dk"], 1)              # head diameter on X
    assert part.volume > 0


def test_shank_hangs_below_the_bearing_plane():
    part = slotted_screw(**CHEESE)
    assert _solid_at(part, 0.0, 0.0, -15.0, probe=0.6)                # solid mid-shank
    assert _solid_at(part, 0.0, 0.0, 3.0, probe=0.6)                  # solid mid-head
    assert not _solid_at(part, 7.0, 0.0, -1.0, probe=0.3)            # outside the shank (r=5) below z=0


def test_countersunk_cone_removes_outer_head_material_cheese_keeps():
    # cheese: cylinder r=8 for all z in [0,6]. csk: cone r=5 at z=0 -> r=8 at z=6, so at z=3 the
    # cone radius is 6.5. Probe (7.5,0,3): cheese solid (7.5<8), csk void (7.5>6.5).
    cheese = slotted_screw(**CHEESE)
    csk = slotted_screw(**CSK)
    assert _solid_at(cheese, 7.5, 0.0, 3.0, probe=0.3)               # cheese: solid outer wall
    assert not _solid_at(csk, 7.5, 0.0, 3.0, probe=0.3)            # csk: cone cut away there


def test_pan_dome_falls_away_from_the_rim_cheese_keeps():
    # pan: spherical cap, base r=8 at z=0, apex at z=6. Near the rim at z=5.5 the dome radius is
    # well under 8, so (7.0,0,5.5) is void where the cheese cylinder is solid.
    cheese = slotted_screw(**CHEESE)
    pan = slotted_screw(**PAN)
    assert _solid_at(cheese, 7.0, 0.0, 5.5, probe=0.3)              # cheese: solid near top rim
    assert not _solid_at(pan, 7.0, 0.0, 5.5, probe=0.3)           # pan: domed away there


def test_raised_lens_adds_material_above_the_cone_top():
    # raised: cone top flat at z=k=5; a lens rises to z=6.5. csk (no lens) is empty above z=5.
    raised = slotted_screw(**RAISED)
    csk = slotted_screw(**{**CSK, "k": 5.0})
    assert _solid_at(raised, 0.0, 0.0, 5.8, probe=0.3)             # raised: lens on the axis
    assert not _solid_at(csk, 0.0, 0.0, 5.8, probe=0.3)          # csk: nothing above the flat top


def test_slot_is_blind_and_spans_edge_to_edge():
    part = slotted_screw(**CHEESE)
    floor = CHEESE["k"] - CHEESE["drive_t"]                        # 4.0
    assert not _solid_at(part, 0.0, 0.0, 5.0, probe=0.3)          # void inside the slot on the axis
    assert not _solid_at(part, 7.5, 0.0, 5.0, probe=0.3)         # slot reaches near the head edge
    assert _solid_at(part, 0.0, 3.0, 5.0, probe=0.3)            # solid off the slot in Y
    assert _solid_at(part, 0.0, 0.0, floor - 0.5, probe=0.3)    # solid below the slot floor (blind)


def test_cross_is_a_four_arm_recess_and_blind():
    part = slotted_screw(**CROSS)
    floor = CROSS["k"] - CROSS["drive_t"]                         # 4.0
    assert not _solid_at(part, 3.0, 0.0, 5.7, probe=0.2)         # void on the +X arm
    assert not _solid_at(part, 0.0, 3.0, 5.7, probe=0.2)        # void on the +Y arm
    assert _solid_at(part, 2.1, 2.1, 5.7, probe=0.2)           # solid on the 45-degree diagonal
    assert _solid_at(part, 0.0, 0.0, floor - 0.5, probe=0.3)   # solid below the recess floor (blind)


@pytest.mark.parametrize("head", ["cheese", "pan", "countersunk", "raised"])
@pytest.mark.parametrize("drive", ["slot", "cross"])
def test_every_head_and_drive_builds_one_solid(head, drive):
    cfg = {**CHEESE, "head": head, "drive": drive}
    if head == "raised":
        cfg = {**cfg, "k": 5.0, "raised_f": 1.5}
    if drive == "cross":
        cfg = {**cfg, "drive_m": 8.0, "drive_w": 2.0, "drive_t": 2.0}
    part = slotted_screw(**cfg)
    assert part.volume > 0
    assert len(part.solids()) == 1                                # head + shank fused


def test_slotted_screw_guards():
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "dk": 0.0})                    # non-positive dim
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "head": "button"})            # unknown head
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "drive": "torx"})             # unknown drive
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "d_shank": 16.0})             # shank not narrower than the head
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "head": "raised", "raised_f": None})   # raised needs raised_f
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "crown_r": 10.0})             # crown_r not < min(dk/2, k)
    with pytest.raises(ValueError):
        slotted_screw(**{**CROSS, "drive_m": None})              # cross needs drive_m
    with pytest.raises(ValueError):
        slotted_screw(**{**CROSS, "drive_w": 8.0})               # cross drive_w not < drive_m
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "drive_t": 6.0})              # recess not blind (drive_t >= k)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_slotted_screw.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.slotted_screw'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/slotted_screw.py` with exactly this content:

```python
"""Slotted & cross-recess machine screw family generator (DIN 84/85/963/966,
ISO 1207/1580/2009/2010/7045/7046/7047).

A smooth cylindrical shank (envelope-only, no drawn thread) with a shaped head on top and a slot
or cross recess cut into the head. Two orthogonal features select the standard: ``head`` picks the
head silhouette (cheese / pan / countersunk / raised) and ``drive`` picks the recess (slot /
cross). The shank reuses the shared ``_screw_shank`` (top face on the under-head bearing plane
z=0, built down -Z); the head is built above z=0 so a plain add() fuses head and shank into one
solid.

Flat-topped heads (cheese, countersunk) are one revolve of a straight-segment XZ meridian (the
deterministic set_screw technique). Domed portions (the pan crown, the raised lens) reuse the
cap_nut spherical-cap idiom: a Sphere trimmed by a Box to a cap of the required height seated on
its base circle -- so the crown needs no arc-meridian and no radius parameter (the sphere radius
is derived, R = (r**2 + h**2) / (2h)). The cross recess is a REPRESENTATIVE tapered-pyramidal icon
(a lofted four-arm cutter), not the dimensioned ISO 4757 curve. Modelled axis-along-Z: under the
default camera the front view is the head end view (slot/cross) and the side view is the
horizontal head+shank elevation.
"""
from build123d import (
    BuildPart, BuildSketch, Polygon, Rectangle, Sphere, Box, Plane, Axis, Align, Mode,
    Locations, add, revolve, loft,
)

from catalog.models.screw_common import _screw_shank

_HEADS = ("cheese", "pan", "countersunk", "raised")
_DRIVES = ("slot", "cross")
_RECESS_EPS = 0.05           # drive cutter overshoot above the crown for a clean rim cut
_CROSS_TAPER = 0.35          # cross floor arm-span as a fraction of the surface span (converging)
_SLOT_OVERHANG = 2.0         # slot cutter length past the head diameter, so it spans edge-to-edge


def _spherical_cap(base_r: float, base_z: float, height: float):
    """A solid spherical cap of ``height`` seated on the circle of radius ``base_r`` at plane
    ``z = base_z`` (apex at ``base_z + height``). Built as a full Sphere trimmed to the half-space
    ``z >= base_z`` -- the cap_nut idiom (deterministic, no arc-meridian). The cap's flat base
    circle has radius exactly ``base_r``."""
    sphere_r = (base_r ** 2 + height ** 2) / (2.0 * height)        # cap height -> sphere radius R
    z_c = base_z + height - sphere_r                              # sphere centre on the Z axis
    big = 4.0 * (sphere_r + height + abs(base_z))                 # trim box, larger than the cap
    with BuildPart() as cap:
        with Locations((0.0, 0.0, z_c)):
            Sphere(radius=sphere_r)
        with Locations((0.0, 0.0, base_z - big / 2.0)):
            Box(big, big, big, mode=Mode.SUBTRACT)                # keep only z >= base_z
    return cap.part


def _head_solid(head: str, dk: float, k: float, d_shank: float,
                crown_r: float | None, raised_f: float | None):
    """The head solid, bearing face on z=0, occupying z in [0, k] (``raised`` extends to
    z = k + raised_f). (x=radius, z=axial) meridians are revolved about Z."""
    r = dk / 2.0
    if head == "cheese":
        if crown_r is not None:                                   # small 45-deg top-edge break
            c = crown_r
            profile = [(0.0, 0.0), (r, 0.0), (r, k - c), (r - c, k), (0.0, k)]
        else:
            profile = [(0.0, 0.0), (r, 0.0), (r, k), (0.0, k)]
        with BuildPart() as bp:
            with BuildSketch(Plane.XZ):
                Polygon(*profile, align=None)
            revolve(axis=Axis.Z, revolution_arc=360)
        return bp.part
    if head == "pan":                                             # shallow dome from the base circle
        return _spherical_cap(r, 0.0, k)
    # countersunk cone frustum: radius d_shank/2 at z=0 widening to dk/2 at the flush flat top z=k
    profile = [(0.0, 0.0), (d_shank / 2.0, 0.0), (r, k), (0.0, k)]
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)
        revolve(axis=Axis.Z, revolution_arc=360)
        if head == "raised":
            add(_spherical_cap(r, k, raised_f))                   # raised lens on the cone top
    return bp.part


def _drive_cutter(drive: str, dk: float, drive_w: float, drive_t: float,
                  drive_m: float | None, top_z: float):
    """A cutter solid removed from the head top to form the drive. Its top sits ``_RECESS_EPS``
    above ``top_z`` so the rim cuts cleanly; the recess floor is flat at ``top_z - drive_t``."""
    top = top_z + _RECESS_EPS
    depth = drive_t + _RECESS_EPS
    if drive == "slot":
        span = dk + _SLOT_OVERHANG                                # edge-to-edge, past both rims
        with BuildPart() as cut:
            with Locations((0.0, 0.0, top)):
                Box(span, drive_w, depth, align=(Align.CENTER, Align.CENTER, Align.MAX))
        return cut.part
    # cross: a lofted tapered four-arm cutter, wide "+" at the surface converging toward the floor
    floor_m = drive_m * _CROSS_TAPER
    floor_w = drive_w * _CROSS_TAPER
    with BuildPart() as cut:
        with BuildSketch(Plane.XY.offset(top)):                   # full-size cross at the surface
            Rectangle(drive_m, drive_w)
            Rectangle(drive_w, drive_m)
        with BuildSketch(Plane.XY.offset(top - depth)):           # smaller cross at the floor
            Rectangle(floor_m, floor_w)
            Rectangle(floor_w, floor_m)
        loft()
    return cut.part


def slotted_screw(head: str, drive: str, dk: float, k: float, length: float, d_shank: float,
                  drive_w: float, drive_t: float, crown_r: float | None = None,
                  raised_f: float | None = None, drive_m: float | None = None,
                  tip_chamfer: float | None = None):
    """Slotted / cross-recess machine screw: a shaped ``head`` of diameter ``dk`` and height ``k``
    over a smooth shank of diameter ``d_shank`` and ``length`` (optional lead ``tip_chamfer``), with
    a ``drive`` recess of width ``drive_w`` and depth ``drive_t`` cut into the head top. ``head`` is
    "cheese" (cylinder, optional ``crown_r`` edge break), "pan" (spherical-cap dome), "countersunk"
    (flat cone frustum), or "raised" (cone + a ``raised_f`` spherical lens). ``drive`` is "slot"
    (one straight edge-to-edge slot) or "cross" (a representative tapered-pyramidal four-arm recess
    of overall span ``drive_m``). No through bore, no drawn thread.
    """
    for name, val in (("dk", dk), ("k", k), ("length", length), ("d_shank", d_shank),
                      ("drive_w", drive_w), ("drive_t", drive_t)):
        if val <= 0:
            raise ValueError(f"slotted_screw: need {name} > 0, got {val}")
    if head not in _HEADS:
        raise ValueError(f"slotted_screw: head must be one of {_HEADS}, got {head!r}")
    if drive not in _DRIVES:
        raise ValueError(f"slotted_screw: drive must be one of {_DRIVES}, got {drive!r}")
    if d_shank >= dk:
        raise ValueError(
            f"slotted_screw: d_shank {d_shank} must be < head diameter {dk} "
            f"(the shank emerges from the head bearing face and is narrower than the head)")
    if head == "raised" and (raised_f is None or raised_f <= 0):
        raise ValueError(f"slotted_screw: raised head needs raised_f > 0, got {raised_f}")
    if head == "cheese" and crown_r is not None and not (0.0 < crown_r < min(dk / 2.0, k)):
        raise ValueError(
            f"slotted_screw: crown_r {crown_r} must be > 0 and < min(dk/2, k) = {min(dk / 2.0, k)}")
    if drive == "cross":
        if drive_m is None or drive_m <= 0:
            raise ValueError(f"slotted_screw: cross drive needs drive_m > 0, got {drive_m}")
        if drive_m > dk:
            raise ValueError(
                f"slotted_screw: cross drive_m {drive_m} must be <= head diameter {dk}")
        if drive_w >= drive_m:
            raise ValueError(
                f"slotted_screw: cross drive_w {drive_w} must be < drive_m {drive_m} "
                f"(the arm is narrower than the overall cross span)")
    elif drive_w >= dk:
        raise ValueError(f"slotted_screw: slot drive_w {drive_w} must be < head diameter {dk}")
    if drive_t >= k:
        raise ValueError(
            f"slotted_screw: drive_t {drive_t} must be < head height k {k} "
            f"(the recess is blind -- a floor of head metal must remain below it)")

    shank = _screw_shank(d_shank, length, tip_chamfer)            # z in [-length, 0], validates chamfer
    head_solid = _head_solid(head, dk, k, d_shank, crown_r, raised_f)
    top_z = k + raised_f if head == "raised" else k              # head's maximum-Z plane
    cutter = _drive_cutter(drive, dk, drive_w, drive_t, drive_m, top_z)
    with BuildPart() as bp:
        add(head_solid)                                          # head z in [0, top_z]
        add(shank)                                               # shares the z=0 face -> fuses
        add(cutter, mode=Mode.SUBTRACT)                          # slot / cross recess from the top
    part = bp.part
    if part.volume <= 0:                                         # net guard (not is_valid -- sewn-shell)
        raise ValueError("slotted_screw: produced an empty solid")
    if len(part.solids()) != 1:                                  # head and shank must FUSE, not touch
        raise ValueError("slotted_screw: head and shank did not fuse into a single solid")
    return part
```

- [ ] **Step 4: Run the generator tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_slotted_screw.py -q`
Expected: PASS (all tests). If `loft()` on the crossed-rectangle sketches errors, confirm both
`BuildSketch` blocks produce a single cross face (two `Rectangle` calls default to `Mode.ADD`) and
that `floor_m, floor_w > 0` (they are, given the guards).

- [ ] **Step 5: Register the family**

In `catalog/models/_registry.py`, add the import next to the other screw imports (after the
`set_screw` import line):

```python
from catalog.models.slotted_screw import slotted_screw
```

and add the entry to `KNOWN_FAMILIES`, immediately after the `"set_screw": set_screw,` line:

```python
    "slotted_screw": slotted_screw,
```

- [ ] **Step 6: Run the full catalog test suite to verify nothing regressed**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — the prior suite plus the new `test_slotted_screw.py` tests, no failures.

- [ ] **Step 7: Commit**

```bash
git add catalog/models/slotted_screw.py catalog/models/_registry.py catalog/tests/test_slotted_screw.py
git commit -m "feat(catalog): add slotted_screw generator (heads x slot/cross drive)"
```

---

### Task 2: Data entries, data tests, and rendered drawings

**Files:**

- Create: `catalog/dimensions/slotted_screws.json`
- Create: `catalog/tests/test_slotted_screws_data.py`
- Build output (generated, committed): `catalog/out/din84.svg`, `din85.svg`, `din963.svg`,
  `din966.svg`, `iso7045.svg`, `iso7046.svg`, `iso7047.svg`, and the additive `catalog/out/manifest.json` change.

**Interfaces:**

- Consumes: `slotted_screw(...)` (Task 1, registered as family `"slotted_screw"`);
  `validate_entry(id, entry)` from `catalog.schema`; `build_part(family, shape)` from
  `catalog.models._registry`.
- Produces: 13 data entries (7 bases + 6 aliases) that validate, build, and render.

**SOURCING GATE (controller-supplied — do NOT invent numbers).** The exact numeric dimensions for
every entry (`dk`, `k`, `length`, `d_shank`, `drive_w`, `drive_t`, `crown_r`, `raised_f`,
`drive_m`) are provided to this task by the controller's sourcing gate, each confirmed against ≥2
independent public tables and written into the `source` string as tabulated vs representative. The
implementer writes those exact values into the JSON in the shape below; it must not guess or
fabricate any dimension. Base/alias structure, `family`, `head`, `drive`, and the `source`-string
requirements are fixed by this plan.

- [ ] **Step 1: Write the failing data tests**

Create `catalog/tests/test_slotted_screws_data.py` with exactly this content:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/slotted_screws.json")
_FORBIDDEN = ("reyher", "stalmut")
# ISO aliases -> DIN slotted bases; DIN aliases -> ISO cross bases. iso7047 has NO alias.
_ALIASES = {
    "iso1207": "din84", "iso1580": "din85", "iso2009": "din963", "iso2010": "din966",
    "din7985": "iso7045", "din965": "iso7046",
}
_BASES = {"din84", "din85", "din963", "din966", "iso7045", "iso7046", "iso7047"}
_HEADS = ("cheese", "pan", "countersunk", "raised")
_DRIVES = ("slot", "cross")


def test_every_slotted_screw_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) == 13                                     # 7 bases + 6 aliases
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_bases_and_family_head_drive():
    entries = json.loads(DATA.read_text())
    bases = {sid for sid, e in entries.items() if "alias_of" not in e}
    assert bases == _BASES
    for sid in bases:
        entry = entries[sid]
        assert entry["family"] == "slotted_screw", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"
        assert entry["shape"]["head"] in _HEADS
        assert entry["shape"]["drive"] in _DRIVES


def test_aliases_point_at_their_bases_and_iso7047_has_none():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _ALIASES.items():
        assert base_id in entries and "family" in entries[base_id], f"{base_id} base missing"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert "alias_of" not in entries[base_id], f"{base_id} must be a base, not an alias"
    assert "alias_of" not in entries["iso7047"], "iso7047 must be a base"
    assert not any(e.get("alias_of") == "iso7047" for e in entries.values()), \
        "iso7047 must have no alias"


def test_every_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_sources_state_m10_and_name_no_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        assert "m10" in low, f"{sid}: source must state the M10 representative size"
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the data tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_slotted_screws_data.py -q`
Expected: FAIL — `FileNotFoundError` / cannot read `catalog/dimensions/slotted_screws.json`.

- [ ] **Step 3: Write the data file**

Create `catalog/dimensions/slotted_screws.json` with the 13 entries in the exact shape shown by
this **template** (a base and an alias). Fill every numeric field from the controller's sourcing
gate values — do **not** copy the illustrative numbers below, which are shape-only placeholders and
must be replaced by the sourced M10 dimensions. Each `source` must name the ≥2 public tables, state
the **M10** representative size and why M12 was not used, and flag each field as tabulated vs
representative.

Base entry shape (slotted DIN base; cross ISO bases add `"drive_m"` and set `"drive": "cross"`):

```json
{
	"din84": {
		"family": "slotted_screw",
		"shape": {
			"head": "cheese",
			"drive": "slot",
			"dk": 16.0,
			"k": 6.0,
			"length": 30.0,
			"d_shank": 10.0,
			"drive_w": 2.5,
			"drive_t": 3.0,
			"crown_r": 0.5
		},
		"hardwareType": "screw",
		"source": "<per-standard sourcing text: DIN 84 / ISO 1207 slotted cheese head, M10 (representative; M12 exceeds the ISO 1207 range). dk, k, slot width n=drive_w, slot depth t=drive_t tabulated vs >=2 public tables (name them); crown_r representative edge break; length representative; d_shank=10.0 M10 major.>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "84" }]
	},
	"iso1207": {
		"alias_of": "din84",
		"hardwareType": "screw",
		"source": "<ISO 1207 slotted cheese head, M10 -- same envelope as DIN 84, aliases the DIN base. Confirmed vs the same >=2 public tables.>",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "1207" }]
	}
}
```

Entries to produce (exactly these ids, `family`/`head`/`drive`/alias fixed here; numbers from the
sourcing gate):

| id        | kind  | family (base) | head        | drive | alias_of  | designation |
| --------- | ----- | ------------- | ----------- | ----- | --------- | ----------- |
| `din84`   | base  | slotted_screw | cheese      | slot  | —         | DIN 84      |
| `iso1207` | alias | —             | —           | —     | `din84`   | ISO 1207    |
| `din85`   | base  | slotted_screw | pan         | slot  | —         | DIN 85      |
| `iso1580` | alias | —             | —           | —     | `din85`   | ISO 1580    |
| `din963`  | base  | slotted_screw | countersunk | slot  | —         | DIN 963     |
| `iso2009` | alias | —             | —           | —     | `din963`  | ISO 2009    |
| `din966`  | base  | slotted_screw | raised      | slot  | —         | DIN 966     |
| `iso2010` | alias | —             | —           | —     | `din966`  | ISO 2010    |
| `iso7045` | base  | slotted_screw | pan         | cross | —         | ISO 7045    |
| `din7985` | alias | —             | —           | —     | `iso7045` | DIN 7985    |
| `iso7046` | base  | slotted_screw | countersunk | cross | —         | ISO 7046    |
| `din965`  | alias | —             | —           | —     | `iso7046` | DIN 965     |
| `iso7047` | base  | slotted_screw | raised      | cross | —         | ISO 7047    |

- Cross bases (`iso7045`, `iso7046`, `iso7047`) include `"drive_m"` in `shape` and set
  `"drive": "cross"`; their `drive_w`/`drive_t`/`drive_m` come from the ISO 4757 cross gauge for
  the M10 driver size, documented as representative.
- `din85`/`iso7045` (pan) need no `crown_r`/`raised_f`. `din966`/`iso7047` (raised) include
  `"raised_f"`. `din84` (cheese) may include a representative `"crown_r"`.
- `iso7047`'s `source` states it ships with **no** DIN alias (the historical DIN cross
  raised-countersunk was withdrawn / `din966` is the slotted raised base), consistent with the
  deliberate-skip precedent.

- [ ] **Step 4: Run the data tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_slotted_screws_data.py -q`
Expected: PASS (all five tests).

- [ ] **Step 5: Run the full suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — generator + data + all prior tests.

- [ ] **Step 6: Build the catalog drawings in-container**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: 7 new SVGs appear under `catalog/out/` (`din84.svg`, `din85.svg`, `din963.svg`,
`din966.svg`, `iso7045.svg`, `iso7046.svg`, `iso7047.svg`); the 6 aliases render no new file (they
reuse their base drawing); `catalog/out/manifest.json` gains the new entries.

Then verify the invariants:

```bash
# Existing drawings must be byte-identical (only the 7 new SVGs are added, nothing else changed):
git status --porcelain catalog/out
# Expect: only the 7 new "??" SVGs + a modified manifest.json. No other .svg modified.

# manifest.json must be an ADDITIVE change (no whitespace-only churn of existing entries):
git diff catalog/out/manifest.json
# If the only manifest change is reformatting with content-identical existing entries, discard it:
#   git checkout -- catalog/out/manifest.json    # then re-check that new entries still register

# Opt-in invariant 0/0 -- these two files must NOT be touched by this task:
git diff --stat data/image-mappings.json src/lib/data/standards-generated.ts | grep -c '.svg'
# Expect: 0
```

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/slotted_screws.json catalog/tests/test_slotted_screws_data.py catalog/out/din84.svg catalog/out/din85.svg catalog/out/din963.svg catalog/out/din966.svg catalog/out/iso7045.svg catalog/out/iso7046.svg catalog/out/iso7047.svg catalog/out/manifest.json
git commit -m "feat(catalog): add slotted & cross-recess machine screw data + drawings (M10)"
```

---

## Notes for the controller (sourcing gate + review)

- **Sourcing gate before Task 2:** confirm, per standard, `dk` and `k` (and slot `n`/`t` for the
  slotted bases) against ≥2 public tables at **M10**; derive the cross recess dims from the ISO
  4757 gauge for the M10 driver (Phillips/Pozidriv ≈ size 2), documented as representative; pick a
  representative `length`, `crown_r` (cheese), and `raised_f` (raised). Hand the implementer the
  verbatim values + `source` strings. Perplexity and the Playwright MCP may read PDF tables.
- **Visual confirmation before merge:** render and eyeball all 7 drawings — each head reads
  correctly (cheese / pan / countersunk / raised), each drive reads correctly (slot / cross), and
  M10 frames acceptably under `DEFAULT_AXIS_Z` (no preset change). Serve `catalog/out` over
  `http.server` for the Playwright check (Playwright blocks `file://`).
- **zen review** (`deepseek/deepseek-v4-pro`, thinking=high) after the branch is pushed and the PR
  opened — a new generator on a shared surface. Apply findings as additional commits.

```

```
