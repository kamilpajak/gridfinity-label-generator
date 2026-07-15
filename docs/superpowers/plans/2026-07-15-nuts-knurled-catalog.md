# Knurled Nut Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a knurled nut family (DIN 466 high + DIN 467 low) to the maintainer-only generative catalog — one generator, smooth cylindrical body, at M12.

**Architecture:** New generator `catalog/models/knurled_nut.py` builds a smooth `Cylinder` head (the knurl is not drawn) with an optional narrower lower collar/boss unioned below it, then subtracts a through bore last. Registered in `_registry.py`; data in a new `knurled_nuts.json`. No render/preset change (axisymmetric → `NUT_PRESET`).

**Tech Stack:** Python 3, build123d, pytest — all run **in the pinned container** via `./catalog/run`. Never run these on the host.

## Global Constraints

- Representative size **M12** only. No user-facing toggle (epic END goal).
- Every committed envelope dimension (`d`, `h`, `collar_d`, `collar_h`) confirmed by **≥2 independent public tables**; any representative field documented as such in the `source` string, never fabricated as normative.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- Import **only** `_MIN_WALL_MM` from `hex_nut` — do **not** touch `_chamfered_hex_solid`, `hex_nut.py`, or any existing generator. Existing SVGs must stay **byte-identical** (rebuild → `git status catalog/out` shows no change to existing files).
- **No render/preset change.** The body is axisymmetric; hardwareType `nut` → `NUT_PRESET`.
- **Opt-in 0/0:** do **not** run `catalog/integrate.py`. `data/image-mappings.json` and `src/lib/data/standards-generated.ts` stay untouched — `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts` must return `0` for both.
- All builds/tests run in-container via `./catalog/run`. **Pre-warm the image once** before the first timed step.
- Build entrypoint in-container is `./catalog/run python -m catalog.build_catalog` (the module form; `python catalog/build_catalog.py` raises `ModuleNotFoundError` in the container).

---

## Task 1: `knurled_nut` generator + tests + registry

**Files:**

- Create: `catalog/models/knurled_nut.py`
- Create: `catalog/tests/test_knurled_nut.py`
- Modify: `catalog/models/_registry.py` (add the import + one `KNOWN_FAMILIES` entry)

**Interfaces:**

- Consumes: `from catalog.models.hex_nut import _MIN_WALL_MM` (`= 0.1`).
- Produces: `knurled_nut(d, h, bore, collar_d=None, collar_h=None) -> Part` and the registry key `"knurled_nut"`.

The fixtures in the tests below are **synthetic** — geometrically valid numbers to exercise the code, **not** any real standard. Real standards come in Task 2.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_knurled_nut.py`:

```python
import pytest
from build123d import Box, Pos

from catalog.models.knurled_nut import knurled_nut

BORE = 10.1
# Synthetic geometric fixtures (NOT any real standard) — geometry-only checks.
DISC = dict(d=20.0, h=6.0, bore=BORE)                                # DIN 467-like: no collar
HIGH = dict(d=20.0, h=10.0, bore=BORE, collar_d=16.0, collar_h=4.0)  # DIN 466-like: head + boss


def _has_material(part, x, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, 0, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, 0.0, z) * Box(probe, probe, probe)) is not None


def test_disc_envelope_extents():
    part = knurled_nut(**DISC)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(DISC["d"], 1)   # round body: OD on X and Y
    assert round(bb.size.Y, 1) == round(DISC["d"], 1)
    assert round(bb.size.Z, 1) == round(DISC["h"], 1)   # disc height
    assert part.volume > 0


def test_high_envelope_extents():
    part = knurled_nut(**HIGH)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(HIGH["d"], 1)                     # head OD is the widest
    assert round(bb.size.Z, 1) == round(HIGH["collar_h"] + HIGH["h"], 1)  # collar + head stacked


def test_high_collar_is_narrower_than_the_head():
    part = knurled_nut(**HIGH)
    # low z (inside the collar, z=2 < collar_h=4): material inside collar_d/2=8, none beyond it
    assert _has_material(part, x=7.0, z=2.0)          # collar wall (bore 5.05 < 7 < 8)
    assert not _has_material(part, x=9.0, z=2.0)      # beyond the collar OD
    # head height (z=8, inside head 4..14): material out to near d/2=10 — the head oversails
    assert _has_material(part, x=9.0, z=8.0)


def test_disc_is_a_full_cylinder_no_step():
    part = knurled_nut(**DISC)
    assert _has_material(part, x=9.0, z=1.0)          # full d/2=10 radius near the bottom
    assert _has_material(part, x=9.0, z=5.0)          # and near the top — no step


def test_open_bore_through_the_nut():
    part = knurled_nut(**HIGH)
    assert not _has_material(part, x=0.0, z=2.0, probe=0.6)   # inside the through bore
    assert _has_material(part, x=7.0, z=8.0, probe=0.6)       # head wall between bore and OD
    solid = knurled_nut(**{**HIGH, "bore": 0.4})
    assert part.volume < solid.volume                        # the M12 bore removes real material


@pytest.mark.parametrize("cfg", [DISC, HIGH])
def test_builds_at_valid_configs(cfg):
    assert knurled_nut(**cfg).volume > 0


def test_knurled_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        knurled_nut(**{**DISC, "d": 0.0})                    # non-positive dim
    with pytest.raises(ValueError):
        knurled_nut(**{**DISC, "bore": DISC["d"]})           # bore wall vs head OD too thin
    with pytest.raises(ValueError):
        knurled_nut(**{**DISC, "collar_d": 16.0})            # collar_d without collar_h
    with pytest.raises(ValueError):
        knurled_nut(**{**DISC, "collar_h": 4.0})             # collar_h without collar_d
    with pytest.raises(ValueError):
        knurled_nut(**{**HIGH, "collar_d": 20.0})            # collar_d >= head d (no step)
    with pytest.raises(ValueError):
        knurled_nut(**{**HIGH, "collar_d": BORE})            # collar wall around bore too thin
    with pytest.raises(ValueError):
        knurled_nut(**{**HIGH, "collar_h": -1.0})            # non-positive collar dim
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_knurled_nut.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog.models.knurled_nut'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/knurled_nut.py`:

```python
"""Knurled nut family generator (DIN 466 high, DIN 467 low).

A smooth cylindrical head (the knurl is a fine feature and is NOT drawn, like the thread)
with an optional narrower lower collar/boss unioned below it, and a through bore. DIN 467
(low) is a plain knurled disc (no collar); DIN 466 (high) is a knurled head on a narrower
plain boss. Only the smooth envelope is drawn. Axisymmetric — no preset change.
"""
from build123d import BuildPart, Cylinder, Locations, Align, Mode

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def knurled_nut(d: float, h: float, bore: float,
                collar_d: float | None = None, collar_h: float | None = None):
    """Knurled nut: smooth head of diameter ``d`` and height ``h`` with a through ``bore``.

    When ``collar_d``/``collar_h`` are given (DIN 466), a narrower plain boss of diameter
    ``collar_d`` and height ``collar_h`` is unioned on the bearing face below the head, which
    is raised to sit on top of it (total height ``collar_h + h``). Both collar params must be
    supplied together or both omitted (DIN 467, a plain disc). Bore subtracted last.
    """
    for name, val in (("d", d), ("h", h), ("bore", bore)):
        if val <= 0:
            raise ValueError(f"knurled_nut: need {name} > 0, got {val}")
    if bore >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"knurled_nut: bore {bore} leaves too thin a wall vs head d {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")
    has_collar = collar_d is not None or collar_h is not None
    if has_collar and (collar_d is None or collar_h is None):
        raise ValueError(
            "knurled_nut: collar_d and collar_h must be given together (or both omitted)")
    if has_collar:
        if collar_d <= 0 or collar_h <= 0:
            raise ValueError(
                f"knurled_nut: need collar_d, collar_h > 0, got collar_d={collar_d}, collar_h={collar_h}")
        if collar_d >= d:
            raise ValueError(
                f"knurled_nut: collar_d {collar_d} must be < head d {d} (the boss is a narrower step)")
        if collar_d <= bore + 2.0 * _MIN_WALL_MM:
            raise ValueError(
                f"knurled_nut: collar_d {collar_d} leaves too thin a wall around bore {bore} "
                f"(needs > bore + {2.0 * _MIN_WALL_MM} mm)")

    collar_h_val = collar_h if has_collar else 0.0
    total_h = collar_h_val + h
    with BuildPart() as bp:
        if has_collar:
            Cylinder(radius=collar_d / 2.0, height=collar_h,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))   # boss on the bearing face z=0
        with Locations((0.0, 0.0, collar_h_val)):
            Cylinder(radius=d / 2.0, height=h,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))   # head on top of the boss
        Cylinder(radius=bore / 2.0, height=total_h * 3.0, mode=Mode.SUBTRACT)   # through bore, last
    part = bp.part
    if part.volume <= 0:                              # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("knurled_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Register the family**

In `catalog/models/_registry.py`, add the import next to the other nut imports (after `from catalog.models.lock_nut import lock_nut`):

```python
from catalog.models.lock_nut import lock_nut
from catalog.models.knurled_nut import knurled_nut
```

and add the entry to `KNOWN_FAMILIES` (after `"lock_nut": lock_nut,`):

```python
    "lock_nut": lock_nut,
    "knurled_nut": knurled_nut,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_knurled_nut.py -v`
Expected: PASS — all 8 tests (2 parametrized) green.

- [ ] **Step 6: Confirm no existing test regressed**

Run: `./catalog/run pytest catalog/tests -q`
Expected: the full catalog suite passes (existing families + the new knurled-nut tests).

- [ ] **Step 7: Commit**

```bash
git add catalog/models/knurled_nut.py catalog/tests/test_knurled_nut.py catalog/models/_registry.py
git commit -m "feat(catalog): add knurled nut generator (DIN 466 high / DIN 467 low)"
```

---

## Task 2: `knurled_nuts.json` data + data test + in-container build

**Files:**

- Create: `catalog/dimensions/knurled_nuts.json`
- Create: `catalog/tests/test_knurled_nuts_data.py`

**Interfaces:**

- Consumes: `knurled_nut(...)` (Task 1) via `build_part(family, shape)`; `catalog.schema.validate_entry(sid, entry)`.
- Produces: rendered SVGs under `catalog/out/` for `din466` and `din467` (no existing file changes).

**SOURCING GATE — do this before writing final numbers.** The envelope fields are **normative and must be verified against ≥2 independent public tables** (fasteners.eu, Fuller Fasteners, Wegertseder, Aspen, globalfastener) for M12:

- `din467` (low knurled disc): head OD `d`, disc thickness `h`.
- `din466` (high knurled): head OD `d`, head height `h`, boss diameter `collar_d`, boss height `collar_h` — the total height `d`/`m` split into head vs boss must come from the table or be documented representative.
  The controller will provide the verified numbers (as with the lock-nut family). Do not invent or single-source any dimension. `bore = 10.1` (M12 minor, ISO 724) is the family constant.

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_knurled_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/knurled_nuts.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_knurled_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_all_knurled_bases_are_knurled_nuts():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "knurled_nut", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_knurled_aliases_point_at_real_non_alias_bases():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" not in entry:
            continue
        target = entry["alias_of"]
        assert target in entries, f"{sid}: alias_of '{target}' unknown"
        assert "alias_of" not in entries[target], f"{sid}: alias points at another alias"


def test_every_knurled_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_knurled_nut_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the data test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_knurled_nuts_data.py -v`
Expected: FAIL — `FileNotFoundError` on `knurled_nuts.json`.

- [ ] **Step 3: Write the data file (after the sourcing gate)**

Create `catalog/dimensions/knurled_nuts.json` using the controller-verified M12 dimensions. Structure (fill `d`/`h`/`collar_d`/`collar_h` from the verified table; `din467` omits the collar fields):

```json
{
	"din467": {
		"family": "knurled_nut",
		"shape": { "d": 0.0, "h": 0.0, "bore": 10.1 },
		"hardwareType": "nut",
		"source": "DIN 467 low knurled nut (M12): head OD d and thickness h tabulated from <table A> + <table B>. Smooth cylindrical envelope drawn (the knurl is a fine feature, not modelled, like the thread). bore=10.1 (M12 minor, ISO 724).",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "467" }]
	},
	"din466": {
		"family": "knurled_nut",
		"shape": { "d": 0.0, "h": 0.0, "bore": 10.1, "collar_d": 0.0, "collar_h": 0.0 },
		"hardwareType": "nut",
		"source": "DIN 466 high knurled nut (M12): head OD d, head height h, boss diameter collar_d and boss height collar_h tabulated from <table A> + <table B>. Smooth cylindrical envelope (knurl not modelled). bore=10.1 (M12 minor, ISO 724).",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "466" }]
	}
}
```

Rules while filling in:

- Replace the `0.0` placeholders with the controller-verified M12 numbers and the `<table A>`/`<table B>` markers with the actual public tables used.
- `din467` has **no** `collar_d`/`collar_h`; `din466` has both, with `collar_d < d`.
- Keep `bore` at `10.1`. `verified: true` only when the values were cross-checked against ≥2 tables.

- [ ] **Step 4: Run the data test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_knurled_nuts_data.py -v`
Expected: PASS — all five checks green.

- [ ] **Step 5: Build the catalog in-container and confirm the new drawings render**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: build succeeds; new `catalog/out/din466.svg` and `catalog/out/din467.svg` appear.

- [ ] **Step 6: Verify existing SVGs are byte-identical and opt-in stays 0/0**

Run: `git status --short catalog/out`
Expected: only the two **new** knurled-nut SVGs listed; **no** modifications to existing SVGs.

Run: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts`
Expected: `0` for both files (opt-in invariant preserved — `integrate.py` not run).

- [ ] **Step 7: Run the full catalog suite once more**

Run: `./catalog/run pytest catalog/tests -q`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add catalog/dimensions/knurled_nuts.json catalog/tests/test_knurled_nuts_data.py catalog/out
git commit -m "feat(catalog): add M12 knurled nut standards (DIN 466 / DIN 467)"
```

---

## Self-review notes (for the executor)

- **Spec coverage:** Task 1 delivers the generator (head + optional collar), guards, and registration; Task 2 delivers the data (≥2-table sourcing gate), the data test, the in-container build, and the opt-in/byte-identical checks.
- **Signature consistency:** `knurled_nut(d, h, bore, collar_d=None, collar_h=None)` is identical in the generator, the tests, and the data `shape` keys.
- **Not covered by design (leave alone):** knurl texture (envelope-only), integration (`integrate.py`), `image-mappings.json`, `standards-generated.ts`, any render/preset change — all out of scope by the opt-in invariant.
