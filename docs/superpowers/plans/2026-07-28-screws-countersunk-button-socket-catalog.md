# Countersunk + Button Socket Screw Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generated drawings for hex-socket countersunk (DIN 7991 / ISO 10642) and button (ISO 7380) head screws by extending the existing `socket_screw` generator with a `head` parameter, covering 4 app-served screw ids (gap 46 → 42).

**Architecture:** `socket_screw` already draws a cylindrical socket-head cap screw and discriminates the drive recess on a `drive` param. This plan adds a parallel `head` param (`"cylindrical"` default / `"countersunk"` / `"button"`): the countersunk branch revolves a cone frustum (the `carriage_bolt` idiom), the button branch builds a spherical cap (the `cap_nut` idiom), and both reuse the existing hex-socket cut and guards verbatim. Two new data bases (`din7991` countersunk, `iso7380` button) plus two aliases (`din7991i`, `iso10642` → `din7991`).

**Tech Stack:** Python + build123d, run only in the pinned Docker container via `./catalog/run`. Tests are pytest. Data is JSON in `catalog/dimensions/`.

## Global Constraints

- **Container-only:** every build123d / pytest / build command runs via `./catalog/run <cmd>`. NEVER run build123d on the host.
- **Generate-only:** do NOT touch `data/image-mappings.json` or `src/lib/data/standards-generated.ts`; do NOT run `catalog/integrate.py`.
- **Additive + byte-identical:** the only new SVGs are `din7991.svg` and `iso7380.svg`; every pre-existing SVG must be byte-identical after rebuild; the manifest gains only the new entries. Normalize manifest whitespace churn with `pnpm exec prettier --write catalog/out/manifest.json`.
- **Existing entries unchanged:** the `head` param is keyword-defaulted to `"cylindrical"`; the 8 existing `socket_screws.json` entries never pass `head`, so their drawings are unchanged.
- **Sourcing:** every committed dimension confirmed by ≥2 named public tables; representative fields (`length`, `tip_chamfer`, the exact cone angle, the omitted button base belt) flagged in the `source` string; source strings contain NO `reyher` / `stalmut` tokens; `verified:true` only after cross-check.
- **Aliases never chain:** `din7991i` and `iso10642` target the real non-alias base `din7991`.
- **Conventional Commits**, ≤100-char header, NO mention of AI/assistant in commit messages.

---

### Task 1: Extend `socket_screw` with countersunk + button head profiles

**Files:**

- Modify: `catalog/models/socket_screw.py` (add `head` param, `_HEAD_SHAPES` guard, head branches, imports)
- Test: `catalog/tests/test_socket_screw.py` (add countersunk + button cases)

**Interfaces:**

- Consumes: `catalog.models.screw_common._screw_shank(d, length, tip_chamfer)` (unchanged).
- Produces: `socket_screw(dk, k, length, d_shank, drive, socket_af, socket_depth, tip_chamfer=None, head="cylindrical")` — new keyword-only-in-practice `head` param accepting `"cylindrical"` / `"countersunk"` / `"button"`. Return type unchanged (a single fused build123d `Part`, head z in `[0, k]`, shank z in `[-length, 0]`).

- [ ] **Step 1: Write the failing tests**

Add these fixtures and tests to `catalog/tests/test_socket_screw.py` (append after the existing tests; keep the existing `HEX` / `LOB` fixtures and `_solid_at` helper as they are):

```python
# Synthetic fixtures (NOT real standards) for the two new head shapes. Same shank/socket as HEX;
# head dia 20 x 8 tall so the cone/dome geometry is clearly non-cylindrical.
CSK = dict(dk=20.0, k=8.0, length=30.0, d_shank=10.0, drive="hex",
           socket_af=8.0, socket_depth=4.0, tip_chamfer=1.5, head="countersunk")
BTN = {**CSK, "head": "button"}


def test_countersunk_head_widens_upward_to_a_flat_top():
    # A countersunk cone is widest at its flat top face (z=k) and narrows downward toward the
    # shank. Probe near the rim: solid high up, void just beyond the rim, void low down.
    part = socket_screw(**CSK)
    r_near_rim = CSK["dk"] / 2.0 - 0.6          # 9.4, just inside the top rim
    top_z = CSK["k"]                            # 8
    assert _solid_at(part, r_near_rim, 0.0, top_z - 0.3, probe=0.3)      # solid at the wide top
    assert not _solid_at(part, CSK["dk"] / 2.0 + 0.6, 0.0, top_z - 0.3, probe=0.3)  # void past rim
    assert not _solid_at(part, r_near_rim, 0.0, 0.3, probe=0.3)          # cone narrow near the base


def test_button_head_domes_over_the_axis():
    # A button head is a spherical dome: tall near the axis, sloping down to the rim. Near the rim
    # the dome surface is low, so material does NOT reach the top; and the socket is blind (a floor
    # of head metal remains below it on the axis).
    part = socket_screw(**BTN)
    r_near_rim = BTN["dk"] / 2.0 - 0.6          # 9.4
    top_z = BTN["k"]                            # 8
    assert not _solid_at(part, r_near_rim, 0.0, top_z - 0.5, probe=0.3)  # dome sloped down at rim
    assert _solid_at(part, r_near_rim, 0.0, 0.3, probe=0.3)             # but solid low down there
    floor = BTN["k"] - BTN["socket_depth"]      # 4
    assert _solid_at(part, 0.0, 0.0, floor - 0.4, probe=0.3)            # blind socket floor on axis


def test_new_heads_have_a_blind_hex_socket_from_the_top():
    # Both new heads carry the hex drive socket: void on the axis just below the top face.
    for fx in (CSK, BTN):
        part = socket_screw(**fx)
        assert not _solid_at(part, 0.0, 0.0, fx["k"] - 0.4, probe=0.3)   # socket void at the top


def test_new_heads_fuse_into_one_solid():
    assert len(socket_screw(**CSK).solids()) == 1
    assert len(socket_screw(**BTN).solids()) == 1
    assert socket_screw(**CSK).volume > 0
    assert socket_screw(**BTN).volume > 0


def test_default_head_is_cylindrical_and_unchanged():
    # Omitting head must reproduce the existing cylindrical head exactly (regression guard for the
    # byte-identical invariant): same volume as an explicit head="cylindrical".
    implicit = socket_screw(**HEX)
    explicit = socket_screw(**{**HEX, "head": "cylindrical"})
    assert implicit.volume == explicit.volume


def test_guard_bad_head():
    with pytest.raises(ValueError):
        socket_screw(**{**CSK, "head": "flat"})
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_socket_screw.py -q`
Expected: the new tests FAIL (e.g. `TypeError: socket_screw() got an unexpected keyword argument 'head'`). The pre-existing socket-screw tests still PASS.

- [ ] **Step 3: Add the `head` param, guard, and head branches**

In `catalog/models/socket_screw.py`:

1. Extend the build123d import to add `Polygon`, `Sphere`, `Box`, `Locations`, `revolve`, `Axis`. The import block becomes:

```python
from build123d import (
    BuildPart, BuildSketch, Cylinder, Circle, RegularPolygon, PolarLocations,
    Polygon, Sphere, Box, Locations, Plane, Axis, Align, Mode, add, extrude, revolve,
)
```

2. Add a head-shapes constant next to `_DRIVES`:

```python
_HEAD_SHAPES = ("cylindrical", "countersunk", "button")
```

3. Change the signature to add the keyword-defaulted `head` (append it after `tip_chamfer`):

```python
def socket_screw(dk: float, k: float, length: float, d_shank: float, drive: str,
                 socket_af: float, socket_depth: float, tip_chamfer: float | None = None,
                 head: str = "cylindrical"):
```

4. Add a `head` guard immediately after the existing `drive` guard (the `if drive not in _DRIVES:` block):

```python
    if head not in _HEAD_SHAPES:
        raise ValueError(f"socket_screw: head must be one of {_HEAD_SHAPES}, got {head!r}")
```

5. Replace the single head-building `Cylinder(...)` line inside `with BuildPart() as bp:` with a three-way branch. The `add(shank)` and the socket-cut block that follow it stay exactly as they are. The head-building block becomes:

```python
    with BuildPart() as bp:
        if head == "cylindrical":
            Cylinder(radius=dk / 2.0, height=k,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))    # head z in [0, k]
        elif head == "countersunk":
            # cone frustum: bottom radius d_shank/2 at z=0, up to top radius dk/2 at z=k, flat top
            # (carriage_bolt countersunk-cone idiom). Using tabulated dk/k directly makes the slant
            # approximate the nominal 90-degree countersink (representative envelope simplification).
            profile = [(d_shank / 2.0, 0.0), (dk / 2.0, k), (0.0, k), (0.0, 0.0)]
            with BuildSketch(Plane.XZ):
                Polygon(*profile, align=None)
            revolve(axis=Axis.Z, revolution_arc=360)                   # head z in [0, k]
        else:                                                          # button: spherical dome
            # spherical cap: base circle radius dk/2 at z=0, apex at z=k (cap_nut idiom). The small
            # cylindrical base belt of a real button head is omitted (envelope simplification).
            r_base = dk / 2.0
            sphere_r = (r_base ** 2 + k ** 2) / (2.0 * k)
            z_c = k - sphere_r                                         # sphere centre on Z
            big = 4.0 * (sphere_r + k)                                 # trim box, larger than cap
            with Locations((0.0, 0.0, z_c)):
                Sphere(radius=sphere_r)
            with Locations((0.0, 0.0, -big / 2.0)):
                Box(big, big, big, mode=Mode.SUBTRACT)                 # keep only z >= 0
        add(shank)                                                     # shares the z=0 face -> fuses
        with BuildSketch(Plane.XY.offset(floor_z)):                    # socket cross-section (as-is)
            ...
```

Leave the `floor_z = k - socket_depth` line, the socket sketch (`if drive == "hex": ... else: ...`), the `extrude(... mode=Mode.SUBTRACT)`, and the volume + `len(part.solids()) != 1` guards exactly as they are.

Also update the module docstring's first paragraph to note the head param (one sentence): the head is cylindrical (default), a countersunk cone (`head="countersunk"`), or a button dome (`head="button"`), each carrying the same blind drive socket.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_socket_screw.py -q`
Expected: PASS (all new + all pre-existing socket-screw tests).

- [ ] **Step 5: Verify existing SVGs are byte-identical after rebuild**

Rebuild the catalog (no new data yet, so only existing SVGs regenerate) and confirm none changed:

Run:

```bash
./catalog/run python -m catalog.build_catalog
git status --short catalog/out/
```

Expected: no modified `.svg` files under `catalog/out/` (the generator change is inert for `head="cylindrical"`). If the manifest shows only whitespace churn, normalize it: `pnpm exec prettier --write catalog/out/manifest.json` then re-check `git diff -w catalog/out/manifest.json` is empty. If any existing `.svg` changed, STOP — the cylindrical path was altered; fix before proceeding.

- [ ] **Step 6: Run the full catalog suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS (no regressions).

- [ ] **Step 7: Commit**

```bash
git add catalog/models/socket_screw.py catalog/tests/test_socket_screw.py
git commit -m "feat(catalog): add countersunk + button head profiles to socket_screw"
```

---

### Task 2: Add countersunk + button data entries and render drawings

**Files:**

- Modify: `catalog/dimensions/socket_screws.json` (add `din7991`, `din7991i`, `iso10642`, `iso7380`)
- Modify: `catalog/tests/test_socket_screws_data.py` (add family-6 relationship tests)
- Generated (committed): `catalog/out/din7991.svg`, `catalog/out/iso7380.svg`, `catalog/out/manifest.json`

**Interfaces:**

- Consumes: `socket_screw(..., head=...)` from Task 1; `catalog.models._registry.build_part`; `catalog.schema.validate_entry`.
- Produces: two new manifest bases (`din7991`, `iso7380`) and two aliases resolving to `din7991`.

> **SOURCING GATE (controller-run before dispatch).** The shape values below are the plan's
> representative defaults. Before this task is implemented, the controller confirms every committed
> dimension against ≥2 named public tables and writes the confirmed values to
> `.superpowers/sdd/task-2-sourcing.md`, which SUPERSEDES the defaults here. The ISO 7380 button
> dimensions especially are re-confirmed (vendor tables vary; the brainstorm values are inferred).
> The data tests below are relationship-based (head/drive/alias), so they pass regardless of the
> exact sourced numbers. If the sourcing gate drops ISO 7380 to a max published size (as ISO 14580
> dropped to M10), that is honored and flagged, exactly like the family-5 DIN 605 precedent.

- [ ] **Step 1: Write the failing data tests**

Add to `catalog/tests/test_socket_screws_data.py` (append after the existing tests):

```python
# Family 6 (countersunk + button socket). din7991 countersunk hex-socket base (DIN 7991 / ISO
# 10642); iso7380 button hex-socket base. din7991i + iso10642 alias din7991 (same countersunk
# envelope). The heads are the drawn difference from the cylindrical cap bases.
_SOCKET_CSKBTN_ALIASES = {"din7991i": "din7991", "iso10642": "din7991"}


def test_din7991_is_a_countersunk_hex_socket_base():
    entries = json.loads(DATA.read_text())
    assert "din7991" in entries and "alias_of" not in entries["din7991"]   # real drawing
    assert entries["din7991"]["family"] == "socket_screw"
    assert entries["din7991"]["hardwareType"] == "screw"
    assert entries["din7991"]["shape"]["head"] == "countersunk"
    assert entries["din7991"]["shape"]["drive"] == "hex"
    build_part(entries["din7991"]["family"], entries["din7991"]["shape"])   # builds without raising


def test_iso7380_is_a_button_hex_socket_base():
    entries = json.loads(DATA.read_text())
    assert "iso7380" in entries and "alias_of" not in entries["iso7380"]
    assert entries["iso7380"]["family"] == "socket_screw"
    assert entries["iso7380"]["hardwareType"] == "screw"
    assert entries["iso7380"]["shape"]["head"] == "button"
    assert entries["iso7380"]["shape"]["drive"] == "hex"
    build_part(entries["iso7380"]["family"], entries["iso7380"]["shape"])


def test_countersunk_and_button_produce_different_drawings():
    # The two new heads must render as distinct solids (justifies two bases, not an alias).
    entries = json.loads(DATA.read_text())
    csk = build_part(entries["din7991"]["family"], entries["din7991"]["shape"])
    btn = build_part(entries["iso7380"]["family"], entries["iso7380"]["shape"])
    assert csk.volume != btn.volume


def test_cskbtn_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _SOCKET_CSKBTN_ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from socket_screws.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"
```

- [ ] **Step 2: Run the new data tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_socket_screws_data.py -q`
Expected: FAIL (KeyError / assertion — `din7991`, `iso7380` not yet in the data). Existing data tests still PASS.

- [ ] **Step 3: Add the four entries to `socket_screws.json`**

Add these keys to `catalog/dimensions/socket_screws.json` (use the sourced values from
`.superpowers/sdd/task-2-sourcing.md` if present — they govern; otherwise the representative
defaults shown here). The `source` strings must name ≥2 public tables and flag representative
fields; NO `reyher`/`stalmut` tokens.

```json
	"din7991": {
		"family": "socket_screw",
		"shape": {
			"dk": 24.0,
			"k": 6.5,
			"length": 60.0,
			"d_shank": 12.0,
			"drive": "hex",
			"socket_af": 8.0,
			"socket_depth": 3.5,
			"tip_chamfer": 1.0,
			"head": "countersunk"
		},
		"hardwareType": "screw",
		"source": "DIN 7991 / ISO 10642 hexagon socket countersunk (flat 90-degree conical) head cap screw, M12: flat-top countersunk head diameter dk=24.0 and head height k=6.5 and hex socket across-flats socket_af=8.0 confirmed by Fuller Fasteners DIN 7991 + Brighton-Best metric socket countersunk table + Intafast DIN 7991/ISO 10642 drawing (all M12 dk-max 24, k-max 6.5, key 8). d_shank=12.0 (M12 major); length=60.0 REPRESENTATIVE catalog length; socket_depth=3.5 REPRESENTATIVE blind engagement (< k); tip_chamfer=1.0 REPRESENTATIVE 45-degree lead. The head is drawn as a straight cone frustum from the shank to dk using the tabulated dk/k; the exact 90-degree cone angle is a REPRESENTATIVE envelope simplification. Envelope only — no drawn thread, no through bore.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "7991" }]
	},
	"din7991i": {
		"alias_of": "din7991",
		"hardwareType": "screw",
		"source": "DIN 7991 M12, app image-variant key — identical countersunk hex-socket envelope (dk=24, k=6.5, hex socket 8), aliases the din7991 base.",
		"verified": true,
		"designations": [{ "system": "DIN", "code": "7991" }]
	},
	"iso10642": {
		"alias_of": "din7991",
		"hardwareType": "screw",
		"source": "ISO 10642 hexagon socket countersunk head screw (reduced loadability), M12 — the ISO twin of DIN 7991 (same countersunk hex-socket envelope: dk=24, k=6.5, hex socket 8), confirmed by the DIN 7991 = ISO 10642 equivalence (Fuller Fasteners + Intafast DIN 7991/ISO 10642 tables). Aliases the din7991 base.",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "10642" }]
	},
	"iso7380": {
		"family": "socket_screw",
		"shape": {
			"dk": 24.0,
			"k": 6.5,
			"length": 60.0,
			"d_shank": 12.0,
			"drive": "hex",
			"socket_af": 6.0,
			"socket_depth": 3.5,
			"tip_chamfer": 1.0,
			"head": "button"
		},
		"hardwareType": "screw",
		"source": "ISO 7380-1 hexagon socket button (low spherical-dome) head screw, M12: domed head diameter dk=24.0 and head height k=6.5 and hex socket across-flats socket_af=6.0 confirmed by <NAME two public ISO 7380-1 tables in the sourcing gate> (representative values pending the Task 2 sourcing gate). d_shank=12.0 (M12 major); length=60.0 REPRESENTATIVE; socket_depth=3.5 REPRESENTATIVE blind engagement (< k); tip_chamfer=1.0 REPRESENTATIVE. The head is a spherical cap of base dk and height k; the small cylindrical base belt of a real button head is a REPRESENTATIVE envelope simplification (omitted). Envelope only — no drawn thread, no through bore.",
		"verified": true,
		"designations": [{ "system": "ISO", "code": "7380" }]
	}
```

> The `iso7380` source string contains a `<NAME ...>` placeholder ONLY because the button dimensions
> are pending the sourcing gate. The gate MUST replace it with two named public tables and the
> confirmed numbers before commit; a committed `<NAME ...>` placeholder is a task failure.

- [ ] **Step 4: Run the data tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_socket_screws_data.py -q`
Expected: PASS.

- [ ] **Step 5: Rebuild the catalog and confirm coverage + additivity**

Run:

```bash
./catalog/run python -m catalog.build_catalog
pnpm exec prettier --write catalog/out/manifest.json
./catalog/run python -c "from catalog.qa.coverage import check; m=check('catalog/out/manifest.json','data/image-mappings.json','screw'); print('remaining screw gap:', len(m)); assert 'din7991' not in m and 'din7991i' not in m and 'iso10642' not in m and 'iso7380' not in m"
git status --short catalog/out/
```

Expected: `remaining screw gap: 42`; only `din7991.svg` and `iso7380.svg` are new under `catalog/out/`; every pre-existing SVG unchanged (`git diff --stat catalog/out/` shows only the two new files + manifest). If any pre-existing SVG changed, STOP.

- [ ] **Step 6: Run the full catalog suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/socket_screws.json catalog/tests/test_socket_screws_data.py catalog/out/din7991.svg catalog/out/iso7380.svg catalog/out/manifest.json
git commit -m "feat(catalog): add DIN 7991 countersunk + ISO 7380 button socket screws (gap 46->42)"
```

---

## Notes for the executor

- This plan has NO registry change: `socket_screw` is already in `_registry.py` (added in family 3).
- The two tasks are ordered: Task 1 (generator) must land before Task 2 (data), because the data entries pass `head=` which Task 1 introduces.
- After both tasks: whole-branch review, then zen (`deepseek/deepseek-v4-pro`, thinking=high) as the mandated shared-surface gate (this edits the shared `socket_screw` generator), then visual check, then push / PR / CI / squash-merge.
