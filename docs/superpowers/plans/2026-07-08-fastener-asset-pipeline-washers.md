# Generative Fastener Asset Pipeline — Phase 0 + Washers Pilot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the maintainer-only Python pipeline that turns a fastener dimension table into a committed 2D SVG technical drawing (front + side, HLR-projected from a 3D build123d model), and prove it end-to-end by generating, QA-ing, and integrating the washer category.

**Architecture:** A new maintainer-only `catalog/` tree, run inside a pinned Linux Docker image (build123d/OCP does not install reliably on macOS arm64). Data (`dimensions/*.json`) → per-family build123d generators → `render.py` (two-view HLR SVG) → `build_catalog.py` orchestrator → committed `.svg` + `manifest.json`. A QA layer (coverage gate + contact sheet) proves correctness. The SvelteKit app and `pnpm build` never run Python; they consume the committed SVGs through the existing `image-mappings.json` + `resolveImageWithSvgPriority` path.

**Tech Stack:** Python 3.12, build123d (OpenCascade/OCP), pytest, Docker (Linux), existing SvelteKit/Vite frontend (unchanged).

## Global Constraints

- Package manager for JS: **pnpm** (never npm/yarn). Python deps via pip inside the container.
- Commits: **Conventional Commits** (`type(scope): description`), enforced by commitlint. Never mention AI assistance.
- **Maintainer-only:** the app and `pnpm build` must never invoke Python/build123d. Generated assets are committed files.
- **Generation runs in the pinned Linux container**, not on the host Mac. All `python`/`pytest` commands below run via `catalog/run` (defined in Task 1).
- **Determinism:** pin build123d + OCP + Python versions in `catalog/requirements.txt`; record resolved versions in `manifest.json`; fix `ExportSVG(precision=4)`.
- **One drawing per standard**, size-independent, holding **front + side** HLR views side by side. Monochrome. Visible = solid ~0.4mm, Hidden = dashed grey.
- **Dimension data:** store only factual numeric values plus a `source` citation (standard number + year). A `verified` boolean is set only after a human cross-checks the numbers.
- Pilot scope is the **flat-washer and spring-washer families**; tooth-lock (DIN 6797/6798) and conical (DIN 6796) families are explicitly deferred to the next plan (they reuse this machinery).

---

### Task 1: Pinned Linux container + build123d smoke test

**Files:**

- Create: `catalog/Dockerfile`
- Create: `catalog/requirements.txt`
- Create: `catalog/run` (executable shell wrapper)
- Create: `catalog/tests/test_env_smoke.py`
- Create: `catalog/.dockerignore`

**Interfaces:**

- Produces: the `catalog/run <cmd...>` wrapper that runs any command inside the built image with the repo mounted at `/work`; used by every later task to run `pytest` and the pipeline.

- [ ] **Step 1: Write the failing test**

`catalog/tests/test_env_smoke.py`:

```python
"""Proves the container has a working build123d + OCP + SVG export toolchain."""
import xml.etree.ElementTree as ET
from pathlib import Path


def test_project_to_viewport_exports_svg_with_two_layers(tmp_path: Path):
    from build123d import BuildPart, Box, ExportSVG, Unit, LineType

    with BuildPart() as bp:
        Box(40, 30, 10)
    part = bp.part

    visible, hidden = part.project_to_viewport(
        viewport_origin=(0, -100, 0), viewport_up=(0, 0, 1), look_at=(0, 0, 0)
    )
    assert len(visible) > 0

    exporter = ExportSVG(unit=Unit.MM, precision=4)
    exporter.add_layer("Visible", line_weight=0.4, line_type=LineType.CONTINUOUS)
    exporter.add_layer("Hidden", line_weight=0.3, line_type=LineType.ISO_DASH)
    exporter.add_shape(visible, layer="Visible")
    exporter.add_shape(hidden, layer="Hidden")
    out = tmp_path / "smoke.svg"
    exporter.write(str(out))

    assert out.exists()
    root = ET.parse(out).getroot()
    # SVG groups carry the layer names; at least the visible layer must be present.
    text = out.read_text()
    assert "Visible" in text
    assert root.tag.endswith("svg")
```

- [ ] **Step 2: Create the container files**

`catalog/requirements.txt` (first pass — exact pins are frozen in Step 4):

```
build123d
pytest
```

`catalog/Dockerfile`:

```dockerfile
FROM python:3.12-slim

# OCP wheels need a few shared libs at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglu1-mesa libxrender1 libxext6 libsm6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY catalog/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

CMD ["python", "-c", "import build123d; print(build123d.__version__)"]
```

`catalog/.dockerignore`:

```
node_modules
.svelte-kit
build
static/images/standards/*.png
```

`catalog/run` (chmod +x):

```bash
#!/usr/bin/env bash
# Runs a command inside the catalog image with the repo mounted at /work.
set -euo pipefail
IMAGE="gridscribe-catalog:latest"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build -t "$IMAGE" -f "$REPO_ROOT/catalog/Dockerfile" "$REPO_ROOT"
fi
exec docker run --rm -v "$REPO_ROOT":/work -w /work "$IMAGE" "$@"
```

- [ ] **Step 3: Build image and run the test to verify it passes**

Run: `chmod +x catalog/run && ./catalog/run pytest catalog/tests/test_env_smoke.py -v`
Expected: image builds, test PASSES (SVG written with a Visible layer).

- [ ] **Step 4: Freeze exact versions for determinism**

Run: `./catalog/run python -m pip freeze | grep -Ei 'build123d|cadquery-ocp|ocp|numpy' > catalog/requirements.lock`
Then edit `catalog/requirements.txt` to pin `build123d==<version from lock>` (copy the exact resolved version). Rebuild once: `docker build -t gridscribe-catalog:latest -f catalog/Dockerfile .`

- [ ] **Step 5: Commit**

```bash
git add catalog/Dockerfile catalog/requirements.txt catalog/requirements.lock catalog/run catalog/.dockerignore catalog/tests/test_env_smoke.py
git commit -m "build(catalog): pinned linux container with build123d + smoke test"
```

---

### Task 2: Two-view render helper (`render.py`)

**Files:**

- Create: `catalog/render.py`
- Create: `catalog/tests/test_render.py`

**Interfaces:**

- Consumes: a build123d `Part` and a `CameraPreset`.
- Produces:
  - `class CameraPreset` with fields `front_origin: tuple`, `front_up: tuple`, `side_origin: tuple`, `side_up: tuple`.
  - `DEFAULT_AXIS_Z = CameraPreset(...)` — face-on front + profile side for a part whose axis is Z.
  - `render_two_views(part, preset: CameraPreset, out_path: str, gap_mm: float = 4.0) -> None` — writes an SVG with front and side views side by side, Visible/Hidden layers.

- [ ] **Step 1: Write the failing test**

`catalog/tests/test_render.py`:

```python
from pathlib import Path


def test_render_two_views_writes_svg_with_both_layers(tmp_path: Path):
    from build123d import BuildPart, Cylinder, Mode
    from catalog.render import render_two_views, DEFAULT_AXIS_Z

    with BuildPart() as bp:
        Cylinder(radius=10, height=4)
        Cylinder(radius=4, height=4, mode=Mode.SUBTRACT)  # through hole
    part = bp.part

    out = tmp_path / "ring.svg"
    render_two_views(part, DEFAULT_AXIS_Z, str(out))

    text = out.read_text()
    assert out.exists()
    assert "Visible" in text and "Hidden" in text
    # Two views => the drawing is wider than a single view of a 20mm-diameter ring.
    # Parse viewBox width and assert it exceeds one diameter.
    import re
    vb = re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+"', text)
    assert vb is not None and float(vb.group(1)) > 20.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_render.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'catalog.render'` (or import error).

- [ ] **Step 3: Implement `render.py`**

`catalog/render.py`:

```python
"""Project a 3D Part to a two-view (front + side) monochrome SVG technical drawing."""
from dataclasses import dataclass

from build123d import ExportSVG, Unit, LineType, Location

VISIBLE_WEIGHT_MM = 0.4
HIDDEN_WEIGHT_MM = 0.3
HIDDEN_COLOR = (110, 110, 110)


@dataclass(frozen=True)
class CameraPreset:
    front_origin: tuple
    front_up: tuple
    side_origin: tuple
    side_up: tuple


# For a part whose main axis is Z:
#   front = look down the axis (face view: hex/ring outline + bore),
#   side  = look along -Y (profile view: thickness + hidden bore).
DEFAULT_AXIS_Z = CameraPreset(
    front_origin=(0, 0, 1000),
    front_up=(0, 1, 0),
    side_origin=(0, -1000, 0),
    side_up=(0, 0, 1),
)


def _edges_bbox(edges):
    """Combined (xmin, ymin, xmax, ymax) of projected 2D edges."""
    xs_min = ys_min = float("inf")
    xs_max = ys_max = float("-inf")
    for e in edges:
        bb = e.bounding_box()
        xs_min, ys_min = min(xs_min, bb.min.X), min(ys_min, bb.min.Y)
        xs_max, ys_max = max(xs_max, bb.max.X), max(ys_max, bb.max.Y)
    return xs_min, ys_min, xs_max, ys_max


def render_two_views(part, preset: CameraPreset, out_path: str, gap_mm: float = 4.0) -> None:
    v_front, h_front = part.project_to_viewport(
        viewport_origin=preset.front_origin, viewport_up=preset.front_up
    )
    v_side, h_side = part.project_to_viewport(
        viewport_origin=preset.side_origin, viewport_up=preset.side_up
    )

    fx_min, _, fx_max, _ = _edges_bbox(v_front + h_front)
    sx_min, _, sx_max, _ = _edges_bbox(v_side + h_side)
    # Place the side view to the right of the front view with a fixed gap.
    dx = (fx_max + gap_mm) - sx_min
    move = Location((dx, 0, 0))
    v_side = [e * move for e in v_side]
    h_side = [e * move for e in h_side]

    exporter = ExportSVG(unit=Unit.MM, precision=4, margin=2.0)
    exporter.add_layer("Visible", line_weight=VISIBLE_WEIGHT_MM, line_type=LineType.CONTINUOUS)
    exporter.add_layer(
        "Hidden", line_color=HIDDEN_COLOR, line_weight=HIDDEN_WEIGHT_MM, line_type=LineType.ISO_DASH
    )
    exporter.add_shape(v_front + v_side, layer="Visible")
    exporter.add_shape(h_front + h_side, layer="Hidden")
    exporter.write(out_path)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_render.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add catalog/render.py catalog/tests/test_render.py
git commit -m "feat(catalog): two-view HLR SVG render helper"
```

---

### Task 3: Phase 0 spike — hex-nut + flat-washer models, visual review vs current PNG

**Files:**

- Create: `catalog/models/__init__.py` (empty)
- Create: `catalog/models/washer.py`
- Create: `catalog/models/hex_nut.py`
- Create: `catalog/tests/test_spike_models.py`
- Create: `catalog/spike/render_spike.py`

**Interfaces:**

- Produces:
  - `catalog.models.washer.flat_washer(d_inner: float, d_outer: float, thickness: float) -> Part`
  - `catalog.models.hex_nut.hex_nut(s: float, m: float, bore: float) -> Part` (`s` = width across flats, `m` = height, `bore` = through-hole diameter)

- [ ] **Step 1: Write the failing test (shape invariants)**

`catalog/tests/test_spike_models.py`:

```python
def test_flat_washer_is_a_ring_with_correct_extents():
    from catalog.models.washer import flat_washer

    part = flat_washer(d_inner=13.0, d_outer=24.0, thickness=2.5)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == 24.0  # outer diameter
    assert round(bb.size.Z, 1) == 2.5   # thickness
    assert part.volume > 0
    # Ring: volume less than a solid disc of the same outer size.
    import math
    solid = math.pi * (24.0 / 2) ** 2 * 2.5
    assert part.volume < solid


def test_hex_nut_has_six_side_faces_and_a_bore():
    from catalog.models.hex_nut import hex_nut

    part = hex_nut(s=34.0, m=8.5, bore=20.96)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == 8.5
    # Across-flats 34 => across-corners ~39.26; X extent is the corner-to-corner span.
    assert 38.0 < bb.size.X < 40.5
    assert part.volume > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_spike_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'catalog.models.washer'`.

- [ ] **Step 3: Implement the two generators**

`catalog/models/washer.py`:

```python
"""Washer family generators."""
from build123d import BuildPart, Cylinder, Mode


def flat_washer(d_inner: float, d_outer: float, thickness: float):
    """Plain flat washer: an annular disc (DIN 125/126/433/440/9021 & ISO equivalents)."""
    with BuildPart() as bp:
        Cylinder(radius=d_outer / 2, height=thickness)
        Cylinder(radius=d_inner / 2, height=thickness, mode=Mode.SUBTRACT)
    return bp.part
```

`catalog/models/hex_nut.py`:

```python
"""Hex nut family generator (used by the Phase 0 spike; reused in the nuts phase)."""
import math

from build123d import BuildPart, BuildSketch, RegularPolygon, Cylinder, extrude, Mode


def hex_nut(s: float, m: float, bore: float):
    """Hexagon nut: across-flats `s`, height `m`, central bore diameter `bore`.

    RegularPolygon radius is the circumradius; across-flats s => circumradius s/sqrt(3).
    """
    circumradius = s / math.sqrt(3.0)
    with BuildPart() as bp:
        with BuildSketch():
            RegularPolygon(radius=circumradius, side_count=6)
        extrude(amount=m)
        Cylinder(radius=bore / 2, height=m * 3, mode=Mode.SUBTRACT)
    return bp.part
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_spike_models.py -v`
Expected: PASS.

- [ ] **Step 5: Render the spike drawings**

`catalog/spike/render_spike.py`:

```python
"""Phase 0 spike: render DIN 431 (pipe nut) and DIN 125 (flat washer) to SVG."""
from pathlib import Path

from catalog.models.hex_nut import hex_nut
from catalog.models.washer import flat_washer
from catalog.render import render_two_views, DEFAULT_AXIS_Z

OUT = Path("catalog/spike/out")
OUT.mkdir(parents=True, exist_ok=True)

render_two_views(hex_nut(s=34.0, m=8.5, bore=20.96), DEFAULT_AXIS_Z, str(OUT / "din431.svg"))
render_two_views(flat_washer(13.0, 24.0, 2.5), DEFAULT_AXIS_Z, str(OUT / "din125.svg"))
print("wrote", list(OUT.glob("*.svg")))
```

Run: `./catalog/run python catalog/spike/render_spike.py`
Expected: writes `catalog/spike/out/din431.svg` and `din125.svg`.

- [ ] **Step 6: Human visual review checkpoint**

Open `catalog/spike/out/din431.svg` and `din125.svg` next to `static/images/standards/din_431.png` and `din_125.png`. Confirm: front shows the hex/ring face with bore, side shows thickness with dashed hidden bore, line weights read cleanly at ~10mm. **Do not proceed to Task 4 until the drawings are judged acceptable.** If the side view is wrong-handed, adjust `DEFAULT_AXIS_Z` origins in `render.py` and re-render.

- [ ] **Step 7: Commit**

```bash
git add catalog/models catalog/spike catalog/tests/test_spike_models.py
git commit -m "feat(catalog): phase 0 spike — hex nut + flat washer models rendered to svg"
```

---

### Task 4: Dimension schema + validator

**Files:**

- Create: `catalog/dimensions/_schema.json`
- Create: `catalog/schema.py`
- Create: `catalog/tests/test_schema.py`

**Interfaces:**

- Produces: `catalog.schema.validate_entry(standard_id: str, entry: dict) -> list[str]` — returns a list of human-readable problems; empty list means valid.

- [ ] **Step 1: Write the failing test**

`catalog/tests/test_schema.py`:

```python
from catalog.schema import validate_entry


def test_valid_flat_washer_entry_passes():
    entry = {
        "family": "flat_washer",
        "shape": {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5},
        "hardwareType": "washer",
        "source": "DIN 125-1:2011",
        "verified": False,
        "designations": [{"system": "DIN", "code": "125"}],
    }
    assert validate_entry("din125", entry) == []


def test_missing_source_is_reported():
    entry = {
        "family": "flat_washer",
        "shape": {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5},
        "hardwareType": "washer",
        "designations": [{"system": "DIN", "code": "125"}],
    }
    problems = validate_entry("din125", entry)
    assert any("source" in p for p in problems)


def test_unknown_family_is_reported():
    entry = {
        "family": "warp_drive",
        "shape": {},
        "hardwareType": "washer",
        "source": "x",
        "designations": [{"system": "DIN", "code": "1"}],
    }
    problems = validate_entry("din1", entry)
    assert any("family" in p for p in problems)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_schema.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'catalog.schema'`).

- [ ] **Step 3: Implement schema + validator**

`catalog/dimensions/_schema.json`:

```json
{
	"$schema": "http://json-schema.org/draft-07/schema#",
	"type": "object",
	"required": ["family", "shape", "hardwareType", "source", "designations"],
	"properties": {
		"family": { "type": "string" },
		"shape": { "type": "object" },
		"hardwareType": {
			"enum": ["washer", "nut", "screw", "pin", "self_tapping", "ring"]
		},
		"source": { "type": "string", "minLength": 3 },
		"verified": { "type": "boolean" },
		"designations": {
			"type": "array",
			"minItems": 1,
			"items": {
				"type": "object",
				"required": ["system", "code"],
				"properties": {
					"system": { "type": "string" },
					"code": { "type": "string" }
				}
			}
		}
	}
}
```

`catalog/schema.py`:

```python
"""Validate a dimension entry against the JSON Schema and the known family registry."""
import json
from pathlib import Path

from jsonschema import Draft7Validator

from catalog.models._registry import KNOWN_FAMILIES

_SCHEMA = json.loads((Path(__file__).parent / "dimensions" / "_schema.json").read_text())
_VALIDATOR = Draft7Validator(_SCHEMA)


def validate_entry(standard_id: str, entry: dict) -> list[str]:
    problems = [f"{standard_id}: {e.message}" for e in _VALIDATOR.iter_errors(entry)]
    fam = entry.get("family")
    if fam is not None and fam not in KNOWN_FAMILIES:
        problems.append(f"{standard_id}: unknown family '{fam}'")
    return problems
```

Add `jsonschema` to `catalog/requirements.txt` and rebuild the image:

```
build123d==<pinned>
jsonschema
pytest
```

Run: `docker build -t gridscribe-catalog:latest -f catalog/Dockerfile .`

- [ ] **Step 4: Run test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_schema.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add catalog/dimensions/_schema.json catalog/schema.py catalog/tests/test_schema.py catalog/requirements.txt
git commit -m "feat(catalog): dimension entry schema + validator"
```

---

### Task 5: Family registry + spring-washer generator with invariants

**Files:**

- Create: `catalog/models/_registry.py`
- Modify: `catalog/models/washer.py` (add `spring_washer`)
- Create: `catalog/tests/test_families.py`

**Interfaces:**

- Consumes: `flat_washer` (Task 3).
- Produces:
  - `catalog.models.washer.spring_washer(d_inner: float, d_outer: float, section: float, gap: float) -> Part` — square-section split lock washer (DIN 127/128/137); `section` = radial/axial thickness, `gap` = split width.
  - `catalog.models._registry.KNOWN_FAMILIES: dict[str, callable]` mapping family name → generator function.
  - `catalog.models._registry.build_part(family: str, shape: dict) -> Part` — dispatch by family name.

- [ ] **Step 1: Write the failing test**

`catalog/tests/test_families.py`:

```python
def test_registry_dispatches_flat_washer():
    from catalog.models._registry import build_part

    part = build_part("flat_washer", {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5})
    assert round(part.bounding_box().size.X, 1) == 24.0


def test_spring_washer_has_a_split_reducing_volume_vs_full_ring():
    from catalog.models.washer import spring_washer, flat_washer

    ring = flat_washer(d_inner=10.2, d_outer=18.1, thickness=3.5)  # comparable full ring
    split = spring_washer(d_inner=10.2, d_outer=18.1, section=3.5, gap=2.0)
    assert split.volume < ring.volume  # the split removes material
    assert round(split.bounding_box().size.Z, 1) == 3.5


def test_invariant_inner_less_than_outer_enforced_by_generator():
    from catalog.models.washer import flat_washer
    import pytest

    with pytest.raises(ValueError):
        flat_washer(d_inner=24.0, d_outer=13.0, thickness=2.5)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_families.py -v`
Expected: FAIL (`ModuleNotFoundError: 'catalog.models._registry'` and no `spring_washer`).

- [ ] **Step 3: Add the invariant guard + spring washer, and the registry**

Edit `catalog/models/washer.py` — add a guard to `flat_washer` and add `spring_washer`:

```python
def flat_washer(d_inner: float, d_outer: float, thickness: float):
    if not (0 < d_inner < d_outer):
        raise ValueError(f"flat_washer: need 0 < d_inner < d_outer, got {d_inner}, {d_outer}")
    with BuildPart() as bp:
        Cylinder(radius=d_outer / 2, height=thickness)
        Cylinder(radius=d_inner / 2, height=thickness, mode=Mode.SUBTRACT)
    return bp.part


def spring_washer(d_inner: float, d_outer: float, section: float, gap: float):
    """Split spring lock washer (DIN 127/128/137): square-section ring with a split gap."""
    if not (0 < d_inner < d_outer):
        raise ValueError(f"spring_washer: need 0 < d_inner < d_outer, got {d_inner}, {d_outer}")
    from build123d import Box, Align
    with BuildPart() as bp:
        Cylinder(radius=d_outer / 2, height=section)
        Cylinder(radius=d_inner / 2, height=section, mode=Mode.SUBTRACT)
        # Cut a radial slot (the split) from centre out past the outer edge.
        Box(
            d_outer, gap, section * 2,
            align=(Align.MIN, Align.CENTER, Align.CENTER),
            mode=Mode.SUBTRACT,
        )
    return bp.part
```

`catalog/models/_registry.py`:

```python
"""Map family names to generator callables and dispatch."""
from catalog.models.washer import flat_washer, spring_washer
from catalog.models.hex_nut import hex_nut

KNOWN_FAMILIES = {
    "flat_washer": flat_washer,
    "spring_washer": spring_washer,
    "hex_nut": hex_nut,
}


def build_part(family: str, shape: dict):
    if family not in KNOWN_FAMILIES:
        raise ValueError(f"unknown family '{family}'")
    return KNOWN_FAMILIES[family](**shape)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_families.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add catalog/models/_registry.py catalog/models/washer.py catalog/tests/test_families.py
git commit -m "feat(catalog): family registry + spring washer with shape invariants"
```

---

### Task 6: Washer dimension data + resolution test

**Files:**

- Create: `catalog/dimensions/washers.json`
- Create: `catalog/tests/test_washers_data.py`

**Interfaces:**

- Consumes: `validate_entry` (Task 4), `build_part` (Task 5).
- Produces: `catalog/dimensions/washers.json` — an object mapping standard id → dimension entry, for the flat- and spring-washer families.

- [ ] **Step 1: Write the failing test**

`catalog/tests/test_washers_data.py`:

```python
import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/washers.json")


def test_every_washer_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 6  # pilot: at least the seed set below
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        # It must actually build a part without raising.
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_all_entries_have_a_source_citation():
    entries = json.loads(DATA.read_text())
    assert all(len(e["source"]) >= 3 for e in entries.values())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_washers_data.py -v`
Expected: FAIL (file missing).

- [ ] **Step 3: Create the seed data (M12 representative sizes, cited)**

`catalog/dimensions/washers.json` — seed the pilot with cited M12 dimensions (extend to the full washer set in Step 5):

```json
{
	"din125": {
		"family": "flat_washer",
		"shape": { "d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5 },
		"hardwareType": "washer",
		"source": "DIN 125-1:2011 (M12)",
		"verified": false,
		"designations": [{ "system": "DIN", "code": "125" }]
	},
	"din126": {
		"family": "flat_washer",
		"shape": { "d_inner": 13.5, "d_outer": 24.0, "thickness": 2.5 },
		"hardwareType": "washer",
		"source": "DIN 126:2020 (M12, coarse)",
		"verified": false,
		"designations": [{ "system": "DIN", "code": "126" }]
	},
	"din433": {
		"family": "flat_washer",
		"shape": { "d_inner": 13.0, "d_outer": 20.0, "thickness": 2.5 },
		"hardwareType": "washer",
		"source": "DIN 433-1:2020 (M12, small OD)",
		"verified": false,
		"designations": [{ "system": "DIN", "code": "433" }]
	},
	"din9021": {
		"family": "flat_washer",
		"shape": { "d_inner": 13.0, "d_outer": 37.0, "thickness": 3.0 },
		"hardwareType": "washer",
		"source": "DIN 9021:1990 (M12, large OD)",
		"verified": false,
		"designations": [{ "system": "DIN", "code": "9021" }]
	},
	"din127": {
		"family": "spring_washer",
		"shape": { "d_inner": 12.2, "d_outer": 20.2, "section": 3.5, "gap": 2.5 },
		"hardwareType": "washer",
		"source": "DIN 127-B:1997 (M12)",
		"verified": false,
		"designations": [{ "system": "DIN", "code": "127" }]
	},
	"din128": {
		"family": "spring_washer",
		"shape": { "d_inner": 12.2, "d_outer": 21.0, "section": 3.5, "gap": 2.5 },
		"hardwareType": "washer",
		"source": "DIN 128-A:2011 (M12, curved)",
		"verified": false,
		"designations": [{ "system": "DIN", "code": "128" }]
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_washers_data.py -v`
Expected: PASS.

- [ ] **Step 5: Extend to the full flat/spring washer set**

For each remaining flat/spring washer standard the app currently serves (cross-check ids against `data/image-mappings.json` where `hardwareType == "washer"`), add an entry using the same structure, with the representative M12 (or nearest common) dimensions and a `source` citation from the standard. Re-run Step 4 after each few additions; the test both validates and builds every entry, so a bad number fails fast. Commit in small batches.

- [ ] **Step 6: Commit**

```bash
git add catalog/dimensions/washers.json catalog/tests/test_washers_data.py
git commit -m "feat(catalog): washer dimension data (flat + spring, cited sources)"
```

---

### Task 7: Catalog orchestrator (`build_catalog.py`) with per-standard report + manifest

**Files:**

- Create: `catalog/build_catalog.py`
- Create: `catalog/tests/test_build_catalog.py`

**Interfaces:**

- Consumes: `validate_entry`, `build_part`, `render_two_views`, `DEFAULT_AXIS_Z`.
- Produces:
  - `catalog.build_catalog.build(dimensions_dir: str, out_dir: str, manifest_path: str) -> dict` — returns `{"ok": [...], "skipped": [...], "failed": [...]}`; writes one `<id>.svg` per standard to `out_dir` and a `manifest.json`.
  - Manifest shape: `{ "toolchain": {...}, "standards": { "<id>": { "svg": "<id>.svg", "sha256": "...", "source": "...", "family": "..." } } }`.

- [ ] **Step 1: Write the failing test**

`catalog/tests/test_build_catalog.py`:

```python
import json
from pathlib import Path


def test_build_generates_svg_and_manifest_for_valid_entries(tmp_path: Path):
    from catalog.build_catalog import build

    dims = tmp_path / "dimensions"
    dims.mkdir()
    (dims / "washers.json").write_text(json.dumps({
        "din125": {
            "family": "flat_washer",
            "shape": {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5},
            "hardwareType": "washer",
            "source": "DIN 125-1:2011 (M12)",
            "verified": False,
            "designations": [{"system": "DIN", "code": "125"}],
        }
    }))
    out = tmp_path / "out"
    manifest = tmp_path / "manifest.json"

    report = build(str(dims), str(out), str(manifest))

    assert report["ok"] == ["din125"]
    assert (out / "din125.svg").exists()
    m = json.loads(manifest.read_text())
    assert m["standards"]["din125"]["svg"] == "din125.svg"
    assert len(m["standards"]["din125"]["sha256"]) == 64
    assert "build123d" in m["toolchain"]


def test_build_reports_failed_entry_without_aborting(tmp_path: Path):
    from catalog.build_catalog import build

    dims = tmp_path / "dimensions"
    dims.mkdir()
    (dims / "washers.json").write_text(json.dumps({
        "bad1": {
            "family": "flat_washer",
            "shape": {"d_inner": 30.0, "d_outer": 10.0, "thickness": 2.0},
            "hardwareType": "washer",
            "source": "x",
            "designations": [{"system": "DIN", "code": "1"}],
        },
        "din125": {
            "family": "flat_washer",
            "shape": {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5},
            "hardwareType": "washer",
            "source": "DIN 125-1:2011",
            "designations": [{"system": "DIN", "code": "125"}],
        },
    }))
    report = build(str(dims), str(tmp_path / "out"), str(tmp_path / "manifest.json"))
    assert "din125" in report["ok"]
    assert any(f["id"] == "bad1" for f in report["failed"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_build_catalog.py -v`
Expected: FAIL (`ModuleNotFoundError: 'catalog.build_catalog'`).

- [ ] **Step 3: Implement the orchestrator**

`catalog/build_catalog.py`:

```python
"""Iterate dimension entries -> validate -> model -> render SVG -> manifest."""
import hashlib
import json
from importlib.metadata import version, PackageNotFoundError
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part
from catalog.render import render_two_views, DEFAULT_AXIS_Z


def _toolchain() -> dict:
    out = {}
    for pkg in ("build123d", "cadquery-ocp", "jsonschema"):
        try:
            out[pkg] = version(pkg)
        except PackageNotFoundError:
            out[pkg] = "unknown"
    return out


def _load_dimensions(dimensions_dir: str) -> dict:
    entries = {}
    for path in sorted(Path(dimensions_dir).glob("*.json")):
        if path.name.startswith("_"):
            continue
        entries.update(json.loads(path.read_text()))
    return entries


def build(dimensions_dir: str, out_dir: str, manifest_path: str) -> dict:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    entries = _load_dimensions(dimensions_dir)

    report = {"ok": [], "skipped": [], "failed": []}
    manifest = {"toolchain": _toolchain(), "standards": {}}

    for sid, entry in entries.items():
        problems = validate_entry(sid, entry)
        if problems:
            report["failed"].append({"id": sid, "reason": "; ".join(problems)})
            continue
        try:
            part = build_part(entry["family"], entry["shape"])
            svg_path = out / f"{sid}.svg"
            render_two_views(part, DEFAULT_AXIS_Z, str(svg_path))
            sha = hashlib.sha256(svg_path.read_bytes()).hexdigest()
            manifest["standards"][sid] = {
                "svg": f"{sid}.svg",
                "sha256": sha,
                "source": entry["source"],
                "family": entry["family"],
            }
            report["ok"].append(sid)
        except Exception as exc:  # per-standard failure must not abort the batch
            report["failed"].append({"id": sid, "reason": repr(exc)})

    Path(manifest_path).write_text(json.dumps(manifest, indent=2, sort_keys=True))
    return report


if __name__ == "__main__":
    r = build("catalog/dimensions", "catalog/out", "catalog/out/manifest.json")
    print(json.dumps({k: (v if k != "ok" else len(v)) for k, v in r.items()}, indent=2))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_build_catalog.py -v`
Expected: PASS.

- [ ] **Step 5: Generate the real washer catalog**

Run: `./catalog/run python catalog/build_catalog.py`
Expected: prints `ok`, `skipped: []`, `failed: []`; writes `catalog/out/*.svg` + `catalog/out/manifest.json`.

- [ ] **Step 6: Commit**

```bash
git add catalog/build_catalog.py catalog/tests/test_build_catalog.py catalog/out
git commit -m "feat(catalog): orchestrator with per-standard report + manifest"
```

---

### Task 8: Coverage gate

**Files:**

- Create: `catalog/qa/__init__.py` (empty)
- Create: `catalog/qa/coverage.py`
- Create: `catalog/tests/test_coverage.py`

**Interfaces:**

- Consumes: `manifest.json` (Task 7), `data/image-mappings.json` (existing).
- Produces: `catalog.qa.coverage.check(manifest_path: str, image_mappings_path: str, hardware_type: str) -> list[str]` — returns ids of standards of the given `hardware_type` that the app serves but the manifest did not generate. Empty list = full coverage.

- [ ] **Step 1: Write the failing test**

`catalog/tests/test_coverage.py`:

```python
import json
from pathlib import Path


def test_coverage_reports_missing_standard(tmp_path: Path):
    from catalog.qa.coverage import check

    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"standards": {"din125": {"svg": "din125.svg"}}}))
    mappings = tmp_path / "image-mappings.json"
    mappings.write_text(json.dumps({
        "din125": {"image": "/images/standards/din_125.png", "hardwareType": "washer"},
        "din127": {"image": "/images/standards/din_127.png", "hardwareType": "washer"},
        "din933": {"image": "/images/standards/din_933.png", "hardwareType": "screw"},
    }))

    missing = check(str(manifest), str(mappings), "washer")
    assert missing == ["din127"]  # din933 ignored (screw); din125 present
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_coverage.py -v`
Expected: FAIL (`ModuleNotFoundError: 'catalog.qa.coverage'`).

- [ ] **Step 3: Implement the gate**

`catalog/qa/coverage.py`:

```python
"""Coverage gate: every app-served standard of a hardware type must be generated."""
import json
from pathlib import Path


def check(manifest_path: str, image_mappings_path: str, hardware_type: str) -> list[str]:
    generated = set(json.loads(Path(manifest_path).read_text())["standards"])
    mappings = json.loads(Path(image_mappings_path).read_text())
    expected = {
        sid for sid, m in mappings.items() if m.get("hardwareType") == hardware_type
    }
    return sorted(expected - generated)


if __name__ == "__main__":
    import sys

    missing = check("catalog/out/manifest.json", "data/image-mappings.json", "washer")
    if missing:
        print("COVERAGE GAP (washer):", ", ".join(missing))
        sys.exit(1)
    print("washer coverage: complete")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_coverage.py -v`
Expected: PASS.

- [ ] **Step 5: Run the gate against the real catalog**

Run: `./catalog/run python catalog/qa/coverage.py`
Expected: either `washer coverage: complete`, or a listed gap. If a gap is listed, add the missing standards to `catalog/dimensions/washers.json` (Task 6, Step 5) and regenerate (Task 7, Step 5) until complete.

- [ ] **Step 6: Commit**

```bash
git add catalog/qa/__init__.py catalog/qa/coverage.py catalog/tests/test_coverage.py
git commit -m "feat(catalog): washer coverage gate"
```

---

### Task 9: Contact sheet (old PNG vs new SVG)

**Files:**

- Create: `catalog/qa/contact_sheet.py`
- Create: `catalog/tests/test_contact_sheet.py`

**Interfaces:**

- Consumes: `manifest.json`, `data/image-mappings.json`, the generated SVGs in `catalog/out`, the existing PNGs in `static/images/standards`.
- Produces: `catalog.qa.contact_sheet.render(manifest_path, image_mappings_path, out_dir, png_dir, html_path) -> str` — writes an HTML page pairing each generated SVG with its current PNG + source citation; returns the html path.

- [ ] **Step 1: Write the failing test**

`catalog/tests/test_contact_sheet.py`:

```python
import json
from pathlib import Path


def test_contact_sheet_pairs_svg_and_png(tmp_path: Path):
    from catalog.qa.contact_sheet import render

    (tmp_path / "out").mkdir()
    (tmp_path / "out" / "din125.svg").write_text("<svg/>")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"standards": {
        "din125": {"svg": "din125.svg", "source": "DIN 125-1:2011"}
    }}))
    mappings = tmp_path / "image-mappings.json"
    mappings.write_text(json.dumps({
        "din125": {"image": "/images/standards/din_125.png", "hardwareType": "washer"}
    }))
    html = tmp_path / "contact.html"

    render(str(manifest), str(mappings), str(tmp_path / "out"),
           "static/images/standards", str(html))

    text = html.read_text()
    assert "din125" in text
    assert "din125.svg" in text
    assert "din_125.png" in text
    assert "DIN 125-1:2011" in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_contact_sheet.py -v`
Expected: FAIL (`ModuleNotFoundError: 'catalog.qa.contact_sheet'`).

- [ ] **Step 3: Implement the contact sheet**

`catalog/qa/contact_sheet.py`:

```python
"""Generate an HTML review page pairing each new SVG with the current PNG + source."""
import json
from pathlib import Path

_ROW = """
<div class="row">
  <div class="id">{sid}<br><small>{source}</small></div>
  <figure><figcaption>current PNG</figcaption>
    <img src="/{png}" alt="{sid} png"></figure>
  <figure><figcaption>new SVG</figcaption>
    <img src="{svg}" alt="{sid} svg"></figure>
</div>
"""

_PAGE = """<!doctype html><meta charset="utf-8"><title>Catalog contact sheet</title>
<style>
body{{font:14px system-ui;background:#fff}}
.row{{display:flex;gap:24px;align-items:center;border-bottom:1px solid #eee;padding:12px}}
.id{{width:140px;font-weight:600}}
img{{height:96px;image-rendering:auto}}
figure{{margin:0;text-align:center}}figcaption{{font-size:11px;color:#888}}
</style>
<h1>Washer catalog review</h1>
{rows}
"""


def render(manifest_path, image_mappings_path, out_dir, png_dir, html_path) -> str:
    standards = json.loads(Path(manifest_path).read_text())["standards"]
    mappings = json.loads(Path(image_mappings_path).read_text())
    rows = []
    for sid, meta in sorted(standards.items()):
        png = mappings.get(sid, {}).get("image", "").lstrip("/")
        svg_rel = str(Path(out_dir) / meta["svg"])
        rows.append(_ROW.format(sid=sid, source=meta.get("source", ""), png=png, svg=svg_rel))
    Path(html_path).write_text(_PAGE.format(rows="".join(rows)))
    return html_path


if __name__ == "__main__":
    render("catalog/out/manifest.json", "data/image-mappings.json",
           "catalog/out", "static/images/standards", "catalog/out/contact-sheet.html")
    print("wrote catalog/out/contact-sheet.html")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_contact_sheet.py -v`
Expected: PASS.

- [ ] **Step 5: Generate and review the real contact sheet**

Run: `./catalog/run python catalog/qa/contact_sheet.py`
Then open `catalog/out/contact-sheet.html` in a browser. **Human checkpoint:** walk every washer row; each new SVG must be a correct, recognizable drawing of that standard (not merely matching the old PNG, which may itself be wrong). Note any standard whose dimensions need correcting and fix `washers.json`, then regenerate.

- [ ] **Step 6: Commit**

```bash
git add catalog/qa/contact_sheet.py catalog/tests/test_contact_sheet.py catalog/out/contact-sheet.html
git commit -m "feat(catalog): contact sheet for old-PNG vs new-SVG review"
```

---

### Task 10: Integrate washer SVGs into the app + maintainer docs

**Files:**

- Create: `static/images/standards/<id>.svg` (the reviewed washer SVGs, copied from `catalog/out`)
- Modify: `data/image-mappings.json` (point each migrated washer at its new `.svg`)
- Create: `catalog/README.md`
- Create: `catalog/integrate.py`

**Interfaces:**

- Consumes: reviewed SVGs in `catalog/out`, `manifest.json`.
- Produces: `catalog.integrate.apply(manifest_path, out_dir, static_dir, image_mappings_path) -> list[str]` — copies each generated SVG into `static_dir` and rewrites that standard's `image` in `image-mappings.json` to the `.svg` path; returns the changed ids.

- [ ] **Step 1: Write the failing test**

`catalog/tests/test_integrate.py`:

```python
import json
from pathlib import Path


def test_integrate_copies_svg_and_repoints_mapping(tmp_path: Path):
    from catalog.integrate import apply

    out = tmp_path / "out"; out.mkdir()
    (out / "din125.svg").write_text("<svg/>")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"standards": {"din125": {"svg": "din125.svg"}}}))
    static_dir = tmp_path / "static"; static_dir.mkdir()
    mappings = tmp_path / "image-mappings.json"
    mappings.write_text(json.dumps({
        "din125": {"image": "/images/standards/din_125.png", "hardwareType": "washer"}
    }))

    changed = apply(str(manifest), str(out), str(static_dir), str(mappings))

    assert changed == ["din125"]
    assert (static_dir / "din125.svg").exists()
    updated = json.loads(mappings.read_text())
    assert updated["din125"]["image"] == "/images/standards/din125.svg"
    assert updated["din125"]["hardwareType"] == "washer"  # preserved
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./catalog/run pytest catalog/tests/test_integrate.py -v`
Expected: FAIL (`ModuleNotFoundError: 'catalog.integrate'`).

- [ ] **Step 3: Implement integration**

`catalog/integrate.py`:

```python
"""Copy reviewed SVGs into static/ and repoint image-mappings.json per standard."""
import json
import shutil
from pathlib import Path


def apply(manifest_path, out_dir, static_dir, image_mappings_path) -> list[str]:
    standards = json.loads(Path(manifest_path).read_text())["standards"]
    mappings = json.loads(Path(image_mappings_path).read_text())
    static = Path(static_dir)
    static.mkdir(parents=True, exist_ok=True)

    changed = []
    for sid, meta in standards.items():
        src = Path(out_dir) / meta["svg"]
        shutil.copyfile(src, static / meta["svg"])
        entry = mappings.setdefault(sid, {})
        entry["image"] = f"/images/standards/{meta['svg']}"
        changed.append(sid)

    Path(image_mappings_path).write_text(json.dumps(mappings, indent="\t") + "\n")
    return sorted(changed)


if __name__ == "__main__":
    changed = apply("catalog/out/manifest.json", "catalog/out",
                    "static/images/standards", "data/image-mappings.json")
    print(f"migrated {len(changed)} standards")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./catalog/run pytest catalog/tests/test_integrate.py -v`
Expected: PASS.

- [ ] **Step 5: Apply integration and rebuild the standards data**

Run: `./catalog/run python catalog/integrate.py`
Then regenerate the shipped dataset so the new image paths flow through:
Run: `pnpm standards:build`
Then verify the app renders an SVG washer: `pnpm dev` and pick DIN 125 — confirm the label shows the new SVG. (The renderer already handles `.svg` via `resolveImageWithSvgPriority`; the vite `AVAILABLE_SVGS` set is rebuilt from `static/images/standards/*.svg` on dev/build.)

- [ ] **Step 6: Write maintainer docs**

`catalog/README.md`:

```markdown
# Fastener asset catalog (maintainer-only)

Generates the 2D SVG technical drawings shipped in `static/images/standards/`.
The app and `pnpm build` do NOT run this — outputs are committed files.

## Add / fix a standard

1. Add or edit its entry in `catalog/dimensions/<hardwareType>.json`
   (`family`, `shape` params, `hardwareType`, `source` citation, `designations`).
2. Point `family` at a generator in `catalog/models/_registry.py`
   (add a new generator only for a genuinely new shape family).
3. Generate + QA (all commands run in the pinned container via `./catalog/run`):
   - `./catalog/run pytest catalog/tests -v`
   - `./catalog/run python catalog/build_catalog.py`
   - `./catalog/run python catalog/qa/coverage.py`
   - `./catalog/run python catalog/qa/contact_sheet.py` (review the HTML)
4. Integrate: `./catalog/run python catalog/integrate.py` then `pnpm standards:build`.
5. Commit the new SVG(s), `image-mappings.json`, and `manifest.json`.

Determinism: versions are pinned in `requirements.txt` and recorded in `manifest.json`.
Regenerating the whole catalog is a deliberate, reviewed operation — never silent CI.
```

- [ ] **Step 7: Run the full washer test suite and commit**

Run: `./catalog/run pytest catalog/tests -v`
Expected: all PASS.

```bash
git add catalog/integrate.py catalog/tests/test_integrate.py catalog/README.md \
  static/images/standards/*.svg data/image-mappings.json src/lib/data/standards-generated.ts
git commit -m "feat(catalog): integrate generated washer SVGs into the app"
```

---

## Self-Review

**Spec coverage:**

- Maintainer-only, committed assets → Task 1 (container), Task 10 (committed SVGs; app untouched). ✅
- 2D SVG, front + side HLR views → Task 2 (`render_two_views`), Task 3 (visual check). ✅
- build123d engine → Task 1. ✅
- One drawing per standard, size-independent → Task 6 (one entry/id, representative M12). ✅
- Models per family, standard = data entry → Task 5 (registry), Task 6 (data). ✅
- `dimensions/*.json` + JSON Schema + `source` → Task 4, Task 6. ✅
- Deterministic build + manifest with toolchain versions + fixed precision → Task 1 (pin/freeze), Task 2 (`precision=4`), Task 7 (manifest toolchain + sha). ✅
- No silent failures (ok/skipped/failed) → Task 7. ✅
- Coverage gate → Task 8. Contact sheet → Task 9. Gradual per-standard migration via image-mappings → Task 10. ✅
- Robustness: per-family invariants → Task 5 tests + generator guards; version pinning → Task 1/7; icon design language (weights/dash) → Task 2 constants; data licensing (numbers + citation, `verified`) → Task 4 schema, Task 6 data; maintainer docs → Task 10. ✅
- Phasing: Phase 0 = Tasks 1–3; Phase 1 washers pilot = Tasks 4–10. Tooth-lock/conical families + nuts/screws/pins/self-tapping = follow-on plans (Global Constraints note). ✅

**Placeholder scan:** No TBD/TODO. Task 6 Step 5 and Task 8 Step 5 are data-population loops with concrete structure and a fail-fast test, not vague placeholders. Version pin is frozen concretely in Task 1 Step 4.

**Type consistency:** `build_part(family, shape)`, `render_two_views(part, preset, out_path, gap_mm)`, `validate_entry(id, entry) -> list[str]`, `build(dimensions_dir, out_dir, manifest_path) -> {ok,skipped,failed}`, `check(manifest, mappings, hardware_type) -> list[str]`, `render(...) -> str`, `apply(...) -> list[str]`, `KNOWN_FAMILIES` used identically in `_registry.py` and `schema.py`, `manifest["standards"][id]` shape consistent across Tasks 7/8/9/10. ✅

## Notes / known follow-ons (out of this plan)

- Tooth-lock (DIN 6797/6798) and conical/Belleville (DIN 6796) washer generators — next plan (add two generators + data, reuse Tasks 7–10 unchanged).
- Nut / screw / pin / self-tapping categories — one follow-on plan each (add family generators + `dimensions/*.json`; orchestrator, coverage gate, contact sheet, integration are already generic).
- A CI job wiring `pytest` + `coverage.py` as a required check on catalog changes (uses the same container).
- `focus`/perspective is intentionally unused (orthographic); front+side origins in `DEFAULT_AXIS_Z` may need per-family presets when non-Z-axis families (bolts/pins) arrive.
