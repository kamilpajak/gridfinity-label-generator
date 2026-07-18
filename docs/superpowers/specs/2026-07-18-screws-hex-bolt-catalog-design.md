# Hex-Head Bolt Family Catalog — Design (first screw family)

**Date:** 2026-07-18
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — FIRST family in the category (nuts, washers, rings complete)
**Predecessors:** …tslot (#107), nut-skip docs (#108), retaining rings (#109)

## Category context — screw decomposition

The `screw` category has **46 legacy rasters** (75 standards, 46 with images) → ~40 distinct
drawings. Screws render as a **side elevation (axis horizontal: head + shank) + an end view
(head-on: the head outline and drive)** — which is exactly what the existing default preset
`DEFAULT_AXIS_Z` produces for a part modeled **axis-along-Z** (front = end view, side =
horizontal elevation). So the category needs no new preset for the common cases; the work is
head shapes, drives, and the shank.

**Two cross-cutting decisions (settled, apply to all screw families):**

1. **Threaded shank = smooth envelope, no thread lines.** The shank is a plain cylinder at the
   major diameter. Consistent with the epic's existing "thread is a fine feature, envelope-only"
   rule (nuts draw no internal thread). Consequence: standards that differ ONLY in invisible
   thread details — partial vs full thread (iso4014 vs iso4017), coarse vs fine — collapse to the
   **same drawing** and become aliases. Distinct drawings come from different head sizes or shank
   features.
2. **Preset = `DEFAULT_AXIS_Z`, axis-along-Z**, verified visually at the first build; a
   `SCREW_PRESET` is added only if a long screw does not frame acceptably.

**Sub-family decomposition (by head shape = generator boundary), build order A→F:**

| Sub-family                    | Generator       | ~Drawings        | Notes                                                                                            |
| ----------------------------- | --------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| **A. Hex-head bolts**         | `hex_bolt`      | ~10 (many alias) | **this spec.** Archetype; establishes the shank helper + preset.                                 |
| B. Hex-socket (Allen)         | `socket_screw`  | ~6               | cylindrical/dome/cone head + hex-socket end view.                                                |
| C. Slotted + cross small-head | `slotted_screw` | ~8               | cheese/pan/csk/raised-csk × slot/cross drive.                                                    |
| D. Carriage / square-neck     | `carriage_bolt` | ~4               | cup/flat head + square anti-rotation neck.                                                       |
| E. Square-head                | `square_bolt`   | ~2               | din478/479.                                                                                      |
| F. Specialty long-tail        | one-offs        | ~8               | wing (reuse `wing_nut`), knurled thumb (reuse `knurled_nut`), eye, T-head, capstan, wheel, stud. |

This spec covers **sub-family A only**, shipping the core archetype first; the hex-head variants
(fine-thread, structural HV, fit bolts) follow as later data entries / PRs reusing `hex_bolt`.

## Goal

Add a **hex-head bolt** family and its shared screw infrastructure, shipping the archetype
`iso4014` (hex bolt, partial thread) at a representative **M12 × 60**, plus `iso4017` (full
thread) as an alias (identical smooth envelope). A hex bolt = a chamfered hex head + a smooth
cylindrical shank with a lead chamfer at the free end; no drawn thread, no bore (the external
hex head is its own drive).

## Non-goals

- **No drawn thread.** Smooth major-diameter shank (envelope rule). No thread run-out line.
- **No new preset.** Axis-along-Z → `DEFAULT_AXIS_Z` gives end view + horizontal elevation.
- **No hex-head variants in this spec** — fine-thread (din960/961, iso8676/8765), structural HV
  (din6914/7990/7968/7969), and fit bolts (din609/610) follow as later data entries (fine/coarse
  alias the archetype; structural/fit are distinct head/shank → new data, same generator).
- **No other screw sub-families** (B–F) — separate specs.
- **No sizes beyond the M12 × 60 representative.** No user-facing toggle (epic END goal).

## Silhouette to match

| Legacy raster  | Standard | Shape                                                   |
| -------------- | -------- | ------------------------------------------------------- |
| `iso_4014.png` | iso4014  | hex head + smooth shank; end view = hexagon             |
| (same)         | iso4017  | full-thread variant → identical smooth envelope (alias) |

- **End view** (front, down the Z axis): the **hexagon** head outline (with the shank circle
  concentric behind it). Orientation (vertex-up per the nut convention vs flat-up) confirmed
  against the raster at build.
- **Side elevation** (side, along −Y, axis horizontal): the **head** (hex profile, height `k`) at
  one end and the **smooth shank** (diameter `d_shank`, length `length`) extending from it, with a
  small lead chamfer at the free end.

## Architecture

**Shared screw helper — new `catalog/models/screw_common.py`:**

```python
def _screw_shank(d, length, tip_chamfer=None):
    """A smooth cylindrical shank of diameter d and axial length, built along -Z from z=0
    (the under-head bearing plane) to z=-length, with an optional 45-degree lead chamfer of
    leg `tip_chamfer` at the free end. Envelope only — no thread is drawn."""
    ...
```

Built now (not speculative — the decomposition confirms six screw families reuse it). The shank
is `Cylinder(d/2, length)` placed `z∈[−length, 0]`; the lead chamfer bevels the free-end
circular edge (a revolve-∩ or an edge `chamfer` on the end face).

**Generator — new `catalog/models/hex_bolt.py`:**

```python
def hex_bolt(s, k, length, d_shank, head_chamfer=None, tip_chamfer=None):
    ...
```

- **Head:** `_chamfered_hex_solid(s, k, head_chamfer)` from `hex_nut` (6th reuse) — hex prism of
  across-flats `s`, height `k`, vertex-up, chamfered. Placed bearing face at `z=0`, head up
  `z∈[0, k]`.
- **Shank:** `_screw_shank(d_shank, length, tip_chamfer)` down `z∈[−length, 0]`, unioned to the
  head bearing face. No bore.
- Imports **only** `_chamfered_hex_solid` and `_MIN_WALL_MM` from `hex_nut`, and `_screw_shank`
  from `screw_common`. Net guard on `part.volume > 0` (not `is_valid`).

### Orientation / preset (DEFAULT_AXIS_Z reuse)

Axis = Z. Under `DEFAULT_AXIS_Z` the front view looks down Z (the hexagon end view + concentric
shank) and the side view looks along −Y with X vertical, so Z is horizontal → the bolt lies
**axis-horizontal**, head at the `+Z` end, shank extending to `−Z` — the side elevation. Both
views share height (X vertical). `hardwareType: "screw"` → `preset_for_hardware_type("screw")`
returns `DEFAULT_AXIS_Z` (only `"nut"` gets `NUT_PRESET`) — **no preset change**. The head
orientation (vertex-up, inherited from `_chamfered_hex_solid`, vs flat-up) and whether a long
M12×60 frames acceptably are confirmed at the first build; a `SCREW_PRESET` is added only if
needed.

### Documented simplification (head bearing-face chamfer)

`_chamfered_hex_solid` chamfers BOTH hex faces; a real ISO 4014 head is chamfered on the top
face only, with a flat bearing face. The bottom chamfer bevels only the outer hex corners
(radius `s/2` inward; the shank is `d_shank/2 = 6 < 9`, so the head–shank junction stays a clean
flat annulus) and is sub-visible at label scale — the same class as the nut envelope
simplifications, noted in the `source` string. (If the first render shows an objectionable
bearing-face bevel, a top-only-chamfer head variant is the fallback.)

### Guards (ValueError)

1. `s, k, length, d_shank` all `> 0`.
2. `d_shank < s` — the shank must be narrower than the head across-flats (it emerges from the
   bearing face); a shank wider than the head is not a bolt.
3. `tip_chamfer` (if given) `> 0` and `< d_shank/2` (the lead chamfer stays within the shank).
4. `head_chamfer` delegated to `_chamfered_hex_solid` (its existing validation).
5. Final `part.volume > 0`.

## Data

New `catalog/dimensions/hex_bolts.json`. Shape = `{s, k, length, d_shank, head_chamfer,
tip_chamfer}`.

| id        | family   | fields                                             | note                                   |
| --------- | -------- | -------------------------------------------------- | -------------------------------------- |
| `iso4014` | hex_bolt | `s, k, length, d_shank, head_chamfer, tip_chamfer` | M12 × 60                               |
| `iso4017` | —        | `alias_of: iso4014`                                | full thread; identical smooth envelope |

**Sourcing gate (controller, before the data task).** Confirm from **≥2 independent public
tables** the M12 ISO 4014 hex-head dimensions: across-flats `s` (18), head height `k` (7.5), and
a representative overall/shank `length` (a standard catalog length, e.g. 60 mm — documented as
the chosen representative). `d_shank = 12` (nominal major diameter). `head_chamfer` and
`tip_chamfer` are representative if not cleanly tabulated (the head top chamfer and the shank
lead chamfer), documented as such. Confirm `iso4017`'s M12 head + length equal `iso4014`'s (so
the alias is exact). Each `source` string cites only public tables — never a private/internal
catalogue (no `reyher`, `stalmut`).

## Registration & render

- `catalog/models/_registry.py`: add `"hex_bolt": hex_bolt` to `KNOWN_FAMILIES` (+ import). 25
  families. (`_screw_shank` is a private helper, not a registered family.)
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("screw")` → `DEFAULT_AXIS_Z`. The alias two-pass handles `iso4017`.

## Testing

- `catalog/tests/test_hex_bolt.py` (generator; synthetic fixtures, `_solid_at(part, x, y, z)` 3D
  probe):
  - **Envelope:** bbox Z (axis) = `k + length`; head across-corners on X/Y; `volume > 0`.
  - **Hex head present:** solid within the head band (`z∈[0,k]`) out to near across-corners; void
    just beyond the corners — discriminates the hex from a plain cylinder head.
  - **Round shank:** within the shank band (`z<0`) solid to `d_shank/2`, void just beyond; the
    shank is narrower than the head (solid at head corner radius in the head band, void at that
    radius in the shank band).
  - **No bore / solid core:** solid on the axis through both the head and the shank.
  - **Tip chamfer:** the extreme free-end outer corner (`z≈−length`, radius ≈ `d_shank/2`) is
    cut when `tip_chamfer` is given; solid there without it.
  - **Guards** each raise; a valid config builds `volume > 0`.
- `catalog/tests/test_screw_common.py` (the shank helper in isolation: cylinder extents, tip
  chamfer, guards).
- `catalog/tests/test_hex_bolts_data.py` (data): entries validate + build, family/hardwareType,
  the `iso4017` alias resolves, sourced + verified, no forbidden source token.
- Existing tests stay green; existing SVGs stay byte-identical (only `_MIN_WALL_MM` /
  `_chamfered_hex_solid` are imported; no shared code changed).

Generator geometry tests use **synthetic** fixtures; real dimensions come from the controller
sourcing pass at the data task.

## Rollout / invariants

- **Opt-in 0/0.** In-container only (`./catalog/run`). Build produces 1 new drawing (`iso4014`)
  - 1 alias (`iso4017`, no new file); no existing drawing changes (byte-identical).
    `image-mappings.json` and `src/lib/data/standards-generated.ts` stay untouched
    (`grep -c '.svg'` → 0 for both).
- Build entrypoint in-container: `python -m catalog.build_catalog`.
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, thinking=high — a new
  generator + a new shared helper are shared surfaces) → apply findings as additional commits →
  CI green → squash-merge (admin). Visual confirmation of the drawing vs the raster before merge,
  including confirming the preset frames the long screw acceptably.

## Global constraints (verbatim)

- Representative size **M12 × 60**. Ships `iso4014` + `iso4017` (alias).
- Every committed dimension confirmed by **≥2 independent public tables**; representative fields
  (the chosen `length`, `head_chamfer`, `tip_chamfer`) documented as such, never fabricated as
  normative. Shape (hex head + smooth shank + lead chamfer) verified against the raster + tables.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- A new base shape + a new shared helper — reuse `_chamfered_hex_solid`; do **not** modify it or
  any existing generator; existing SVGs byte-identical.
- **No render/preset change** (verified at build). Smooth envelope shank (no thread).
- opt-in invariant 0/0 after build.
