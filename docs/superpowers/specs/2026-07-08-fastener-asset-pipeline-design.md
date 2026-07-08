# Design: Generative Fastener Asset Pipeline

**Date:** 2026-07-08
**Status:** Approved (design) — pending implementation plan
**Branch:** `feature/fastener-asset-pipeline`

## Problem

Users report wrong, ugly, and missing fastener images in the current catalog. The
root cause is structural, not incidental:

- `data/image-mappings.json` is a hand-maintained map (standard id → PNG path). It is
  the single source of truth for which image a standard shows, with **no build-time
  check that the file exists or that the drawing actually matches the standard**.
- 435 standards are served by only ~181 hand-drawn PNGs via heavy reuse (many ISO ids
  point at a DIN PNG). When a reused drawing is not actually equivalent, the standard
  shows a **wrong** image.
- Variant ids (`din933i`, `din931d`, …) fall through to filename auto-detection and can
  silently end up with **no image**.
- Correctness therefore depends on a human keeping a JSON map right, with no automated
  safety net and no way to regenerate a correct drawing.

The existing standards-validation pipeline (`scripts/standards-*.js`) guards against
_invalid/withdrawn_ standards in the **data**, but nothing checks whether the **image**
for a standard is correct or present.

## Goal

Replace the hand-curated raster catalog with a **generative catalog**: each standard is
modelled once from a dimension table, and its label image is a 2D technical drawing
**projected from that geometry**. Because the image becomes a function of verified
dimensions, the whole class of "wrong / ugly / missing image" bugs is eliminated at the
source, and the catalog becomes regenerable and consistent.

## Key decisions (locked during brainstorming)

1. **Epic shape:** generative catalog (not a one-off audit-and-fix of the current PNGs).
2. **On-label asset:** 2D technical line drawing as **SVG** (monochrome, vector, crisp
   when printed small) — produced by hidden-line-removal projection from the 3D model.
   **Two projected views per standard — front + side elevation** — matching the current
   images (a plain washer's side view is a thin bar showing thickness; a bolt/pin's side
   view carries the shape the front view collapses away). Not a shaded 3D render (worse
   on tiny mono labels). No in-app 3D/GLB preview for now.
3. **Geometry + drawing engine:** **build123d** (pure Python, Open Cascade/OCP kernel) —
   **locked, not revisited in Phase 0**. Native `project_to_viewport` (HLR) + `ExportSVG`
   with visible/hidden layers, fully headless, CI-friendly. Chosen over a hand-authored
   2D-SVG generator because **we do not know which shapes get added later**: a general
   3D-model → projection pipeline generalises to arbitrary geometry (complex flange nuts,
   curved/curled spring parts, countersinks) that per-family 2D math would each have to
   re-derive by hand. Chosen over FreeCAD Fasteners Workbench (heavier, GUI-macro
   dependency, painful headless TechDraw) and over online catalogs (redistribution-
   restricted). Accepted trade-off: a full CAD stack (OCP) for small icons, mitigated by
   version pinning and coarse modelling (see Robustness).

## Principles

- **Maintainer-only, offline pipeline; assets are committed.** Like the committed
  `standards-generated.ts`, generated SVGs are checked into the repo as files. The app
  and `pnpm build` never touch Python or build123d. Runtime stays lightweight; frontend
  stack is unchanged.
- **One drawing per standard (size-independent), with two projected views.** Today one
  image == one standard (not per M6/M8). We keep this: one schematic drawing per standard
  from representative proportions (e.g. M6 or the median of the dimension table), holding
  a **front + side elevation** side by side. Scope stays at ~225 drawings, not 225×N.
  Actual size lives in the label text.
- **Geometry is the source of truth, not a hand map.** The SVG is a projection of the
  3D model, so the drawing cannot disagree with the geometry. "Wrong image" becomes
  impossible because the image is a function of the standard's dimensions.
- **Models per shape FAMILY, not per standard.** ~15–20 parametric generators, not 225
  scripts. A standard is a **data entry**, not code.

## Technical feasibility (verified)

- build123d exposes `part.project_to_viewport(origin) -> (visible_edges, hidden_edges)`
  and `ExportSVG` with per-layer line styles (`add_layer("Hidden", line_type=ISO_DOT)`).
  Runs entirely on OCP with no GUI; documented as CI-friendly.
- **Caveat:** OCP wheels on macOS arm64 are unreliable. The generation pipeline runs in
  a **Linux container / CI job**, not directly on the maintainer's Mac. This fits the
  maintainer-only, committed-assets model.

## Architecture

Three disjoint layers plus a new maintainer-only `catalog/` tree (separate from the
frontend and from the existing `data/`):

```
catalog/
  dimensions/            # LAYER 1 — data (facts from standards)
    washers.json         #   grouped per hardwareType
    nuts.json
    screws.json
    pins.json
    self_tapping.json
    _schema.json         #   JSON Schema — validates entries
  models/                # LAYER 2 — geometry (build123d)
    washer.py            #   one generator function per shape FAMILY
    hex_nut.py           #   (parameterised by dimensions, not per standard)
    hex_bolt.py
    pin.py
    _registry.py         #   standard-id -> (model_fn, dimension_key)
  render.py              #   Part -> project_to_viewport -> ExportSVG (style)
  build_catalog.py       #   orchestrator: iterate standards -> SVG + manifest
  qa/                    # LAYER 3 — control
    coverage.py          #   every standard has dims? model? SVG?
    contact_sheet.py     #   HTML: old PNG next to new SVG for review
  Dockerfile             #   Linux + build123d/OCP
```

### Layer 1 — Data model

One entry per standard in `dimensions/*.json`:

```json
"din431": {
  "family": "hex_nut",
  "shape": { "s": 34, "m": 8.5, "bore": 20.96, "form": "A" },
  "hardwareType": "nut",
  "source": "DIN 431:1970 / fasteners.eu",
  "designations": [{ "system": "DIN", "code": "431" }]
}
```

- `family` links to a generator in `_registry.py`.
- `shape` holds the parameters that generator understands.
- `source` gives auditability (where the dimensions came from).

This is the **new single source of truth** for image correctness, replacing the
hand-maintained `image-mappings.json` as the correctness authority. `_schema.json`
(JSON Schema) validates every entry.

### Layer 2 — Geometry + render

- **Generators per shape family** (flat washer, spring washer, tooth-lock washer, hex
  nut, flange nut, self-locking nut, hex-head bolt, socket-head screw, dowel pin,
  spring pin, …). Each takes a `shape` dict and returns a build123d `Part`. Adding a new
  standard = a new data entry + pointing at an existing generator; **no new render code**.
- `render.py` defines one consistent style and produces **two HLR-projected views per
  standard — front + side elevation**, laid out side by side in one SVG. Visible layer =
  solid ~0.5pt stroke, Hidden layer = dashed grey (internal thread / bores). Per-family
  **camera presets** fix the front and side directions, up-vector, and centring so a
  change in a model (e.g. length) reframes predictably. Monochrome, normalised viewBox
  and padding so all icons carry consistent visual weight.

### Layer 3 — Integration + QA

Generated SVGs land in `static/images/standards/`; `image-mappings.json` points at them
per standard; the QA harness proves coverage and enables visual review (see below).

## Data flow (generation)

```
dimensions/*.json ─► build_catalog.py ─► per standard:
                                           1. validate entry against _schema.json
                                           2. registry: family -> model_fn
                                           3. model_fn(shape) -> Part (3D)
                                           4. render.py: project_to_viewport -> (visible, hidden)
                                           5. ExportSVG -> static/images/standards/<id>.svg
                                       ─► manifest.json (id -> svg, hash, source, generated-at)
```

- **Deterministic:** same dimensions → same SVG (OCP is deterministic; no `random` /
  timestamp in geometry). `manifest.json` lets us diff what changed between runs (by
  hash) and feeds QA.
- **No silent failures:** `build_catalog` reports per-standard `ok / skipped / failed`
  with a reason (the pattern already used in `standards-build.js`). Missing dimensions,
  a model exception, or an empty projection are surfaced, not swallowed.
- Runs in a container (`docker run` locally or a CI job). Only the output `.svg` files
  and `manifest.json` are committed.

## QA and migration (the part that ends the bug class)

Three mechanisms, replacing today's invisible correctness decisions:

1. **Coverage gate (automated, in CI).** `qa/coverage.py` checks, for each of the ~225
   standards: does it have a `dimensions/` entry? a `family` in the registry? did an SVG
   generate? Any miss = **red CI**. This closes the "variant `din933i` silently has no
   image" and "map points at a non-existent file" gaps that nothing catches today.

2. **Contact sheet for visual review (human-in-the-loop).** `qa/contact_sheet.py`
   generates one HTML page: for each standard, **old PNG beside new SVG**, labelled with
   `source`. This is how the maintainer reviews the whole catalog once and catches
   "this reused DIN png was actually the wrong shape for that ISO". It turns the
   previously invisible `image-mappings.json` decisions into an explicit, reviewable
   artifact.

3. **Gradual migration, no big bang.** We do not swap 225 PNGs at once.
   `image-mappings.json` stays the image-pointing mechanism but starts pointing at the
   new `.svg` **per standard, as each passes QA**. The renderer already has
   `resolveImageWithSvgPriority()` and an `AVAILABLE_SVGS` set (see
   `src/lib/utils/label-renderer.ts`), so **the SVG infrastructure already exists** —
   we only add files. The old PNG remains a fallback until the new SVG is accepted. Zero
   "all at once" regression risk.

**Definition of "fixed":** a standard is migrated when (a) it has a dimension entry with
a cited source, (b) it generates an SVG, and (c) it passed contact-sheet review. At that
point the "wrong/missing image" bug class is structurally impossible for that standard,
because the image is a function of verified dimensions.

## Phasing

Each phase is a full vertical slice (data → model → SVG → QA → migration) so the
pipeline proves itself end-to-end before it grows.

- **Phase 0 — Spike / de-risk (small, 1–2 days).** Linux container with pinned
  build123d/OCP; push DIN 431 + one washer (DIN 125) through
  `model → project_to_viewport (front + side) → ExportSVG`; eyeball both views next to
  the current PNG. Confirms HLR drawing quality, the front+side layout, and ergonomics
  before building scaffolding. Replaces the earlier FreeCAD spike with the real stack.
- **Phase 1 — Pilot: washers.** First category because geometrically simplest (rings,
  cones, teeth) and heavily gapped today (DIN 125/126/127/128/137/6796/6797/6798 — the
  Workbench lacks these). Build the full scaffolding here (`catalog/`, schema, registry,
  render, coverage gate, contact sheet) and migrate all ~35 washers. After this phase we
  have a working, repeatable pipeline.
- **Phases 2–5 — Scale by category:** nuts → screws → pins → self_tapping. Each adds
  family generators and dimension entries; scaffolding and QA already stand. Order runs
  from simplest / most-gapped to most complex (threaded bolts last).

**Biggest risk / main cost:** not code — it is compiling trustworthy dimension tables
for ~225 standards with a cited source. That is why `dimensions/*.json` with a `source`
field is a first-class artifact, not an afterthought. Phase 1 measures the real cost of
one standard "from norm to SVG".

## Robustness (from external review, 2026-07-08)

A design critique surfaced blind spots; the following are folded into the design. The
engine choice (build123d) and the two-view policy (front + side) were reviewed and
**kept** — see Key decisions.

- **"Correct by construction" is not automatic.** A wrong model function, family
  assignment, or shape option yields _systematically_ wrong-but-consistent images that
  are harder to spot than one mis-mapped PNG. Mitigation: **per-family invariant tests**
  (washer: inner Ø < outer Ø; flange nut: flange Ø > body Ø; hex: 6 outer corners) and
  golden checks on a few standards per family (path/edge counts, bounding box). Failing
  an invariant fails generation.
- **HLR artefacts + kernel non-determinism.** OpenCascade HLR can split/drop tiny
  segments and can change between OCP versions. Mitigation: **coarse modelling** (cosmetic
  bore instead of modelled thread, clean planar hex faces, no micro-fillets); **pin
  build123d + OCP + Python versions** and record them in `manifest.json`; fix export
  precision (3–4 decimals); "regenerate the whole catalog" is a deliberate, QA'd
  operation, never silent CI.
- **Icon design language.** A geometric projection is not automatically a good _symbol_
  at 10 mm. Define, in `render.py` and documented: stroke widths, dash pattern, minimum
  feature size, which hidden edges are kept vs suppressed per family, and allowed
  recognizability "cheats" (e.g. slightly exaggerated head height). The catalog should
  feel intentional, not "whatever HLR produced".
- **Dimension-data licensing.** Store only factual numeric values plus a citation
  (standard number + revision year); do not copy normative prose. A per-entry `verified`
  flag is set only after a human cross-checks the numbers against the normative document.
- **Catalog versioning.** A global style revamp is a versioned change: keep old SVGs,
  bump a catalog version, and note user-visible icon changes.
- **Maintainer docs.** Document "how to add a standard": where to source dimensions, how
  to cite, how to pick a family, how to run the container pipeline and review the contact
  sheet.

## Out of scope (YAGNI for now)

- In-app 3D / GLB preview.
- Per-size views.
- Runtime generation (stays maintainer-only, committed assets).
- Realistic modelled threads (a cosmetic bore / simplified profile is enough at label
  size).

## References

- Current image system map: `data/image-mappings.json`,
  `src/lib/data/standards-generated.ts`, `src/lib/utils/label-renderer.ts`
  (`resolveImageWithSvgPriority`, `AVAILABLE_SVGS`), `scripts/standards-build.js`.
- Coverage analysis (our 225 standards vs Fasteners Workbench): 82 by name, 36 via
  ISO/DIN twin, 107 not in the Workbench in any form.
- build123d import/export + technical-drawing tutorial (HLR SVG export).
