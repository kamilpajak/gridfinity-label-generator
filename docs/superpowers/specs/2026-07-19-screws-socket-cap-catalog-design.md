# Socket-Head Cap Screw Family Catalog — Design (second screw family)

**Date:** 2026-07-19
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — sub-family **B** (hex-socket / Allen), after **A** hex-head bolts
**Predecessors:** …retaining rings (#109), hex-head bolt — first screw family (#110)

## Category context

This is sub-family **B** of the `screw` decomposition settled in the hex-bolt design
(`2026-07-18-screws-hex-bolt-catalog-design.md`). That spec fixed two cross-cutting decisions
that this family inherits unchanged:

1. **Threaded shank = smooth envelope, no thread lines.** The shank is a plain cylinder at the
   major diameter (`_screw_shank`), built along −Z from the under-head bearing plane `z=0`.
2. **Preset = `DEFAULT_AXIS_Z`, axis-along-Z.** The front view looks down Z (the **end view**:
   head outline + the drive recess), the side view is the horizontal head+shank elevation. No new
   preset unless a long screw fails to frame at the first build.

What is new here versus hex-bolt: the head is a **plain cylinder** (not a hex prism), and the
family introduces the **first drive recess** in the screw category — a blind socket cut into the
top face of the head. The recess is the identifying feature of the end view and is
**parametrised by drive style** (`hex` vs `lobular`), exactly the way `lock_nut` parametrised its
top feature (`cylinder` vs `cone`).

## Goal

Add a **socket-head cap screw** family (`socket_screw`) at a representative **M12 × 60**,
shipping three standards:

- **`iso4762`** — hex-socket (Allen) socket-head cap screw. Base, `drive: "hex"`.
- **`din912`** — the DIN designation of the same screw; identical M12 envelope → **alias** of
  `iso4762`.
- **`iso14579`** — hexalobular (Torx) socket-head cap screw. Same head `dk`/`k` as `iso4762`, but
  a 6-lobe recess → a **different end view** → a **distinct base** (`drive: "lobular"`), not an
  alias.

A socket-head cap screw = a cylindrical head with a blind drive socket in its top face, over a
smooth cylindrical shank with a lead chamfer at the free end. No drawn thread, no through bore.

## Non-goals

- **No drawn thread.** Smooth major-diameter shank (inherited envelope rule).
- **No new preset.** Axis-along-Z → `DEFAULT_AXIS_Z` (confirmed at build).
- **No low-head / other-head variants in this spec** — low-head socket cap (din6912, din7984),
  button head (iso7380), and countersunk socket (iso10642) have a genuinely different head
  silhouette (head height or a conical/domed profile) → they are **later data entries / specs**
  reusing `socket_screw` (button/csk need a head-shape parameter — deferred). Fine-pitch socket
  cap collapses to the coarse drawing as an alias when added.
- **No true dimensional Torx profile.** The lobular recess is a **representative** rounded 6-lobe
  icon (Approach B below), documented as such — the exact ISO 10664 lobe radii are not the point
  at label scale.
- **No sizes beyond the M12 × 60 representative.** No user-facing toggle (epic END goal).

## Silhouette to match

| Legacy raster   | Standard | Shape                                                              |
| --------------- | -------- | ------------------------------------------------------------------ |
| `iso_4762.png`  | iso4762  | cylindrical head, **hexagon** recess in the end view; smooth shank |
| (same)          | din912   | identical M12 envelope → alias                                     |
| `iso_14579.png` | iso14579 | cylindrical head, **6-lobe (Torx)** recess in the end view         |

- **End view** (front, down the Z axis): the head **circle** (diameter `dk`) with the drive recess
  outline concentric inside it — a **hexagon** for `iso4762`/`din912`, a **rounded 6-lobe** for
  `iso14579`. This recess is what discriminates the two base drawings and what discriminates a
  socket cap from a plain cheese/cylinder head.
- **Side elevation** (side, axis horizontal): the cylindrical **head** (diameter `dk`, height `k`)
  at one end and the **smooth shank** (diameter `d_shank`, length `length`) extending from it, with
  a small lead chamfer at the free end. The blind recess is hidden geometry in this view.

## Architecture

**Generator — new `catalog/models/socket_screw.py`:**

```python
def socket_screw(dk, k, length, d_shank, drive, socket_af, socket_depth,
                 head_chamfer=None, tip_chamfer=None):
    ...
```

- **Head:** `Cylinder(radius=dk/2, height=k)` built above the bearing plane, `z∈[0, k]`
  (`Align.MIN` on Z). Optional small top-rim chamfer `head_chamfer` (a real socket cap has a light
  edge break); default none, added only if the first render looks wrong.
- **Recess:** a blind socket cut from the **top face** (`z=k`) downward by `socket_depth`
  (`z∈[k−socket_depth, k]`, the cutter extended slightly above `k` for a clean cut). Not through.
  Cutter shape depends on `drive`:
  - `"hex"` → a **hexagonal prism** of across-flats `socket_af` (the Allen key size), subtracted.
    Orientation confirmed against the raster at build (vertex-up vs flat-up).
  - `"lobular"` → a **rounded 6-lobe (Torx) prism** at representative proportions (see below),
    subtracted.
- **Shank:** `_screw_shank(d_shank, length, tip_chamfer)` from `screw_common`, `z∈[−length, 0]`,
  unioned to the head bearing face (shares the `z=0` face → fuses). No bore.
- Imports **only** `_screw_shank` from `screw_common`; does **not** modify any existing generator.
  Net guard on `part.volume > 0` (not `is_valid` — the sewn-shell gotcha), and `len(solids)==1`
  (head + shank must fuse into a single solid, as in `hex_bolt`).

### Drive recess — hex vs hexalobular (Approach B for Torx)

The **hex** recess is a plain hexagonal prism of across-flats `socket_af` — trivial and exact.

The **lobular** (Torx) recess is modelled as a **representative rounded 6-lobe** profile, **not**
the true ISO 10664 dimensioned curve and **not** a sharp 6-point star (a hexagram does **not**
look like a Torx — this is the "wrong shape" trap the shape-fidelity rule in `CLAUDE.md` warns
about). Approach B: a central core disc unioned with 6 rounded lobes spaced at 60°, forming one
closed region, extruded to a prism and subtracted. Two representative parameters (core radius and
lobe radius/offset) derived from `socket_af`; the lobes stay **rounded** so the icon reads as
Torx at label scale. The `source` string records the recess as representative form, and the
open-source reference consulted for the lobe geometry (FreeCAD Fasteners Workbench / ISO 10664
form) is attributed in `THIRD-PARTY-NOTICES.md` — reimplemented in build123d, never copied.

Rejected alternatives: a fully dimensioned ISO 10664 profile (extra code for sub-visible fidelity;
lobe radii not cleanly tabulated in public sources), and a hexagram/6-point star (wrong shape).

### Orientation / preset (DEFAULT_AXIS_Z reuse)

Axis = Z, same as `hex_bolt`. `hardwareType: "screw"` → `preset_for_hardware_type("screw")`
returns `DEFAULT_AXIS_Z` (only `"nut"` gets `NUT_PRESET`) — **no preset change**. The recess
orientation and whether a long M12×60 frames acceptably are confirmed at the first build; a
`SCREW_PRESET` is added only if needed (and only if hex-bolt has not already added one by then).

### Guards (ValueError)

1. `dk, k, length, d_shank, socket_af, socket_depth` all `> 0`.
2. `drive ∈ {"hex", "lobular"}` (else raise).
3. `d_shank < dk` — the shank is narrower than the head (it emerges from the bearing face).
4. `socket_af < dk` — the recess sits within the head face (with a **small local wall margin** so
   the head does not become a ring; a module-level constant in `socket_screw.py`, not imported —
   the family still imports only `_screw_shank`).
5. `socket_depth < k` — the socket is blind (a hex-body/floor of head must remain below it).
6. `tip_chamfer` (if given) delegated to `_screw_shank` (its existing `0 < tip_chamfer < r` and
   `< length` validation).
7. Final `part.volume > 0` and `len(part.solids()) == 1`.

## Data

New `catalog/dimensions/socket_screws.json`. Shape = `{dk, k, length, d_shank, drive, socket_af,
socket_depth, head_chamfer?, tip_chamfer?}`.

| id         | family       | fields / relation              | note                              |
| ---------- | ------------ | ------------------------------ | --------------------------------- |
| `iso4762`  | socket_screw | full shape, `drive: "hex"`     | M12 × 60, Allen socket            |
| `din912`   | —            | `alias_of: iso4762`            | same M12 envelope + hex socket    |
| `iso14579` | socket_screw | full shape, `drive: "lobular"` | same head as iso4762, Torx recess |

**Sourcing gate (controller, before the data task).** Confirm from **≥2 independent public
tables** the M12 socket-head cap screw dimensions: head diameter `dk` (≈18), head height `k`
(≈12, typically ≈ nominal thread diameter), hex socket across-flats `socket_af` (≈10, the Allen
key size), and socket depth `socket_depth` (≈6). `d_shank = 12` (nominal major diameter).
`length = 60` is a representative catalog length, documented as chosen (not normative). Confirm
`din912`'s M12 head + socket equal `iso4762`'s (so the alias is exact — DIN 912 and ISO 4762 are
the same screw). For `iso14579`, confirm the head `dk`/`k` equal `iso4762`'s (only the drive
differs) and note the Torx size for M12 (≈ T50); the lobular recess geometry is representative
form. Each `source` string cites only public tables — never a private/internal catalogue (no
`reyher`, `stalmut`) — and states which fields are tabulated (`dk`, `k`, `socket_af`,
`socket_depth`) vs representative (`length`, and the whole lobular profile).

## Registration & render

- `catalog/models/_registry.py`: add `"socket_screw": socket_screw` to `KNOWN_FAMILIES`
  (+ import), next to `hex_bolt`. (`_screw_shank` stays a private helper, not a registered
  family.)
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("screw")` → `DEFAULT_AXIS_Z`. The alias two-pass handles `din912`.

## Testing

Generator geometry tests use **synthetic** fixtures (geometrically valid numbers, not claimed as
any real standard); real dimensions come from the controller sourcing pass at the data task.

- `catalog/tests/test_socket_screw.py` (generator; a 3D point-probe helper like the other
  families):
  - **Envelope:** bbox Z (axis) = `k + length`; head extent on X/Y = `dk`; `volume > 0`.
  - **Head present, shank narrower:** solid within the head band (`z∈[0,k]`) out to near `dk/2`;
    within the shank band (`z<0`) solid to `d_shank/2` and void just beyond it (the shank is
    narrower than the head).
  - **Recess is blind, opens from the top:** void just below the top face on the axis
    (`z≈k−ε`, inside the socket) but **solid** below the socket floor (`z≈k−socket_depth−ε`) —
    proving the socket is blind, not a through bore.
  - **hex vs lobular differ:** at a probe radius/angle where a hexagon has material but the 6-lobe
    valley does not (or vice versa), the two drives give a different result — proving the drive
    parameter changes the recess shape (not just a re-labelled identical cut).
  - **Fuse:** `len(part.solids()) == 1` (head + shank one solid).
  - **Guards** each raise (`drive` unknown, `socket_af ≥ dk`, `socket_depth ≥ k`, `d_shank ≥ dk`,
    non-positive dims); a valid config builds `volume > 0`.
- `catalog/tests/test_socket_screws_data.py` (data): every entry validates + builds; the `din912`
  alias resolves to a real non-alias base; `family`/`hardwareType`/`drive` as expected; each entry
  sourced + `verified: true`; no forbidden source token (`reyher`, `stalmut`).
- Existing tests stay green; existing SVGs stay byte-identical (only `_screw_shank` is imported;
  no shared code changed).

## Rollout / invariants

- **Opt-in 0/0.** In-container only (`./catalog/run`; pre-warm the image once before the first
  timed step). Build produces **2 new drawings** (`iso4762`, `iso14579`) + 1 alias (`din912`, no
  new file); no existing drawing changes (byte-identical). `image-mappings.json` and
  `src/lib/data/standards-generated.ts` stay untouched (`grep -c '.svg'` → 0 for both).
- Build entrypoint in-container: `python -m catalog.build_catalog`.
- Convention: TDD → commit → push → PR → zen review (`deepseek/deepseek-v4-pro`, thinking=high — a
  new generator on a shared surface) → apply findings as additional commits → CI green →
  squash-merge (admin). Visual confirmation of both drawings vs the rasters before merge,
  including that the recess reads correctly (hexagon vs rounded 6-lobe) and the preset frames the
  long screw acceptably.
- Attribute the open-source reference consulted for the lobular recess form (FreeCAD Fasteners
  Workbench / ISO 10664) in `THIRD-PARTY-NOTICES.md`.

## Global constraints (verbatim)

- Representative size **M12 × 60**. Ships `iso4762` + `din912` (alias) + `iso14579`.
- Every committed **envelope** dimension (`dk`, `k`, `socket_af`, `socket_depth`) confirmed by
  **≥2 independent public tables**; representative fields (the chosen `length`, `head_chamfer`,
  `tip_chamfer`, and the entire lobular recess profile) documented as such, never fabricated as
  normative. Shape (cylindrical head + blind drive socket + smooth shank + lead chamfer) verified
  against the raster + tables; the Torx recess stays rounded (never a sharp star).
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- A new base shape reuses `_screw_shank`; do **not** modify it or any existing generator; existing
  SVGs byte-identical.
- **No render/preset change** (verified at build). Smooth envelope shank (no thread).
- opt-in invariant 0/0 after build.
