# Socket-Head Cap Screw Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a socket-head cap screw family (`socket_screw`) to the maintainer-only generative catalog — one generator, two drive recesses (hex + hexalobular/Torx) — at a representative M12 × 60.

**Architecture:** New generator `catalog/models/socket_screw.py` builds a plain cylindrical head (`Cylinder`) above the `z=0` bearing plane, subtracts a **blind** drive socket from the head's top face, and unions a smooth shank below it via the existing `_screw_shank` helper. The socket is `drive="hex"` (a hexagonal prism) or `drive="lobular"` (a representative rounded 6-lobe Torx region). Registered in `_registry.py`; data in a new `socket_screws.json`. No render/preset change (`hardwareType "screw"` → `DEFAULT_AXIS_Z`).

**Tech Stack:** Python 3, build123d, pytest — all run **in the pinned container** via `./catalog/run`. Never run these on the host.

## Global Constraints

- Representative size **M12 × 60** only. No user-facing toggle (epic END goal, gated on full coverage).
- Every committed **envelope** dimension (`dk`, `k`, `socket_af`, `socket_depth`) confirmed by **≥2 independent public tables**; representative fields (`length`, and the entire lobular recess profile) documented as such in the `source` string, never fabricated as normative.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- Reuse `_screw_shank` from `screw_common` — do **not** modify it or any existing generator. Existing SVGs must stay **byte-identical** (rebuild → `git status catalog/out` shows no change to existing files).
- **No render/preset change.** Axis-along-Z; `hardwareType "screw"` → `DEFAULT_AXIS_Z`.
- **Opt-in 0/0:** do **not** run `catalog/integrate.py`. `data/image-mappings.json` and `src/lib/data/standards-generated.ts` stay untouched — `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts` must return `0` for both.
- All builds/tests run in-container via `./catalog/run`. **Pre-warm the image once** (`./catalog/run python -c "print(1)"`) before the first timed step — the first run builds the Docker image and can exceed a subagent watchdog.
- The Torx recess is a **representative rounded 6-lobe** icon, never a sharp 6-point star; the open-source reference consulted (FreeCAD Fasteners Workbench / ISO 10664 form) is attributed in `THIRD-PARTY-NOTICES.md`, reimplemented in build123d, never copied.

**Note on the design spec:** the spec listed an optional `head_chamfer` param (a light top-rim edge break) "added only if the first render looks wrong". This plan **omits** it — YAGNI: a top-rim chamfer is a documented fallback, not shipped in v1, so the generator signature has no `head_chamfer`. Add it later only if the visual build shows an objectionable sharp rim.

---

## Task 1: `socket_screw` generator + tests + registry

**Files:**

- Create: `catalog/models/socket_screw.py`
- Create: `catalog/tests/test_socket_screw.py`
- Modify: `catalog/models/_registry.py` (add the import + one `KNOWN_FAMILIES` entry)

**Interfaces:**

- Consumes: `from catalog.models.screw_common import _screw_shank`
  - `_screw_shank(d: float, length: float, tip_chamfer: float | None = None) -> Part` — smooth cylinder of diameter `d`, axial `length`, top face on `z=0`, body along `−Z` to `z=−length`, optional 45° lead chamfer of leg `tip_chamfer` at the free end. Validates `d`, `length`, `tip_chamfer` and raises `ValueError` on bad geometry.
- Produces: `socket_screw(dk, k, length, d_shank, drive, socket_af, socket_depth, tip_chamfer=None) -> Part` and the registry key `"socket_screw"`.

The fixtures in the tests below are **synthetic** — geometrically valid numbers chosen to exercise the code, **not** claimed as any real standard. Real standards come in Task 2.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_socket_screw.py`:

```python
import math

import pytest
from build123d import Box, Pos

from catalog.models.socket_screw import socket_screw

# Synthetic fixtures (NOT real standards): head dia 18 x 12 tall, shank dia 12 x 30 long,
# hex socket across-flats 10, socket depth 6, 1.5mm lead chamfer. Head z in [0,12]; shank z in
# [-30,0]; socket cut from the top face z=12 down to z=6.
HEX = dict(dk=18.0, k=12.0, length=30.0, d_shank=12.0, drive="hex",
           socket_af=10.0, socket_depth=6.0, tip_chamfer=1.5)
LOB = {**HEX, "drive": "lobular"}


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = socket_screw(**HEX)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(HEX["k"] + HEX["length"], 1)   # head + shank along Z
    assert round(bb.size.X, 1) == round(HEX["dk"], 1)                  # head diameter on X
    assert round(bb.max.Z, 1) == round(HEX["k"], 1)                    # head top face
    assert round(bb.min.Z, 1) == round(-HEX["length"], 1)             # shank free end
    assert part.volume > 0


def test_cylindrical_head_present():
    # The head is a plain cylinder of radius dk/2 = 9: solid just inside the rim, void just
    # outside it, at a z below the socket floor (z=3, inside the solid head band).
    part = socket_screw(**HEX)
    r = HEX["dk"] / 2.0
    assert _solid_at(part, r - 0.5, 0.0, 3.0, probe=0.3)              # solid to the head rim
    assert not _solid_at(part, r + 0.5, 0.0, 3.0, probe=0.3)          # void beyond the rim


def test_shank_narrower_than_head():
    part = socket_screw(**HEX)
    r = HEX["d_shank"] / 2.0                                          # 6
    z_shank = -HEX["length"] / 2.0
    assert _solid_at(part, r - 0.5, 0.0, z_shank, probe=0.4)          # shank solid to its wall
    assert not _solid_at(part, r + 0.5, 0.0, z_shank, probe=0.4)      # void just beyond the shank
    # A head-band radius (8, inside the head rim) is solid in the head but void in the shank.
    assert _solid_at(part, 8.0, 0.0, 3.0, probe=0.4)
    assert not _solid_at(part, 8.0, 0.0, z_shank, probe=0.4)


def test_socket_is_blind_and_opens_from_the_top():
    # Void on the axis just below the top face (inside the socket); solid on the axis just below
    # the socket floor (the socket does NOT go through — a floor of head metal remains).
    part = socket_screw(**HEX)
    top = HEX["k"]                                                    # 12
    floor = HEX["k"] - HEX["socket_depth"]                            # 6
    assert not _solid_at(part, 0.0, 0.0, top - 0.4, probe=0.3)        # void inside the socket
    assert _solid_at(part, 0.0, 0.0, floor - 0.4, probe=0.3)          # solid floor below it
    assert _solid_at(part, 0.0, 0.0, -HEX["length"] / 2.0, probe=0.6) # solid core in the shank


def test_hex_and_lobular_recesses_differ():
    # Same head/shank/socket size, different drive -> the two sockets remove different amounts of
    # metal, so the finished screws have different volumes (rotation-independent discriminator).
    vh = socket_screw(**HEX).volume
    vl = socket_screw(**LOB).volume
    assert abs(vh - vl) > 0.5
    # And the lobular build is a single fused solid too.
    assert socket_screw(**LOB).volume > 0


def test_head_and_shank_fuse_into_one_solid():
    # Head (z in [0,k]) and shank (z in [-length,0]) share only the z=0 plane; they must FUSE
    # into a single solid, not leave a compound.
    assert len(socket_screw(**HEX).solids()) == 1
    assert len(socket_screw(**LOB).solids()) == 1
    assert len(socket_screw(**{**HEX, "tip_chamfer": None}).solids()) == 1


def test_tip_chamfer_is_cut():
    part = socket_screw(**HEX)
    r = HEX["d_shank"] / 2.0
    assert not _solid_at(part, r - 0.3, 0.0, -HEX["length"] + 0.3, probe=0.3)   # corner bevelled
    square = socket_screw(**{**HEX, "tip_chamfer": None})
    assert _solid_at(square, r - 0.3, 0.0, -HEX["length"] + 0.3, probe=0.3)     # corner solid


def test_builds_at_valid_configs():
    assert socket_screw(**HEX).volume > 0
    assert socket_screw(**LOB).volume > 0
    assert socket_screw(**{**HEX, "tip_chamfer": None}).volume > 0    # plain end also builds


def test_socket_screw_guards():
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "dk": 0.0})                           # non-positive dim
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "socket_depth": 0.0})                 # non-positive dim
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "drive": "torx"})                     # unknown drive
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "d_shank": HEX["dk"]})                # shank not narrower than head
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "socket_af": HEX["dk"]})              # socket wider than the head face
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "socket_depth": HEX["k"]})            # socket not blind (>= head height)
    with pytest.raises(ValueError):
        socket_screw(**{**LOB, "socket_af": HEX["dk"]})              # lobular socket too wide too
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_socket_screw.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.socket_screw'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/socket_screw.py`:

```python
"""Socket-head cap screw family generator (ISO 4762 / DIN 912 hex socket, ISO 14579 Torx).

A plain cylindrical head with a BLIND drive socket cut into its top face, over a smooth
cylindrical shank (the shared ``_screw_shank``). The shank is envelope-only (no drawn thread)
and there is no through bore. Two drive recesses match the two end-view silhouettes:
``drive="hex"`` subtracts a hexagonal prism (an Allen socket); ``drive="lobular"`` subtracts a
representative rounded 6-lobe region (a Torx socket).

The lobular region is a REPRESENTATIVE icon (a core disc unioned with six rounded lobes), not
the dimensioned ISO 10664 curve and never a sharp 6-point star — its proportions are chosen so
the socket reads as a Torx at label scale (see THIRD-PARTY-NOTICES.md, FreeCAD Fasteners
Workbench / ISO 10664). Modelled axis-along-Z: the head sits z in [0, k] (bearing face on z=0),
the shank z in [-length, 0]; under the default camera the front view is the socket end view and
the side view is the horizontal head+shank elevation.
"""
from build123d import (
    BuildPart, BuildSketch, Cylinder, Circle, RegularPolygon, PolarLocations,
    Plane, Align, Mode, add, extrude,
)

from catalog.models.screw_common import _screw_shank

_MIN_WALL_MM = 0.1                # local min wall (not imported — keep the screw_common-only dep)
_DRIVES = ("hex", "lobular")
_RECESS_EPS = 0.05               # cutter pokes this far above the top face for a clean rim cut
# Representative lobular proportions (fractions of socket_af): six rounded lobes whose tips reach
# socket_af/2, distinct convex bumps (adjacent lobes do NOT touch) connected by a smaller core
# disc that forms the concave valleys between them.
_LOBE_TIP_FRAC = 0.5             # lobe tip radius / socket_af  (overall socket half-width)
_LOBE_R_FRAC = 0.12              # lobe circle radius / socket_af
_CORE_R_FRAC = 0.33              # core disc radius / socket_af


def socket_screw(dk: float, k: float, length: float, d_shank: float, drive: str,
                 socket_af: float, socket_depth: float, tip_chamfer: float | None = None):
    """Socket-head cap screw: cylindrical head of diameter ``dk`` and height ``k`` with a blind
    drive socket of nominal across-size ``socket_af`` and depth ``socket_depth`` cut into its top
    face, over a smooth shank of diameter ``d_shank`` and ``length`` (optional lead
    ``tip_chamfer`` at the free end). ``drive`` is ``"hex"`` (hexagonal prism) or ``"lobular"``
    (representative rounded 6-lobe Torx). No through bore, no drawn thread.
    """
    for name, val in (("dk", dk), ("k", k), ("length", length), ("d_shank", d_shank),
                      ("socket_af", socket_af), ("socket_depth", socket_depth)):
        if val <= 0:
            raise ValueError(f"socket_screw: need {name} > 0, got {val}")
    if drive not in _DRIVES:
        raise ValueError(f"socket_screw: drive must be one of {_DRIVES}, got {drive!r}")
    if d_shank >= dk:
        raise ValueError(
            f"socket_screw: d_shank {d_shank} must be < head diameter {dk} (the shank emerges "
            f"from the head bearing face and is narrower than the head)")
    if socket_af >= dk - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"socket_screw: socket_af {socket_af} leaves too thin a wall vs head diameter {dk} "
            f"(needs < dk - {2.0 * _MIN_WALL_MM} mm — the socket sits within the head face)")
    if socket_depth >= k:
        raise ValueError(
            f"socket_screw: socket_depth {socket_depth} must be < head height {k} "
            f"(the socket is blind — a floor of head metal must remain below it)")

    shank = _screw_shank(d_shank, length, tip_chamfer)   # z in [-length, 0], validates chamfer
    floor_z = k - socket_depth                           # socket floor plane (z > 0 by the guard)
    with BuildPart() as bp:
        Cylinder(radius=dk / 2.0, height=k,
                 align=(Align.CENTER, Align.CENTER, Align.MIN))    # head z in [0, k]
        add(shank)                                                 # shares the z=0 face -> fuses
        with BuildSketch(Plane.XY.offset(floor_z)):                # socket cross-section at floor
            if drive == "hex":
                RegularPolygon(radius=socket_af / 2.0, side_count=6,
                               major_radius=False)                 # across-flats = socket_af
            else:
                Circle(radius=_CORE_R_FRAC * socket_af)            # connecting core disc
                offset = _LOBE_TIP_FRAC * socket_af - _LOBE_R_FRAC * socket_af
                with PolarLocations(offset, 6):
                    Circle(radius=_LOBE_R_FRAC * socket_af)        # six rounded lobes, unioned
        extrude(amount=socket_depth + _RECESS_EPS, mode=Mode.SUBTRACT)   # blind socket from top
    part = bp.part
    if part.volume <= 0:                                 # net guard (not is_valid — sewn-shell)
        raise ValueError("socket_screw: produced an empty solid")
    if len(part.solids()) != 1:                          # head and shank must FUSE, not just touch
        raise ValueError("socket_screw: head and shank did not fuse into a single solid")
    return part
```

- [ ] **Step 4: Register the family**

In `catalog/models/_registry.py`, add the import next to the other screw imports:

```python
from catalog.models.hex_bolt import hex_bolt
from catalog.models.socket_screw import socket_screw
```

and add the entry to `KNOWN_FAMILIES` (after `"hex_bolt": hex_bolt,`):

```python
    "hex_bolt": hex_bolt,
    "socket_screw": socket_screw,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_socket_screw.py -v`
Expected: PASS — all 8 tests green.

- [ ] **Step 6: Confirm no existing test regressed**

Run: `./catalog/run pytest catalog/tests -q`
Expected: the full catalog suite passes (existing nut/washer/ring/hex-bolt tests + the new socket-screw tests).

- [ ] **Step 7: Commit**

```bash
git add catalog/models/socket_screw.py catalog/tests/test_socket_screw.py catalog/models/_registry.py
git commit -m "feat(catalog): add socket-head cap screw generator (hex + Torx socket)"
```

---

## Task 2: `socket_screws.json` data + data test + attribution + in-container build

**Files:**

- Create: `catalog/dimensions/socket_screws.json`
- Create: `catalog/tests/test_socket_screws_data.py`
- Modify: `THIRD-PARTY-NOTICES.md` (extend the FreeCAD Fasteners Workbench section with the Torx recess reference)

**Interfaces:**

- Consumes: `socket_screw(...)` (Task 1) via `build_part(family, shape)`; `catalog.schema.validate_entry(sid, entry)`.
- Produces: rendered SVGs under `catalog/out/` for the two base standards (`iso4762`, `iso14579`); `din912` is an alias and reuses `iso4762`'s drawing.

**SOURCING GATE — do this before writing final numbers.** Envelope fields are **normative and must be verified against ≥2 independent public tables** (fasteners.eu, Fuller Fasteners, Wegertseder, Bossard, Würth, globalfastener, boltsparts.github.io). Confirm for **M12**:

1. **Head diameter `dk`** (candidate ≈ 18.0). Common trap: ISO 4762 M12 `dk` ≈ 18.0 mm; do not confuse with the head height. Read from ≥2 tables and record which.
2. **Head height `k`** (candidate ≈ 12.0 — socket cap head height ≈ nominal thread diameter; confirm).
3. **Hex socket across-flats `socket_af`** (candidate ≈ 10.0 — the Allen key size for M12 ISO 4762). Confirm against ≥2 tables.
4. **Socket depth `socket_depth`** (candidate ≈ 6.0 — the key engagement depth `t`; tables list a min, e.g. ~5.5–6.0; pick a representative value in range and say so).
5. `d_shank = 12.0` (M12 nominal major diameter). `length = 60.0` is a **representative** catalog length (M12 socket cap is stocked roughly 16–200 mm), documented as chosen, not normative.

Resolve **distinct-vs-alias**:

- `din912` shares ISO 4762's M12 head **and** hex socket → confirm the M12 envelope is identical, then it collapses to `iso4762` as an **alias** (DIN 912 and ISO 4762 are the same screw).
- `iso14579` shares ISO 4762's M12 head `dk`/`k` but has a **Torx** recess → a **distinct base** (`drive: "lobular"`), never an alias. Note the Torx size for M12 (≈ T50) in the source; the whole lobular profile is representative form (the ISO 10664 lobe radii are not modelled to dimension).

The `source` string for every entry must state which fields are tabulated (`dk`, `k`, `socket_af`, `socket_depth`) and which are representative (`length`, and — for `iso14579` — the entire lobular recess), cite ≥2 public tables, and name **no** private catalogue.

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_socket_screws_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/socket_screws.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_socket_screw_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 3
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_socket_family_hardware_type_and_drive():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "socket_screw", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"
        assert entry["shape"]["drive"] in ("hex", "lobular")


def test_din912_aliases_iso4762_and_iso14579_is_a_distinct_lobular_base():
    entries = json.loads(DATA.read_text())
    assert "iso4762" in entries and "family" in entries["iso4762"]       # hex base is a drawing
    assert entries["iso4762"]["shape"]["drive"] == "hex"
    assert entries["din912"]["alias_of"] == "iso4762"                    # same screw -> alias
    assert entries["din912"]["hardwareType"] == "screw"
    assert "family" in entries["iso14579"]                              # Torx is its OWN base
    assert entries["iso14579"]["shape"]["drive"] == "lobular"
    assert "alias_of" not in entries["iso14579"]


def test_every_socket_screw_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_socket_screw_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the data test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_socket_screws_data.py -v`
Expected: FAIL — `FileNotFoundError` on `socket_screws.json`.

- [ ] **Step 3: Write the data file (after the sourcing gate)**

Create `catalog/dimensions/socket_screws.json`. The numbers below are **candidates from one research pass** — confirm/correct each envelope field at the sourcing gate before committing, and rewrite each `source` string to cite the ≥2 tables you actually read.

```json
{
	"iso4762": {
		"family": "socket_screw",
		"shape": {
			"dk": 18.0,
			"k": 12.0,
			"length": 60.0,
			"d_shank": 12.0,
			"drive": "hex",
			"socket_af": 10.0,
			"socket_depth": 6.0,
			"tip_chamfer": 1.0
		},
		"hardwareType": "screw",
		"source": "ISO 4762 hexagon socket head cap screw, M12. dk=18.0 (head diameter), k=12.0 (head height), socket_af=10.0 (hex key across-flats), socket_depth=6.0 (key engagement, representative within the tabulated min) — all M12 values verified against >=2 public tables (e.g. Fuller Fasteners + fasteners.eu + boltsparts.github.io ISO 4762). d_shank=12.0 (M12 nominal major diameter); shank drawn as a smooth cylinder (envelope only, no thread lines, no bore). length=60.0 is a representative catalog length (M12 stocked ~16-200 mm), not normative. tip_chamfer=1.0 mm lead chamfer, representative.",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "4762" }]
	},
	"din912": {
		"alias_of": "iso4762",
		"hardwareType": "screw",
		"source": "DIN 912 hexagon socket head cap screw, M12. Same screw as ISO 4762 — identical M12 head (dk=18.0, k=12.0) and hex socket (across-flats 10.0): confirmed against >=2 public tables (e.g. Fuller Fasteners DIN 912 + fasteners.eu). Outer envelope + hex socket identical to iso4762 -> alias.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "912" }]
	},
	"iso14579": {
		"family": "socket_screw",
		"shape": {
			"dk": 18.0,
			"k": 12.0,
			"length": 60.0,
			"d_shank": 12.0,
			"drive": "lobular",
			"socket_af": 10.0,
			"socket_depth": 6.0,
			"tip_chamfer": 1.0
		},
		"hardwareType": "screw",
		"source": "ISO 14579 hexalobular (Torx) socket head cap screw, M12. Same head as ISO 4762 (dk=18.0, k=12.0) — only the drive differs — verified against >=2 public tables (e.g. Fuller Fasteners + fasteners.eu ISO 14579). Torx size for M12 is approximately T50. The lobular recess is a representative rounded 6-lobe icon (see THIRD-PARTY-NOTICES.md, FreeCAD Fasteners Workbench / ISO 10664 form), not the dimensioned ISO 10664 curve; socket_af=10.0 sets the overall socket half-width. d_shank=12.0 (M12 major). length=60.0 representative. tip_chamfer=1.0 mm representative.",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "14579" }]
	}
}
```

Rules while filling in:

- One **base** entry (`family` + `shape`) per distinct end-view silhouette: `iso4762` (hex) and `iso14579` (lobular). `din912` is the only alias and points at `iso4762` (a base, never another alias).
- Keep `d_shank` at `12.0`, `dk`/`k` identical across `iso4762` and `iso14579` (same head, different drive).
- `verified: true` only when the entry's envelope fields were actually cross-checked against ≥2 tables (the data test enforces the flag; you enforce the truth).

- [ ] **Step 4: Run the data test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_socket_screws_data.py -v`
Expected: PASS — all five checks green.

- [ ] **Step 5: Attribute the lobular reference in THIRD-PARTY-NOTICES.md**

The FreeCAD Fasteners Workbench section already exists (added for the DIN 315 wing nut). Extend its first paragraph so it also covers the Torx recess. In `THIRD-PARTY-NOTICES.md`, replace:

```markdown
The DIN 315 wing-nut profile construction in `catalog/models/wing_nut.py` was informed
by the open-source [FreeCAD Fasteners Workbench](https://github.com/shaise/FreeCAD_FastenersWB),
licensed under the GNU Lesser General Public License (LGPL). The build123d implementation
in this project is our own; the geometry it produces is dictated by the DIN 315 standard.
No FreeCAD source code is copied into or bundled with this project.
```

with:

```markdown
The DIN 315 wing-nut profile construction in `catalog/models/wing_nut.py`, and the
representative hexalobular (Torx) socket recess in `catalog/models/socket_screw.py`, were
informed by the open-source [FreeCAD Fasteners Workbench](https://github.com/shaise/FreeCAD_FastenersWB),
licensed under the GNU Lesser General Public License (LGPL), and by the ISO 10664 hexalobular
form. The build123d implementations in this project are our own; the wing-nut geometry is
dictated by the DIN 315 standard and the Torx recess is a representative icon (not the
dimensioned ISO 10664 curve). No FreeCAD source code is copied into or bundled with this project.
```

- [ ] **Step 6: Build the catalog in-container and confirm the new drawings render**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: build succeeds; new `catalog/out/iso4762.svg` and `catalog/out/iso14579.svg` appear (the `din912` alias reuses `iso4762`'s svg/sha).

- [ ] **Step 7: Verify existing SVGs are byte-identical and opt-in stays 0/0**

Run: `git status --short catalog/out`
Expected: only **new** socket-screw SVG files listed; **no** modifications to existing SVGs.

Run: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts`
Expected: `0` for both files (opt-in invariant preserved — `integrate.py` was not run).

- [ ] **Step 8: Run the full catalog suite once more**

Run: `./catalog/run pytest catalog/tests -q`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add catalog/dimensions/socket_screws.json catalog/tests/test_socket_screws_data.py THIRD-PARTY-NOTICES.md catalog/out
git commit -m "feat(catalog): add M12 socket-head cap screw standards (ISO 4762/DIN 912/ISO 14579)"
```

---

## Self-review notes (for the executor)

- **Spec coverage:** Task 1 delivers the generator (both drives), guards, registration; Task 2 delivers the data (≥2-table sourcing gate), the data test, the FreeCAD/ISO 10664 attribution, the in-container build, and the opt-in/byte-identical checks. Silhouette mapping (hex vs Torx end view), envelope-only shank, blind socket, and distinct-vs-alias (`din912` alias, `iso14579` distinct base) are all encoded.
- **Signature consistency:** `socket_screw(dk, k, length, d_shank, drive, socket_af, socket_depth, tip_chamfer=None)` is identical in the generator, the tests, and the data `shape` keys. `head_chamfer` is deliberately omitted (see the Global Constraints note).
- **Visual confirmation before merge:** both drawings checked against the `iso_4762` / `iso_14579` rasters — the recess must read correctly (hexagon vs **rounded** 6-lobe, never a sharp star) and the long M12×60 must frame acceptably under `DEFAULT_AXIS_Z`; add a `SCREW_PRESET` only if it does not.
- **Not covered by design (leave alone):** integration into the app (`integrate.py`), `image-mappings.json`, `standards-generated.ts`, any render/preset change, and low-head/button/countersunk socket variants — all out of scope by the opt-in invariant and the spec's non-goals.

```

```
