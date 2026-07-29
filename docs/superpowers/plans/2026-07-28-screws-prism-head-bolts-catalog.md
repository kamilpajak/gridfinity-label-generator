# T-head / Square-head Prism Bolt Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generated drawings for prism-head bolts (T-head DIN 261, T-head + square neck DIN 186, T-slot DIN 787, square head + collar DIN 478) via one new `prism_head_bolt` generator, covering up to 8 app-served screw ids (gap 42 → 34).

**Architecture:** One new generator builds a rectangular/square `Box` head over the shared `_screw_shank`, with an `under` discriminator selecting the under-head feature: nothing, a square-prism neck (`Box`), or a round collar (`Cylinder`). All primitives already exist in the codebase; fusion is face-contact `add()` guarded by net volume>0 + single-solid. Data lives in a new `prism_head_bolts.json`.

**Tech Stack:** Python + build123d, run only in the pinned Docker container via `./catalog/run`. Tests are pytest. Data is JSON in `catalog/dimensions/`.

## Global Constraints

- **Container-only:** every build123d / pytest / build command runs via `./catalog/run <cmd>`. NEVER run build123d on the host.
- **Generate-only:** do NOT touch `data/image-mappings.json` or `src/lib/data/standards-generated.ts`; do NOT run `catalog/integrate.py`.
- **Additive + byte-identical:** the only new SVGs are the shipped prism-head bases; every pre-existing SVG must be byte-identical after rebuild; the manifest gains only the new entries. Normalize manifest whitespace churn with `pnpm exec prettier --write catalog/out/manifest.json`.
- **Sourcing:** every committed dimension confirmed by ≥2 named public tables; representative fields (`length`, `tip_chamfer`, the omitted under-head fillet, any size the tables don't pin) flagged in the `source` string; source strings contain NO `reyher` / `stalmut` tokens; `verified:true` only after cross-check. Any id that cannot be sourced is dropped or drawn at a sourceable representative size (flagged) — never fabricated (the DIN 605 M10 precedent). **The Task 2 sourcing gate governs the final shipped id set.**
- **Aliases never chain:** each `…p`/`…d`/`…i` variant targets its real non-alias base.
- **Conventional Commits**, ≤100-char header, NO mention of AI/assistant in commit messages.

---

### Task 1: New `prism_head_bolt` generator

**Files:**

- Create: `catalog/models/prism_head_bolt.py`
- Modify: `catalog/models/_registry.py` (import + register `prism_head_bolt`)
- Test: `catalog/tests/test_prism_head_bolt.py`

**Interfaces:**

- Consumes: `catalog.models.screw_common._screw_shank(d, length, tip_chamfer)` — returns a shank with its top face on z=0 (build the head ABOVE z=0 so `add()` fuses).
- Produces: `prism_head_bolt(d, length, head_len, head_width, head_height, under="none", under_size=None, under_height=None, tip_chamfer=None)` → a single fused build123d `Part` (head + optional under-head feature above z=0, shank in z=[−length, 0]). `under` ∈ `("none", "square_neck", "collar")`.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_prism_head_bolt.py`:

```python
import pytest
from build123d import Box, Pos

from catalog.models.prism_head_bolt import prism_head_bolt

# Synthetic fixtures (NOT real standards). Shank dia 10 x 40 long; head 30(len) x 18(width) x 8 tall.
RECT = dict(d=10.0, length=40.0, head_len=30.0, head_width=18.0, head_height=8.0,
            under="none", tip_chamfer=1.0)
NECK = {**RECT, "under": "square_neck", "under_size": 14.0, "under_height": 5.0}
# Square head (len==width) + a round collar wider than the head.
COLLAR = dict(d=10.0, length=40.0, head_len=18.0, head_width=18.0, head_height=8.0,
              under="collar", under_size=22.0, under_height=4.0, tip_chamfer=1.0)


def _solid_at(part, x, y, z, probe=0.4):
    """True if the part has material in a small cube centered at (x, y, z). build123d ``intersect``
    returns None on empty overlap (do NOT use Box(mode=INTERSECT) inside a BuildPart)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_rectangular_head_end_view_extents():
    part = prism_head_bolt(**RECT)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(RECT["head_len"], 1)              # length on X
    assert round(bb.size.Y, 1) == round(RECT["head_width"], 1)            # width on Y
    assert round(bb.size.Z, 1) == round(RECT["length"] + RECT["head_height"], 1)
    assert round(bb.max.Z, 1) == round(RECT["head_height"], 1)            # head top (under="none")
    assert round(bb.min.Z, 1) == round(-RECT["length"], 1)               # shank free end
    z = RECT["head_height"] / 2.0                                         # mid-head
    assert _solid_at(part, RECT["head_len"] / 2.0 - 0.6, 0.0, z)          # solid to the length edge
    assert not _solid_at(part, RECT["head_len"] / 2.0 + 0.6, 0.0, z)     # void beyond it
    assert _solid_at(part, 0.0, RECT["head_width"] / 2.0 - 0.6, z)        # solid to the width edge
    assert not _solid_at(part, 0.0, RECT["head_width"] / 2.0 + 0.6, z)   # void beyond it


def test_square_head_end_view_is_square():
    part = prism_head_bolt(**COLLAR)
    z = COLLAR["under_height"] + COLLAR["head_height"] / 2.0              # mid-head, above the collar
    half = COLLAR["head_len"] / 2.0                                       # == head_width/2 (square)
    assert _solid_at(part, half - 0.6, 0.0, z)                           # solid to the head edge X
    assert _solid_at(part, 0.0, half - 0.6, z)                           # solid to the head edge Y
    assert not _solid_at(part, half + 0.6, 0.0, z)                       # void beyond in X
    assert not _solid_at(part, 0.0, half + 0.6, z)                       # void beyond in Y


def test_square_neck_has_square_corners_a_collar_would_not():
    neck = prism_head_bolt(**NECK)
    collar_same = prism_head_bolt(**{**NECK, "under": "collar"})          # same under_size, round
    z = NECK["under_height"] / 2.0                                        # mid-under
    corner = NECK["under_size"] / 2.0 - 0.6                               # ~6.4, inside a 14mm square
    assert _solid_at(neck, corner, corner, z)                            # square fills its corner
    assert not _solid_at(collar_same, corner, corner, z)                 # round does not (r=7 < 9.05)


def test_collar_is_round_and_wider_than_a_square_of_the_same_size():
    part = prism_head_bolt(**COLLAR)
    z = COLLAR["under_height"] / 2.0                                      # mid-collar
    r = COLLAR["under_size"] / 2.0                                        # 11
    assert _solid_at(part, r - 0.6, 0.0, z)                              # solid to the collar rim
    assert not _solid_at(part, r + 0.6, 0.0, z)                          # void beyond the rim
    assert not _solid_at(part, r * 0.75, r * 0.75, z)                    # corner void (round, not square)


def test_under_none_seats_the_head_on_the_bearing_plane():
    # With under="none" the head bottom is at z=0; with a square neck the head is lifted by
    # under_height. Probe a head-width point at a low z: present for "none", absent for the neck
    # (where only the narrower neck occupies that z).
    rect = prism_head_bolt(**RECT)
    neck = prism_head_bolt(**NECK)
    x = RECT["head_len"] / 2.0 - 1.0                                      # 14, inside the head, outside the 14mm neck half (7)
    z = 2.0                                                               # below the neck top (5), inside the "none" head
    assert _solid_at(rect, x, 0.0, z)                                     # head reaches here (seated at z=0)
    assert not _solid_at(neck, x, 0.0, z)                                # only the narrow neck here; head is lifted


def test_single_fused_solid_for_each_under():
    assert len(prism_head_bolt(**RECT).solids()) == 1
    assert len(prism_head_bolt(**NECK).solids()) == 1
    assert len(prism_head_bolt(**COLLAR).solids()) == 1
    assert prism_head_bolt(**RECT).volume > 0


def test_guards():
    with pytest.raises(ValueError):
        prism_head_bolt(**{**RECT, "under": "hex"})                      # unknown under
    with pytest.raises(ValueError):
        prism_head_bolt(**{**RECT, "d": RECT["head_width"]})             # shank not narrower than head
    with pytest.raises(ValueError):
        prism_head_bolt(**{**RECT, "head_height": 0.0})                  # non-positive dim
    with pytest.raises(ValueError):
        prism_head_bolt(**{**RECT, "under": "collar"})                   # under set but no under_size/height
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_prism_head_bolt.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'catalog.models.prism_head_bolt'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/prism_head_bolt.py`:

```python
"""Prism-head bolt family generator (T-head DIN 261/787, T-head + square neck DIN 186,
square head + collar DIN 478).

The head is a rectangular block ``Box(head_len, head_width, head_height)`` centered on the shank
axis (a square head is the special case ``head_len == head_width``); the end view is the
distinctive rectangle/square. An ``under`` feature sits between the head and the shared
``_screw_shank``: nothing (``"none"``), a square anti-rotation neck (``"square_neck"`` — a
``Box(under_size, under_size, under_height)``), or a round bearing collar (``"collar"`` — a
``Cylinder``). Envelope-only: no drawn thread, no drive, no under-head fillet. Modelled
axis-along-Z: shank z in [-length, 0], the under feature z in [0, under_height], the head above it.
Head and under feature fuse to the shank by face contact (the screw_common stacking seam), guarded
by net volume>0 + single-solid.
"""
from build123d import BuildPart, Box, Cylinder, Locations, Align, add

from catalog.models.screw_common import _screw_shank

_UNDER = ("none", "square_neck", "collar")


def prism_head_bolt(d: float, length: float, head_len: float, head_width: float,
                    head_height: float, under: str = "none", under_size: float | None = None,
                    under_height: float | None = None, tip_chamfer: float | None = None):
    """Prism-head bolt: a rectangular/square head (``head_len`` x ``head_width`` x ``head_height``)
    over a smooth shank Ø``d`` x ``length`` (optional 45-degree lead ``tip_chamfer``). ``under`` is
    ``"none"`` (head on the bearing plane), ``"square_neck"`` (a square prism of side ``under_size``
    and height ``under_height``, DIN 186), or ``"collar"`` (a round flange of diameter ``under_size``
    and height ``under_height``, DIN 478). No thread, no drive.
    """
    for name, val in (("d", d), ("length", length), ("head_len", head_len),
                      ("head_width", head_width), ("head_height", head_height)):
        if val <= 0:
            raise ValueError(f"prism_head_bolt: need {name} > 0, got {val}")
    if under not in _UNDER:
        raise ValueError(f"prism_head_bolt: under must be one of {_UNDER}, got {under!r}")
    if under != "none":
        if under_size is None or under_size <= 0:
            raise ValueError(
                f"prism_head_bolt: under={under!r} needs under_size > 0, got {under_size}")
        if under_height is None or under_height <= 0:
            raise ValueError(
                f"prism_head_bolt: under={under!r} needs under_height > 0, got {under_height}")
    if d >= min(head_len, head_width):
        raise ValueError(
            f"prism_head_bolt: d {d} must be < the smaller head side {min(head_len, head_width)} "
            f"(the shank emerges from the head bearing face and is narrower than the head)")

    shank = _screw_shank(d, length, tip_chamfer)          # z in [-length, 0], validates chamfer
    under_h = under_height if under != "none" else 0.0    # top plane of the under feature
    with BuildPart() as bp:
        add(shank)                                        # shares the z=0 face -> fuses
        if under == "square_neck":
            Box(under_size, under_size, under_height,
                align=(Align.CENTER, Align.CENTER, Align.MIN))       # z in [0, under_height]
        elif under == "collar":
            Cylinder(radius=under_size / 2.0, height=under_height,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))  # z in [0, under_height]
        with Locations((0.0, 0.0, under_h)):
            Box(head_len, head_width, head_height,
                align=(Align.CENTER, Align.CENTER, Align.MIN))       # head on top of the under feature
    part = bp.part
    if part.volume <= 0:                                  # net guard (not is_valid — sewn-shell)
        raise ValueError("prism_head_bolt: produced an empty solid")
    if len(part.solids()) != 1:                           # head + under + shank must fuse to one solid
        raise ValueError("prism_head_bolt: head/under/shank did not fuse into a single solid")
    return part
```

- [ ] **Step 4: Register the family**

In `catalog/models/_registry.py` add the import next to the other screw imports:

```python
from catalog.models.prism_head_bolt import prism_head_bolt
```

and add to the `KNOWN_FAMILIES` dict:

```python
    "prism_head_bolt": prism_head_bolt,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_prism_head_bolt.py -q`
Expected: PASS (all 7 tests).

- [ ] **Step 6: Full suite + byte-identical check (no data yet, so nothing new should render)**

Run:

```bash
./catalog/run python -m pytest catalog/tests -q
./catalog/run python -m catalog.build_catalog
git status --short catalog/out/
```

Expected: full suite PASS; no modified/new files under `catalog/out/` (the generator is registered but no data entry uses it yet). If the manifest shows whitespace churn, `pnpm exec prettier --write catalog/out/manifest.json` and confirm `git diff -w catalog/out/manifest.json` is empty.

- [ ] **Step 7: Commit**

```bash
git add catalog/models/prism_head_bolt.py catalog/models/_registry.py catalog/tests/test_prism_head_bolt.py
git commit -m "feat(catalog): add prism_head_bolt generator (T-head/square-head bolts)"
```

---

### Task 2: Prism-head bolt data entries and drawings

**Files:**

- Create: `catalog/dimensions/prism_head_bolts.json`
- Test: `catalog/tests/test_prism_head_bolts_data.py`
- Generated (committed): one SVG per shipped base + `catalog/out/manifest.json`

**Interfaces:**

- Consumes: `prism_head_bolt(...)` from Task 1; `catalog.models._registry.build_part`; `catalog.schema.validate_entry`.
- Produces: up to 4 new manifest bases (`din186`, `din261`, `din787`, `din478`) + up to 4 aliases.

> **SOURCING GATE (controller-run before dispatch).** Before this task is implemented, the controller
> confirms every committed dimension against ≥2 named public tables and writes the confirmed values,
> the FINAL shipped id set, the alias map, and the verbatim `source` strings to
> `.superpowers/sdd/task-2-sourcing.md`, which is authoritative. DIN 186/261 are the sourcing risk:
> if a base cannot be sourced, the gate drops it (and its alias) or draws it at a sourceable
> representative size (flagged) — never fabricated. The data tests below are relationship-based and
> driven by `_BASES` / `_ALIASES` constants the implementer fills from the sourcing file, so they pass
> for whatever subset ships.

- [ ] **Step 1: Write the failing data tests**

Create `catalog/tests/test_prism_head_bolts_data.py`. Fill `_BASES` (base id → expected `under`) and
`_ALIASES` (variant → base) from `.superpowers/sdd/task-2-sourcing.md` (the block below shows the full
four-base set; use only the ids the sourcing gate ships):

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/prism_head_bolts.json")
_FORBIDDEN = ("reyher", "stalmut")

# Filled from the sourcing gate — keep only the ids that shipped.
_BASES = {"din186": "square_neck", "din261": "none", "din787": "none", "din478": "collar"}
_ALIASES = {"din186p": "din186", "din261d": "din261", "din787i": "din787", "din478p": "din478"}


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


def test_family_hardware_type_and_under_enum():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "prism_head_bolt", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"
        assert entry["shape"]["under"] in ("none", "square_neck", "collar")


def test_each_base_has_its_expected_under_feature():
    entries = json.loads(DATA.read_text())
    for base_id, expected_under in _BASES.items():
        assert base_id in entries and "alias_of" not in entries[base_id], f"{base_id} must be a base"
        assert entries[base_id]["shape"]["under"] == expected_under, \
            f"{base_id}: expected under={expected_under}"
        build_part(entries[base_id]["family"], entries[base_id]["shape"])


def test_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from prism_head_bolts.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"


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

- [ ] **Step 2: Run the data tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_prism_head_bolts_data.py -q`
Expected: FAIL (the JSON does not exist / is empty).

- [ ] **Step 3: Create `prism_head_bolts.json` from the sourcing gate**

Create `catalog/dimensions/prism_head_bolts.json` with the shipped bases + aliases, using the exact
shapes and verbatim `source` strings from `.superpowers/sdd/task-2-sourcing.md`. Each base:
`family:"prism_head_bolt"`, a `shape` with
`d, length, head_len, head_width, head_height, under, under_size, under_height, tip_chamfer`
(`under_size`/`under_height` present only when `under != "none"`), `hardwareType:"screw"`,
`verified:true`, and `designations`. Each alias: `alias_of` (its real base), `hardwareType:"screw"`,
`source`, `verified:true`, `designations`. Illustrative shape of the `din478` base (square head +
collar) — use the sourced numbers, not these placeholders:

```json
	"din478": {
		"family": "prism_head_bolt",
		"shape": {
			"d": 12.0,
			"length": 50.0,
			"head_len": 19.0,
			"head_width": 19.0,
			"head_height": 8.0,
			"under": "collar",
			"under_size": 22.0,
			"under_height": 3.0,
			"tip_chamfer": 1.0
		},
		"hardwareType": "screw",
		"source": "<verbatim from task-2-sourcing.md — names >=2 public tables, flags representative fields, no reyher/stalmut>",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "478" }]
	}
```

Do NOT commit a `<...>` placeholder source — every shipped source string comes verbatim from the
sourcing file with ≥2 named tables. A base whose `under` is `"none"` omits `under_size`/`under_height`.

- [ ] **Step 4: Run the data tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_prism_head_bolts_data.py -q`
Expected: PASS.

- [ ] **Step 5: Rebuild + confirm coverage + additivity**

Run:

```bash
./catalog/run python -m catalog.build_catalog
pnpm exec prettier --write catalog/out/manifest.json
./catalog/run python -c "from catalog.qa.coverage import check; m=check('catalog/out/manifest.json','data/image-mappings.json','screw'); print('remaining screw gap:', len(m))"
git status --short catalog/out/
```

Expected: `remaining screw gap` drops by the number of shipped ids (42 → 34 if all four bases + four
aliases ship; higher if the gate dropped ids). Under `catalog/out/` only the new base SVGs + manifest
are added; every pre-existing SVG unchanged (`git diff --stat catalog/out/`). If any pre-existing SVG
changed, STOP.

- [ ] **Step 6: Full suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/prism_head_bolts.json catalog/tests/test_prism_head_bolts_data.py catalog/out/*.svg catalog/out/manifest.json
git commit -m "feat(catalog): add T-head/square-head prism bolt coverage (screw gap 42->34)"
```

(Adjust the header's target number to the actual shipped gap if the sourcing gate dropped ids.)

---

## Notes for the executor

- Task 1 (generator + register) must land before Task 2 (data), because the data entries dispatch to `prism_head_bolt`.
- The `git add catalog/out/*.svg` in Task 2 Step 7 adds the new base SVGs; confirm via `git status` that only the intended new SVGs and the manifest are staged (no pre-existing SVG changed).
- After both tasks: whole-branch review, then zen (`deepseek/deepseek-v4-pro`, thinking=high) as the mandated new-generator gate, then visual check, then push / PR / CI / squash-merge.
