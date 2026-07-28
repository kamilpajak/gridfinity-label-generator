# Plain Stud / Double-End Stud Coverage (screw gap family 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new self-contained `stud` generator and 6 plain double-end stud entries (base `din938` + 5 aliases) so the `coverage.py` screw gap drops from 57 to 51.

**Architecture:** A stud is envelope-only a plain full-diameter cylindrical rod with a 45-degree lead chamfer at each free end — no head, no drive socket, no waist. One new generator (`catalog/models/stud.py`, registered in `_registry`) draws it by revolving an XZ meridian about Z. One new dimension file (`catalog/dimensions/studs.json`) holds the base `din938` and 5 aliases; DIN 938/939/835 differ only in the undrawn thread-engagement length, so they collapse to one drawing. Build renders one new SVG (`din938.svg`); the app data files are not touched (generate-only).

**Tech Stack:** Python + build123d (run ONLY in the pinned container via `./catalog/run`), pytest, JSON dimension entries.

## Global Constraints

- Add a new self-contained generator `stud` and register it; add a new `catalog/dimensions/studs.json` with 1 base (`din938`) + 5 aliases. No change to any existing generator or to `build_part`.
- Representative size **M12**: `d=12.0`, `length=60.0`, `tip_chamfer=1.0`. `length` and `tip_chamfer` are representative and flagged in the source strings.
- Every committed envelope dimension confirmed by **≥2 named public tables** at the sourcing gate (controller, before Task 2). Representative fields flagged.
- Aliases never chain: `din938d`, `din939`, `din939d`, `din835`, `din835d` all target the real non-alias base `din938`. `hardwareType: "screw"` on every entry. `verified: true` only after cross-check.
- Source strings cite only public tables — **no** `reyher`, `stalmut`, or any private catalogue.
- **Generate-only:** do NOT modify `data/image-mappings.json` or `src/lib/data/standards-generated.ts`; do NOT run `catalog/integrate.py`. Existing SVGs stay byte-identical. Only one new file renders: `din938.svg`.
- All build123d / pytest runs happen in-container via `./catalog/run <cmd>` — never on the host.
- If `catalog/out/manifest.json` shows whitespace-only rebuild churn, normalise it with `pnpm exec prettier --write catalog/out/manifest.json` so the committed diff is only the new `din938` entry.

---

## Task 1: `stud` generator + registration + unit tests

**Files:**

- Create: `catalog/models/stud.py`
- Modify: `catalog/models/_registry.py` (import + `KNOWN_FAMILIES` entry)
- Test: `catalog/tests/test_stud.py`

**Interfaces:**

- Produces: `stud(d: float, length: float, tip_chamfer: float | None = None) -> Part` — a plain
  cylinder of diameter `d`, axial `length`, `z ∈ [0, length]`, with a 45-degree lead chamfer of leg
  `tip_chamfer` at both the `z=0` and `z=length` ends (omit `tip_chamfer` for a plain cylinder).
  Registered as family `"stud"`; Task 2's data entries call it through `build_part("stud", shape)`.
- Consumes: nothing from earlier tasks (this is the first task).

- [ ] **Step 1: Write the failing generator unit tests**

Create `catalog/tests/test_stud.py`:

```python
import pytest
from build123d import Box, Pos

from catalog.models.stud import stud

# Synthetic fixture (NOT a real standard): plain rod dia 12 x 60 long, 1 mm chamfer at both ends.
BASE = dict(d=12.0, length=60.0, tip_chamfer=1.0)


def _solid_at(part, x, y, z, probe=0.2):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT) inside a
    BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = stud(**BASE)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(BASE["length"], 1)     # rod length along Z
    assert round(bb.size.X, 1) == round(BASE["d"], 1)          # body diameter on X
    assert round(bb.min.Z, 1) == 0.0                           # bottom free end
    assert round(bb.max.Z, 1) == round(BASE["length"], 1)      # top free end
    assert part.volume > 0


def test_single_solid():
    assert len(stud(**BASE).solids()) == 1


def test_both_ends_chamfered():
    # The chamfer removes material at the full outer radius near each face: at z just off a face
    # the outer radius is < r, but the reduced-radius core is still present; mid-body is full r.
    part = stud(**BASE)
    r = BASE["d"] / 2.0                 # 6.0
    length = BASE["length"]            # 60
    c = BASE["tip_chamfer"]            # 1
    assert _solid_at(part, r - 0.2, 0.0, length / 2.0)          # mid-body: full radius is solid
    assert not _solid_at(part, r - 0.2, 0.0, 0.1)              # bottom face: chamfered away at r
    assert not _solid_at(part, r - 0.2, 0.0, length - 0.1)     # top face: chamfered away at r
    assert _solid_at(part, r - c - 0.5, 0.0, 0.1)             # bottom core present
    assert _solid_at(part, r - c - 0.5, 0.0, length - 0.1)    # top core present


def test_plain_cylinder_has_full_radius_at_both_faces():
    part = stud(d=12.0, length=60.0)                            # no chamfer
    assert _solid_at(part, 5.8, 0.0, 0.1)                       # full radius solid at bottom face
    assert _solid_at(part, 5.8, 0.0, 59.9)                      # full radius solid at top face


def test_guard_chamfer_not_smaller_than_radius():
    with pytest.raises(ValueError):
        stud(d=12.0, length=60.0, tip_chamfer=6.0)             # == r, must be < r


def test_guard_two_chamfers_exceed_length():
    with pytest.raises(ValueError):
        stud(d=12.0, length=1.5, tip_chamfer=1.0)             # 2*1 >= 1.5


def test_guard_non_positive_dims():
    with pytest.raises(ValueError):
        stud(d=0.0, length=60.0)
    with pytest.raises(ValueError):
        stud(d=12.0, length=0.0)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_stud.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.stud'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/stud.py`:

```python
"""Plain double-end stud / threaded-rod family generator (DIN 938 / 939 / 835).

A headless, socket-less smooth cylinder (envelope-only, no drawn thread) with a 45-degree lead
chamfer at BOTH free ends. A stud has a thread at each end and a plain unthreaded middle; the
standards in this family (DIN 938 metal end 1d, DIN 939 1.25d, DIN 835 2d) differ only in the
thread-end engagement length, which is not drawn, so envelope-only they are the same plain rod.
Modelled axis-along-Z: the body sits z in [0, length].

The body is one revolve of an XZ meridian about Z (the same deterministic technique as
``_screw_shank`` / ``set_screw`` — no fragile edge selection). Self-contained: no dependency on
``screw_common``.
"""
from build123d import BuildPart, BuildSketch, Polygon, Plane, Axis, revolve


def stud(d: float, length: float, tip_chamfer: float | None = None):
    """Plain double-end stud: a smooth cylinder of diameter ``d`` and axial ``length`` with an
    optional 45-degree lead chamfer of leg ``tip_chamfer`` at BOTH free ends. Built along +Z with
    the body z in [0, length], by revolving a meridian in the XZ plane about Z. Envelope only; no
    thread, no socket, no head.
    """
    if d <= 0:
        raise ValueError(f"stud: need d > 0, got {d}")
    if length <= 0:
        raise ValueError(f"stud: need length > 0, got {length}")
    r = d / 2.0
    if tip_chamfer is not None:
        if not (0.0 < tip_chamfer < r):
            raise ValueError(
                f"stud: tip_chamfer {tip_chamfer} must be > 0 and < radius {r}")
        if 2.0 * tip_chamfer >= length:
            raise ValueError(
                f"stud: two tip_chamfers {tip_chamfer} must fit within length {length} "
                f"(need 2*tip_chamfer < length)")
        c = tip_chamfer
        # (x=radius, z=axial): bottom face -> bottom chamfer -> wall -> top chamfer -> top face.
        profile = [(0.0, 0.0), (r - c, 0.0), (r, c),
                   (r, length - c), (r - c, length), (0.0, length)]
    else:
        profile = [(0.0, 0.0), (r, 0.0), (r, length), (0.0, length)]
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)          # explicit coords -> no auto-centring
        revolve(axis=Axis.Z, revolution_arc=360)
    part = bp.part
    if part.volume <= 0:                            # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("stud: produced an empty solid")
    if len(part.solids()) != 1:                     # must be a single fused solid
        raise ValueError("stud: produced more than one solid")
    return part
```

- [ ] **Step 4: Register the generator**

In `catalog/models/_registry.py`, add the import alongside the other screw generators (near the `set_screw` / `slotted_screw` imports):

```python
from catalog.models.stud import stud
```

and add the map entry inside `KNOWN_FAMILIES` (near the `"set_screw"` / `"slotted_screw"` entries):

```python
    "stud": stud,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_stud.py -q`
Expected: PASS (7 tests).

- [ ] **Step 6: Confirm no existing test regressed and the registry imports**

Run: `./catalog/run python -m pytest catalog/tests/test_families.py catalog/tests/test_screw_common.py -q`
Expected: PASS (the family registry still imports cleanly with the new entry).

- [ ] **Step 7: Commit**

```bash
git add catalog/models/stud.py catalog/models/_registry.py catalog/tests/test_stud.py
git commit -m "feat(catalog): add stud generator (plain double-end stud, both ends chamfered)"
```

---

## Task 2: `studs.json` data + data sweep tests + build the drawing

**Files:**

- Create: `catalog/dimensions/studs.json`
- Create: `catalog/tests/test_studs_data.py`
- Regenerate (build output, committed): `catalog/out/din938.svg`, `catalog/out/manifest.json`

**Interfaces:**

- Consumes: `build_part("stud", shape)` and family `"stud"` from Task 1; `validate_entry` from
  `catalog/schema.py`.
- Produces: 6 app-served ids covered (`din938`, `din938d`, `din939`, `din939d`, `din835`,
  `din835d`); the `coverage.py` screw gap drops 57 → 51.

**Sourcing gate (controller, BEFORE dispatching this task):** confirm against ≥2 named public tables
that DIN 938/939/835 are plain full-diameter double-end studs at M12 major `d=12` (fasteners.eu DIN
835 table + Schrauben-Lexikon DIN 939/835 + BelMetric + din938.com), and that the metal-end lengths
1d/1.25d/2d are the only difference and are undrawn. The `source` strings below already encode this;
the controller hands them to the implementer verbatim.

- [ ] **Step 1: Write the failing data sweep tests**

Create `catalog/tests/test_studs_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/studs.json")
_FORBIDDEN = ("reyher", "stalmut")

# Plain double-end studs. One drawn base (din938, a plain chamfered M12 rod); DIN 939 (metal end
# 1.25d) and DIN 835 (2d) differ from DIN 938 only in the undrawn thread-engagement length, so they
# alias din938. The "...d" ids are the app's image-variant keys.
_STUD_ALIASES = {
    "din938d": "din938", "din939": "din938", "din939d": "din938",
    "din835": "din938", "din835d": "din938",
}


def test_every_stud_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 6
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_stud_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert entry["hardwareType"] == "screw"
        if "alias_of" in entry:
            continue
        assert entry["family"] == "stud", f"{sid}: unexpected family {entry['family']}"


def test_din938_is_a_plain_rod_base():
    entries = json.loads(DATA.read_text())
    assert "din938" in entries and "alias_of" not in entries["din938"]
    assert entries["din938"]["family"] == "stud"
    shape = entries["din938"]["shape"]
    assert shape["d"] == 12.0
    assert shape["length"] == 60.0
    # plain rod: carries no head / socket / drive fields
    for forbidden in ("socket_af", "socket_depth", "drive", "dk", "k", "s"):
        assert forbidden not in shape, f"din938 shape must not carry {forbidden}"
    build_part(entries["din938"]["family"], shape)


def test_stud_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _STUD_ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from studs.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"


def test_every_stud_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_stud_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_studs_data.py -q`
Expected: FAIL — `FileNotFoundError` / cannot read `catalog/dimensions/studs.json`.

- [ ] **Step 3: Write the dimension file**

Create `catalog/dimensions/studs.json` (the `source` strings are the sourcing-gate verbatim text):

```json
{
	"din938": {
		"family": "stud",
		"shape": { "d": 12.0, "length": 60.0, "tip_chamfer": 1.0 },
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "938" }],
		"source": "DIN 938 double-end stud (Stiftschraube), screw-in / metal end length 1d, M12: a plain full-diameter double-end stud — headless rod with a thread at each end and a plain unthreaded middle at the nominal M12 diameter (NOT waisted), confirmed by fasteners.eu DIN 938 'studs with engagement length 1 x d' + Schrauben-Lexikon DIN 938 + BelMetric double-end stud description + din938.com dimension notes. d=12.0 (M12 major). length=60.0 REPRESENTATIVE (studs ship in many lengths; envelope-only the length does not change which standard it is). tip_chamfer=1.0 REPRESENTATIVE 45-degree end break. Envelope only — no drawn thread; the 1d metal-end engagement length is a thread feature and is not drawn."
	},
	"din938d": {
		"alias_of": "din938",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "938" }],
		"source": "DIN 938 M12, app image-variant key — identical plain double-end stud envelope (d=12, 60 long, chamfered both ends); aliases the din938 base."
	},
	"din939": {
		"alias_of": "din938",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "939" }],
		"source": "DIN 939 double-end stud (Stiftschraube), screw-in / metal end length 1.25d, M12: the same plain full-diameter double-end stud envelope as DIN 938 — the 1.25d metal-end thread length is the only difference and is not drawn (envelope only, no thread), confirmed by Schrauben-Lexikon DIN 939 (Einschraubende = 1,25 d) + Aspen Fasteners DIN 939 double-end stud datasheet + fasteners.eu stud tables. Aliases the din938 base."
	},
	"din939d": {
		"alias_of": "din938",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "939" }],
		"source": "DIN 939 M12, app image-variant key — identical plain double-end stud envelope; aliases the din938 base."
	},
	"din835": {
		"alias_of": "din938",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "835" }],
		"source": "DIN 835 double-end stud (Stiftschraube), screw-in / metal end length 2d, M12: the same plain full-diameter double-end stud envelope as DIN 938 — the 2d metal-end thread length is the only difference and is not drawn (envelope only), confirmed by fasteners.eu DIN 835 double-end studs table (M12 b1=24, b2=30) + Schrauben-Lexikon DIN 835 (Einschraubende = 2d) + BelMetric DIN 835 stud. Aliases the din938 base."
	},
	"din835d": {
		"alias_of": "din938",
		"hardwareType": "screw",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "835" }],
		"source": "DIN 835 M12, app image-variant key — identical plain double-end stud envelope; aliases the din938 base."
	}
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_studs_data.py -q`
Expected: PASS (6 tests).

- [ ] **Step 5: Build the catalog (renders `din938.svg`, updates the manifest)**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: the build discovers `studs.json` automatically (the builder globs `catalog/dimensions/*.json`), renders `catalog/out/din938.svg`, and adds `din938` to `catalog/out/manifest.json`. No other SVG changes.

- [ ] **Step 6: Verify generate-only invariants**

Run:

```bash
git status --porcelain data/image-mappings.json src/lib/data/standards-generated.ts
git diff --stat catalog/out/ | tail -5
```

Expected: the two app files are unmodified (no output lines). Under `catalog/out/` only `din938.svg` is added and `manifest.json` changed; no existing `*.svg` is modified.

If `manifest.json` shows whitespace-only churn beyond the new `din938` entry, normalise it:
`pnpm exec prettier --write catalog/out/manifest.json`

- [ ] **Step 7: Verify the coverage gap dropped 57 → 51**

Run:

```bash
./catalog/run python -c "from catalog.qa.coverage import check; g=check('catalog/out/manifest.json','data/image-mappings.json','screw'); print('SCREW GAP:', len(g)); assert not ({'din938','din938d','din939','din939d','din835','din835d'} & set(g)), 'stud ids still uncovered'"
```

Expected: `SCREW GAP: 51` and no assertion error (none of the 6 stud ids remain in the gap).

- [ ] **Step 8: Run the full catalog test suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS (all existing tests plus `test_stud.py` and `test_studs_data.py`).

- [ ] **Step 9: Commit**

```bash
git add catalog/dimensions/studs.json catalog/tests/test_studs_data.py catalog/out/din938.svg catalog/out/manifest.json
git commit -m "feat(catalog): add plain double-end stud coverage (screw gap 57->51)"
```

---

## Self-Review (controller, after both tasks)

- **Spec coverage:** generator (Task 1) + 6 data ids + build + coverage drop (Task 2) — every spec section maps to a task.
- **No placeholders:** all code, JSON, and commands are complete above.
- **Type consistency:** the generator signature `stud(d, length, tip_chamfer=None)` matches the `din938` shape keys (`d`, `length`, `tip_chamfer`) exactly; the family string `"stud"` matches between `_registry.py`, `studs.json`, and both test files.
