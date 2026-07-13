# Cap / Dome Nut Family Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cap / dome nut family (DIN 1587 / 917 / 986 at M12) to the maintainer-only generative catalog: a chamfered vertex-up hex body with a closed spherical-cap dome, no bore.

**Architecture:** New `catalog/models/cap_nut.py` reuses the existing `_chamfered_hex_solid(s, m, chamfer)` helper **unchanged**, unions a solid spherical cap on top, and subtracts no bore. Registered as family `cap_nut`; data in `catalog/dimensions/cap_nuts.json`. No render/preset change (hardwareType `nut` → existing vertex-up `NUT_PRESET`).

**Tech Stack:** Python + build123d (in-container via `./catalog/run`), pytest, JSON dimension data.

## Global Constraints

- Representative size **M12**; ship **only s = 18** (no legacy SW19 variants).
- Every committed dimension confirmed by **≥2 independent public tables** (already sourced — see spec).
- Source strings must **not** contain `reyher`, `stalmut`, or any private/internal catalogue.
- Reuse `_chamfered_hex_solid` **unchanged** — do not edit `catalog/models/hex_nut.py`. Existing hex_nut / flange_nut / washer SVGs must stay **byte-identical** (sha256) after the build.
- **No bore** (closed cap) — no SUBTRACT cylinder. **No render/preset change.**
- Vertex-up orientation is inherited from the helper + NUT_PRESET.
- **opt-in invariant 0/0**: after build, `data/image-mappings.json` and `src/lib/data/standards-generated.ts` each keep 0 `.svg` references.
- All Python runs in-container: `./catalog/run pytest ...` and `./catalog/run python -m catalog.build_catalog`. Never run pytest/build on the host.

**Reference geometry (spherical cap):** base circle radius `r_flat = (s if chamfer is None else chamfer) / 2` (the top chamfer circle of the hex body). For dome height `h`, the cap sphere radius is `R = (r_flat**2 + h**2) / (2*h)`, centred on Z at `z_c = base_z + h - R` where `base_z = m - dome_height` is the hex-body top plane; the apex sits at `z = m`. A cap of height `h` on a sphere of radius `R` has volume `pi*h**2*(3*R - h)/3`. Tall domes (`h > r_flat`, e.g. DIN 1587) are slightly super-hemispherical (the sphere's widest ring, radius `R`, lies just above the base) — this is expected and small (≈0.4 mm on M12).

---

### Task 1: `cap_nut` generator

**Files:**

- Create: `catalog/models/cap_nut.py`
- Test: `catalog/tests/test_cap_nut.py`

**Interfaces:**

- Consumes: `catalog.models.hex_nut._chamfered_hex_solid(s, m, chamfer=None)` — builds the vertex-up chamfered hex body (no bore); raises `ValueError` on bad `s`/height/chamfer geometry.
- Produces: `cap_nut(s: float, m: float, dome_height: float, chamfer: float | None = None) -> Part` — a solid closed cap nut, total height `m`. Registered under family key `"cap_nut"` in Task 2.

- [ ] **Step 1: Write the failing tests**

Create `catalog/tests/test_cap_nut.py`:

```python
import math

import pytest

from catalog.models.cap_nut import cap_nut

S = 18.0                                   # M12 across-flats
R_FLAT = S / 2.0                           # dome base circle == top chamfer circle
CIRCUMRADIUS = S / math.sqrt(3.0)          # hex corner radius
ACROSS_CORNERS = 2.0 * CIRCUMRADIUS

# Hemisphere fixture (dome height == base radius): the dome never exceeds the flats.
M_HEMI = 18.0
DOME_HEMI = 9.0
# Tall acorn fixture (DIN 1587-like): dome taller than a hemisphere.
M_TALL = 22.0
DOME_TALL = 12.0


def _cap_volume(r_flat, h):
    r = (r_flat ** 2 + h ** 2) / (2.0 * h)          # sphere radius R
    return math.pi * h ** 2 * (3.0 * r - h) / 3.0   # spherical-cap volume


def test_cap_nut_is_vertex_up_with_a_hemisphere_within_the_flats():
    part = cap_nut(s=S, m=M_HEMI, dome_height=DOME_HEMI)
    bb = part.bounding_box()
    assert round(bb.size.X, 2) == round(ACROSS_CORNERS, 2)   # hex corners widest (vertex-up)
    assert round(bb.size.Y, 2) == round(S, 2)                # a hemisphere stays within the flats
    assert round(bb.size.Z, 2) == round(M_HEMI, 2)           # total height along Z
    assert part.volume > 0


def test_cap_nut_dome_reaches_the_total_height():
    part = cap_nut(s=S, m=M_TALL, dome_height=DOME_TALL)
    bb = part.bounding_box()
    assert round(bb.max.Z, 1) == round(M_TALL, 1)            # apex at the total height m
    # The dome adds material above the bare hex body.
    from catalog.models.hex_nut import _chamfered_hex_solid
    hex_body = _chamfered_hex_solid(S, M_TALL - DOME_TALL)
    assert part.volume > hex_body.volume


def test_cap_nut_is_a_closed_solid_hex_body_plus_spherical_cap():
    part = cap_nut(s=S, m=M_TALL, dome_height=DOME_TALL)
    from catalog.models.hex_nut import _chamfered_hex_solid
    hex_body = _chamfered_hex_solid(S, M_TALL - DOME_TALL)
    expected = hex_body.volume + _cap_volume(R_FLAT, DOME_TALL)   # no bore removed
    assert abs(part.volume - expected) / expected < 0.02


def test_cap_nut_bottom_face_is_chamfered():
    part = cap_nut(s=S, m=M_HEMI, dome_height=DOME_HEMI)
    bottom = [v for v in part.vertices() if v.Z < 0.2]
    assert bottom, "expected vertices on the bottom bearing face"
    # The bottom chamfer pulls the corners in from the full corner radius to ~s/2.
    assert max(math.hypot(v.X, v.Y) for v in bottom) < CIRCUMRADIUS - 0.3


def test_cap_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        cap_nut(s=S, m=M_HEMI, dome_height=0.0)              # no dome
    with pytest.raises(ValueError):
        cap_nut(s=S, m=M_HEMI, dome_height=M_HEMI)           # dome eats the whole height
    with pytest.raises(ValueError):
        cap_nut(s=S, m=30.0, dome_height=28.0)               # dome > 3x base radius: likely bad data
    with pytest.raises(ValueError):
        cap_nut(s=0.0, m=M_HEMI, dome_height=DOME_HEMI)      # zero across-flats (delegated to helper)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./catalog/run pytest catalog/tests/test_cap_nut.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'catalog.models.cap_nut'`.

- [ ] **Step 3: Write the generator**

Create `catalog/models/cap_nut.py`:

```python
"""Cap / dome nut family generator: a chamfered hex body with a closed spherical-cap dome."""
from build123d import BuildPart, Sphere, Box, Locations, Mode, add

from catalog.models.hex_nut import _chamfered_hex_solid

# Representative dome height as a fraction of across-flats s, used ONLY when a standard
# publishes neither a dome height nor a total-minus-hex-body split. Same role as
# _FLANGE_CONE_ANGLE_DEG in flange_nut: one documented constant for the single
# untabulated transition, while every tabulated dimension stays sourced.
_CAP_DOME_HEIGHT_FRACTION = 2.0 / 3.0


def cap_nut(s: float, m: float, dome_height: float, chamfer: float | None = None):
    """Closed cap (dome / acorn) nut: across-flats ``s``, total height ``m``, dome of
    height ``dome_height`` rising from the top chamfer circle.

    A shared chamfered vertex-up hex body (``_chamfered_hex_solid``) of height
    ``m - dome_height`` with a solid spherical cap unioned on top. The cap base circle
    is the top chamfer circle (radius ``chamfer/2``, default ``s/2``), so the dome
    springs seamlessly from the chamfered hex top. No bore (closed cap). A tall dome
    (``dome_height > s/2``) is slightly super-hemispherical, as a real acorn crown is.
    """
    if dome_height <= 0:
        raise ValueError(f"cap_nut: need dome_height > 0, got {dome_height}")
    if dome_height >= m:
        raise ValueError(
            f"cap_nut: dome_height {dome_height} leaves no hex body under height {m}")
    r_flat = (s if chamfer is None else chamfer) / 2.0
    if dome_height > 3.0 * r_flat:
        raise ValueError(
            f"cap_nut: dome_height {dome_height} exceeds 3x the base radius {r_flat} "
            f"(likely bad data)")

    hex_h = m - dome_height
    hex_solid = _chamfered_hex_solid(s, hex_h, chamfer)   # validates s, hex_h, chamfer geometry

    base_z = hex_h                                # top plane of the hex body
    sphere_r = (r_flat ** 2 + dome_height ** 2) / (2.0 * dome_height)   # spherical-cap radius R
    z_c = base_z + dome_height - sphere_r          # sphere centre on the Z axis (apex at z=m)
    big = 4.0 * (sphere_r + m)                     # trim box, comfortably larger than the part

    # Build the spherical cap alone: a full sphere trimmed to the half-space z >= base_z,
    # leaving a cap of height exactly `dome_height` seated on the base circle of radius r_flat.
    # (Trim the cap in its own context so the box never touches the hex body below base_z.)
    with BuildPart() as cap_bp:
        with Locations((0.0, 0.0, z_c)):
            Sphere(radius=sphere_r)
        with Locations((0.0, 0.0, base_z - big / 2.0)):
            Box(big, big, big, mode=Mode.SUBTRACT)
    cap = cap_bp.part

    with BuildPart() as bp:
        add(hex_solid)
        add(cap)                                   # union the dome onto the hex body
    part = bp.part
    if part.volume <= 0:                           # net guard (matches hex_nut/flange_nut)
        raise ValueError("cap_nut: produced an empty solid")
    return part
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./catalog/run pytest catalog/tests/test_cap_nut.py -q`
Expected: PASS (5 tests).

- [ ] **Step 5: Confirm the shared helper and existing generators are untouched**

Run: `git diff --stat catalog/models/hex_nut.py catalog/models/flange_nut.py`
Expected: no output (neither file changed).
Run: `./catalog/run pytest catalog/tests/test_hex_nut.py catalog/tests/test_flange_nut.py -q`
Expected: PASS (existing generator tests still green).

- [ ] **Step 6: Commit**

```bash
git add catalog/models/cap_nut.py catalog/tests/test_cap_nut.py
git commit -m "feat(catalog): cap/dome nut generator (spherical cap on chamfered hex)"
```

---

### Task 2: Register the family and add the M12 data

**Files:**

- Modify: `catalog/models/_registry.py`
- Create: `catalog/dimensions/cap_nuts.json`
- Test: `catalog/tests/test_cap_nuts_data.py`

**Interfaces:**

- Consumes: `cap_nut` from Task 1; `catalog.schema.validate_entry(sid, entry)`; `catalog.models._registry.build_part(family, shape)`.
- Produces: three catalog entries (`din1587`, `din917`, `din986`) buildable via `build_part("cap_nut", shape)`.

- [ ] **Step 1: Write the failing data test**

Create `catalog/tests/test_cap_nuts_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/cap_nuts.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_cap_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_all_cap_bases_are_cap_nuts():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "cap_nut", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_every_cap_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_cap_nut_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_cap_nuts_data.py -q`
Expected: FAIL — `cap_nuts.json` does not exist (FileNotFoundError), and `build_part` would reject family `cap_nut` until registered.

- [ ] **Step 3: Register the family**

In `catalog/models/_registry.py`, add the import next to the other nut imports:

```python
from catalog.models.cap_nut import cap_nut
```

and add the entry to `KNOWN_FAMILIES` (after `"flange_nut": flange_nut,`):

```python
    "cap_nut": cap_nut,
```

- [ ] **Step 4: Add the data file**

Create `catalog/dimensions/cap_nuts.json`:

```json
{
	"din1587": {
		"family": "cap_nut",
		"shape": { "s": 18.0, "m": 22.0, "dome_height": 12.0 },
		"hardwareType": "nut",
		"source": "DIN 1587 hexagon domed cap (acorn) nut (M12): s=18 (current ISO 272-aligned width; legacy pre-1992 s=19 not shipped), total height m=22, hex body 10 -> dome_height=12 (derived, not directly tabulated). Confirmed vs Westfield Fasteners + Andrews Fasteners + fasteners.eu DIN 1587 tables.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "1587" }]
	},
	"din917": {
		"family": "cap_nut",
		"shape": { "s": 18.0, "m": 16.0, "dome_height": 8.0 },
		"hardwareType": "nut",
		"source": "DIN 917 hexagon cap nut, low type (M12): s=18, total height m=16, hex body 8 (m' minimum) -> dome_height=8 (derived). Confirmed vs fasteners.eu + Fuller Fasteners + TorqBolt DIN 917 tables.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "917" }]
	},
	"din986": {
		"family": "cap_nut",
		"shape": { "s": 18.0, "m": 22.5, "dome_height": 9.0 },
		"hardwareType": "nut",
		"source": "DIN 986 all-metal prevailing-torque hexagon domed cap nut (M12): s=18 (ISO 4032-aligned SW18; legacy SW19 not shipped), total height h2=22.5, hex body h1=13.5 -> dome_height=9. The prevailing-torque crown deformation is not modelled (envelope-only, same precedent as DIN 6927). Confirmed vs Fabory + Bossard BN 167 + Fuller Fasteners + fasteners.eu.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "986" }]
	}
}
```

- [ ] **Step 5: Run the data test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_cap_nuts_data.py -q`
Expected: PASS (4 tests) — all three entries validate, build to a positive-volume part, and carry clean sources.

- [ ] **Step 6: Run the families registry test**

Run: `./catalog/run pytest catalog/tests/test_families.py -q`
Expected: PASS (the registry still dispatches every known family).

- [ ] **Step 7: Commit**

```bash
git add catalog/models/_registry.py catalog/dimensions/cap_nuts.json catalog/tests/test_cap_nuts_data.py
git commit -m "feat(catalog): register cap_nut family and add DIN 1587/917/986 M12 data"
```

---

### Task 3: Build the catalog and verify invariants

**Files:**

- Modify (generated, committed): `catalog/out/*.svg`, `catalog/out/manifest.json`

**Interfaces:**

- Consumes: the registered family + data from Tasks 1–2. `catalog/build_catalog.py` is unchanged — it auto-globs `dimensions/*.json` and renders via `preset_for_hardware_type(entry["hardwareType"])`.

- [ ] **Step 1: Record the pre-build state of existing drawings**

Run: `git -C . stash list >/dev/null 2>&1; ls catalog/out/*.svg | wc -l && sha256sum catalog/out/*.svg > /tmp/cap_pre_shas.txt && wc -l /tmp/cap_pre_shas.txt`
Expected: prints the current SVG count and writes their sha256 to `/tmp/cap_pre_shas.txt`.

- [ ] **Step 2: Run the full catalog test suite in-container**

Run: `./catalog/run pytest catalog/tests -q`
Expected: PASS (all existing tests plus the new `test_cap_nut.py` and `test_cap_nuts_data.py`).

- [ ] **Step 3: Build the catalog**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: reports `ok` for every entry, `0 failed`; writes 3 new drawings `catalog/out/din1587.svg`, `din917.svg`, `din986.svg` and updates `catalog/out/manifest.json`.

- [ ] **Step 4: Verify no existing drawing changed (behavior-preserving reuse)**

Run: `sha256sum -c /tmp/cap_pre_shas.txt`
Expected: every previously existing SVG reports `OK` (the shared helper was reused unchanged, so hex/flange/washer drawings are byte-identical). Only the 3 new SVGs are additions.

- [ ] **Step 5: Verify the three new drawings exist**

Run: `ls -1 catalog/out/din1587.svg catalog/out/din917.svg catalog/out/din986.svg`
Expected: all three listed.

- [ ] **Step 6: Verify the opt-in invariant (0/0)**

Run: `grep -c '\.svg' data/image-mappings.json src/lib/data/standards-generated.ts`
Expected: both files report `0` — cap nuts are catalog-only; the legacy raster set stays the default.

- [ ] **Step 7: Normalise the manifest formatting and commit the build output**

```bash
npx prettier --write catalog/out/manifest.json
git add catalog/out
git commit -m "build(catalog): render DIN 1587/917/986 cap nut drawings"
```

Expected: the commit contains only the 3 new SVGs and the manifest update (verify with `git show --stat HEAD` — no existing SVG appears).

---

## Self-Review

**Spec coverage:** Generator (Task 1), data + registration (Task 2), build + all invariants incl. opt-in 0/0 and byte-identical existing SVGs (Task 3). Dome geometry, guards, representative constant, no-bore, no-render-change all covered. ✅

**Placeholder scan:** No TBD/TODO; every code and command step is concrete. ✅

**Type consistency:** `cap_nut(s, m, dome_height, chamfer=None)` used identically in the generator, tests, registry, and data `shape` keys (`s`, `m`, `dome_height`). `_chamfered_hex_solid(s, hex_h, chamfer)` matches the existing helper signature. ✅
