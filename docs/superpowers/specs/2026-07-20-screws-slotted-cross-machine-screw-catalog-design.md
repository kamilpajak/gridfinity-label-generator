# Slotted & Cross-Recess Machine Screw Family Catalog — Design (fourth screw family)

**Date:** 2026-07-20
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — sub-family (machine screws with a shaped head + slot/cross drive), after
A hex-head bolts, B hex-socket cap screws, C hex-socket set screws
**Predecessors:** hex-head bolt (#110), socket-head cap screw (#111), hex-socket set screw (#115)

## Category context

The three earlier screw families each parametrised the **one feature that distinguishes their
standards**: `socket_screw` parametrised the drive recess (`hex` / `lobular`), `set_screw`
parametrised the point (`flat` / `cone` / `dog` / `cup`). This family has **two** orthogonal
distinguishing features — the **head shape** and the **drive** — so `slotted_screw` parametrises
both as independent dispatches. This is the catalog's first family whose standards form a
head × drive matrix rather than a single-axis list.

A machine screw = a smooth cylindrical shank (envelope-only, no drawn thread) with a shaped head
on top, and a slot or cross recess cut into the head's top. The shank reuses the shared
`_screw_shank` from `screw_common` (top face on the under-head bearing plane `z=0`, built down
`-Z`) exactly as `socket_screw` does; the head is built above `z=0` (`+Z`) so a plain `add()`
fuses head and shank into one solid.

## Goal

Add a **slotted & cross-recess machine screw** family (`slotted_screw`) at a representative
**M10**, shipping seven standards spanning four head shapes and two drive types, each with its
cross-system alias where a clean 1:1 mapping exists:

| Base id   | head        | drive | alias     | standard                               |
| --------- | ----------- | ----- | --------- | -------------------------------------- |
| `din84`   | cheese      | slot  | `iso1207` | slotted cheese head                    |
| `din85`   | pan         | slot  | `iso1580` | slotted pan head                       |
| `din963`  | countersunk | slot  | `iso2009` | slotted countersunk (flat) head        |
| `din966`  | raised      | slot  | `iso2010` | slotted raised countersunk (oval) head |
| `iso7045` | pan         | cross | `din7985` | cross-recess pan head                  |
| `iso7046` | countersunk | cross | `din965`  | cross-recess countersunk (flat) head   |
| `iso7047` | raised      | cross | _(none)_  | cross-recess raised countersunk (oval) |

- **Seven base drawings** + **six aliases**. Slotted standards take the DIN number as base (the
  classic designation) with the ISO alias; cross standards take the ISO number as base (the
  primary current designation) with the DIN alias.
- **`iso7047` ships with no DIN alias.** The historical DIN cross raised-countersunk (DIN 966
  form H) was withdrawn/merged and `din966` is already the _slotted_ raised base here, so there is
  no clean current 1:1 DIN number. Documented in `source`, consistent with the deliberate-skip
  precedent (DIN 562 / DIN 80701).

## Representative size — M10 (deviation from the epic's M12, deliberate)

The epic's representative size is M12, but M12 is **out of range** for the dimensional tables of
ISO 1207, ISO 1580 / DIN 84, DIN 85, and the ISO 7045/7046/7047 cross series — those are
small-to-medium machine-screw standards. **M10 is the largest nominal size common to all seven**
(confirmed against the ISO 1207:2011 and ISO 1580:2011 dimension tables and supplier data). Using
M10 keeps every drawing a real, tabulated catalog part; shipping an M12 cheese/pan/cross screw
would fabricate a size the standard does not define. `source` strings document M10 as chosen for
this reason.

## Non-goals

- **No drawn thread.** Smooth major-diameter cylinder shank (inherited envelope rule).
- **No dimensioned ISO 4757 cross form.** The cross recess is a representative tapered-pyramidal
  icon (see below), same philosophy as the Torx lobular in `socket_screw` — never the normative
  gauge geometry.
- **No round-head / binding-head / other head shapes** (DIN 86/96, etc.) — four heads only.
- **No new preset.** Axis-along-Z → `DEFAULT_AXIS_Z` (confirmed at build).
- **No modification to `socket_screw.py` / `set_screw.py`.** `slotted_screw` reuses only the
  shared `_screw_shank` from `screw_common` (its documented extension point), adds nothing to
  `screw_common`, and leaves existing generators byte-identical.
- **No sizes beyond the M10 representative.** No user-facing toggle (epic END goal).

## Silhouette to match

| Standard        | head        | End view (down Z)      | Side elevation                                       |
| --------------- | ----------- | ---------------------- | ---------------------------------------------------- |
| din84/iso1207   | cheese      | circle + straight slot | cylindrical head, near-flat top, edge-to-edge slot   |
| din85/iso1580   | pan         | circle + straight slot | low domed head, edge-to-edge slot                    |
| din963/iso2009  | countersunk | circle + straight slot | flat conical (flush) head, slot across the flat top  |
| din966/iso2010  | raised      | circle + straight slot | conical head with a raised lens, slot across the top |
| iso7045/din7985 | pan         | circle + cross recess  | low domed head, cross recess                         |
| iso7046/din965  | countersunk | circle + cross recess  | flat conical head, cross recess                      |
| iso7047         | raised      | circle + cross recess  | conical head with a raised lens, cross recess        |

- **End view** (front, down Z): the head circle with the drive outline concentric inside —
  a single straight slot (edge-to-edge) or a four-arm cross recess.
- **Side elevation** (side, axis horizontal): the shaped head over the shank; the head shape and
  the recess-depth notch discriminate the drawings.

## Architecture

**Generator — new `catalog/models/slotted_screw.py`:**

```python
def slotted_screw(head, drive, dk, k, length, d_shank,
                  drive_w, drive_t,
                  crown_r=None, dome_r=None, raised_f=None,
                  drive_m=None, tip_chamfer=None):
    ...
```

Two orthogonal parametrised features:

**1. Head shape (`head`)** — built by revolving a head-specific meridian in the XZ plane about Z
(deterministic — no fragile edge selection, the same technique as `_screw_shank`, the `lock_nut`
cone, and the `set_screw` points). The head occupies `z ∈ [0, k]` (`raised` extends to
`k + raised_f`), bearing face on `z=0`.

- **`cheese`** (din84/iso1207): a plain cylinder of radius `dk/2`, height `k`, with an optional
  small 45° top-outer-edge break of leg `crown_r` (representative rounded cheese edge). Meridian is
  a straight-segment polygon.
- **`pan`** (din85/iso1580, iso7045/din7985): a shallow spherical-cap dome. Meridian is a
  `BuildLine` — bottom bearing radius `dk/2` at `z=0`, a `RadiusArc` of radius `dome_r` sweeping to
  the top centre `(0, k)` — closed to a face and revolved. `dome_r` sets the crown curvature.
- **`countersunk`** (din963/iso2009, iso7046/din965): a flat 90°-ish cone frustum. Meridian
  straight segments `(0,0)-(d_shank/2,0)-(dk/2,k)-(0,k)-(0,0)`: radius `d_shank/2` at the bearing
  plane widening to `dk/2` at the flush flat top `z=k`.
- **`raised`** (din966/iso2010, iso7047): the countersunk cone **plus** a raised spherical lens.
  Meridian `BuildLine`: `(0,0)-(d_shank/2,0)-(dk/2,k)` then a `RadiusArc` of radius `dome_r` to the
  top centre `(0, k + raised_f)`. Total head height `k + raised_f`.

**2. Drive (`drive`)** — cut from the head top by SUBTRACT:

- **`slot`**: one rectangular prism (a `Box`) of width `drive_w`, length `> dk` (spans edge to
  edge), positioned with its top above the head crown and extending `drive_t` down into the head.
  Deterministic.
- **`cross`**: a **lofted tapered-pyramidal cutter** — `loft()` between a full-size cross sketch
  (two crossed rectangles of arm width `drive_w`, overall span `drive_m`) on the head-top plane and
  a smaller converging cross sketch (arms scaled by a fixed taper fraction) at depth `drive_t`.
  The loft is a single deterministic solid (no edge selection); SUBTRACT leaves a four-arm recess
  with converging tapered walls — a representative Phillips/Pozidriv icon, not the ISO 4757 curve.

`hardwareType: "screw"` → `DEFAULT_AXIS_Z`. No preset change.

### Head-top plane (where the drive is cut)

The drive is cut from the head's maximum-Z plane: `z = k` for cheese/countersunk (flat tops) and
`z = k` (dome apex) for pan, `z = k + raised_f` for raised. The cutter's top sits at (or just
above, by `_RECESS_EPS`) that plane and extends `drive_t` downward, so the recess floor is flat at
`top − drive_t`. A single `_RECESS_EPS = 0.05` over-cut above the crown gives a clean rim (the
same idiom `socket_screw` uses).

### Guards (ValueError)

1. `dk, k, length, d_shank, drive_w, drive_t` all `> 0`.
2. `head ∈ {cheese, pan, countersunk, raised}`; `drive ∈ {slot, cross}` (else raise).
3. `d_shank < dk` (the shank is narrower than the head).
4. Head-specific required params:
   - `pan` requires `dome_r > 0` and `dome_r ≥ dk/2` (a valid, non-inverted crown arc).
   - `raised` requires `dome_r > 0`, `dome_r ≥ dk/2`, and `raised_f > 0`.
   - `cheese` `crown_r` (when given) `> 0` and `< min(dk/2, k)`.
   - `countersunk` needs `dk > d_shank` (already implied by guard 3; the cone must widen).
5. Drive-specific:
   - `cross` requires `drive_m > 0`, `drive_m ≤ dk` (recess within the head top), and
     `drive_w < drive_m` (arm narrower than the overall cross span).
   - `slot` requires `drive_w < dk` (slot narrower than the head).
6. `drive_t < k` (the recess is blind — head metal remains below its floor; measured against the
   cone/cylinder height `k`, conservative for domed/raised crowns which add material above).
7. `tip_chamfer` validated by `_screw_shank` (`0 < tip_chamfer < d_shank/2`, `< length`).
8. Final `part.volume > 0` and `len(part.solids()) == 1` (head + shank fused into one solid).

## Data

New `catalog/dimensions/slotted_screws.json`. Shape =
`{head, drive, dk, k, length, d_shank, drive_w, drive_t, crown_r?, dome_r?, raised_f?, drive_m?,
tip_chamfer?}`.

- **Seven bases** (one per row of the matrix table above) + **six aliases** (`iso1207`, `iso1580`,
  `iso2009`, `iso2010` alias the DIN slotted bases; `din7985`, `din965` alias the ISO cross bases).
  `alias_of` targets a base, never another alias. `iso7047` has no alias.
- **Sourcing gate (at the data task):** the **envelope** dims `dk`, `k`, `length`, `d_shank`
  confirmed against **≥2 independent public tables** per standard; drive and crown/dome/raised
  fields tabulated where the standard defines them, else documented as representative:
  - `dk`, `k` — head diameter and height, tabulated per standard at M10.
  - `d_shank = 10.0` (M10 nominal major diameter). `length` — a representative catalog length,
    documented as chosen (M10 machine screws stock a wide range).
  - `drive_w`, `drive_t` — slot width `n` and depth `t` tabulated (slotted standards); for the
    cross bases these are the recess arm width and penetration, derived from the ISO 4757 cross
    gauge for the M10 driver size (Phillips/Pozidriv ≈ size 2), documented as representative.
  - `drive_m` (cross only) — the recess overall diameter at the surface, from the same gauge.
  - `dome_r` (pan/raised) — the head/crown spherical radius; tabulated where given, else a
    representative crown that matches the tabulated `dk`/`k`.
  - `raised_f` (raised only) — the raised-lens height above the cone top, tabulated where given.
  - `crown_r` (cheese) — a small representative top-edge break.
- `source` strings cite only public tables — never a private catalogue (no `reyher`, `stalmut`);
  `verified: true` only after the cross-check. Perplexity and the Playwright MCP may read tables
  that live in PDFs at the data task.
- Every `source` states M10 (not M12) and why (M12 exceeds the standards' range), and flags each
  field as tabulated vs representative.

## Registration & render

- `catalog/models/_registry.py`: add `"slotted_screw": slotted_screw` to `KNOWN_FAMILIES`
  (+ import), after `set_screw`. No shared helper added; the generator reuses only
  `_screw_shank`.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("screw")` → `DEFAULT_AXIS_Z`. The alias two-pass handles the alias ids.

## Testing

Generator geometry tests use **synthetic** fixtures (geometrically valid, not any real standard);
real dimensions come from the sourcing pass at the data task.

- `catalog/tests/test_slotted_screw.py` (generator; a 3D point-probe helper):
  - **Envelope:** bbox Z (axis) covers head + shank; head X/Y extent = `dk`; `volume > 0`.
  - **Head discriminates:** `countersunk` removes the outer material a `cheese` cylinder keeps at
    mid-head height (void where cheese is solid); `pan`/`raised` leave material above `z=k` on the
    axis (the crown/lens) where `cheese`/`countersunk` are empty; each head differs from `cheese`
    by a targeted probe and/or a volume delta.
  - **Drive discriminates & is blind:** `slot` leaves a void spanning the top edge-to-edge but
    solid below the slot floor; `cross` leaves a four-arm void (probe on an arm axis = void, probe
    on a 45° diagonal between arms at the same radius = solid) and solid below the recess floor;
    both leave solid head metal below the floor.
  - **Single solid:** `len(part.solids()) == 1` for every head × drive combination.
  - **Guards** each raise (unknown head; unknown drive; `d_shank ≥ dk`; `pan` without `dome_r`;
    `raised` without `raised_f`; `cross` without `drive_m`; `drive_w ≥ drive_m`; `drive_t ≥ k`;
    non-positive dims); a valid config of every head × drive builds `volume > 0`.
- `catalog/tests/test_slotted_screws_data.py` (data): every entry validates + builds; the six
  aliases resolve to their bases; `family`/`hardwareType`/`head`/`drive` as expected; sourced +
  `verified`; no forbidden source token; `iso7047` has no alias.
- Existing tests stay green; existing SVGs stay byte-identical (a new self-contained generator; no
  shared code touched beyond consuming `_screw_shank`).

## Rollout / invariants

- **Opt-in 0/0.** In-container only (`./catalog/run`; pre-warm the image once). Build produces
  **7 new drawings** (din84, din85, din963, din966, iso7045, iso7046, iso7047) + 6 aliases
  (no new files); no existing drawing changes (byte-identical). `image-mappings.json` and
  `src/lib/data/standards-generated.ts` stay untouched (`grep -c '.svg'` → 0 for both).
- Build entrypoint in-container: `python -m catalog.build_catalog`. If `manifest.json` shows a
  whitespace-only rebuild reformat with content-identical entries → `git checkout` it.
- Convention: TDD → commit → push → PR → zen review (`deepseek/deepseek-v4-pro`, thinking=high — a
  new generator on a shared surface) → apply findings as additional commits → CI green →
  squash-merge (admin). Visual confirmation of all seven drawings before merge — each head reads
  correctly (cheese / pan / countersunk / raised), each drive reads correctly (slot / cross), and
  the M10 parts frame acceptably under `DEFAULT_AXIS_Z`.

## Global constraints (verbatim)

- Representative size **M10** (deliberate deviation from the epic M12, because M12 exceeds these
  standards' dimensional ranges). Ships din84, din85, din963, din966, iso7045, iso7046, iso7047 +
  aliases iso1207, iso1580, iso2009, iso2010, din7985, din965.
- Every committed **envelope** dimension (`dk`, `k`, `length`, `d_shank`) confirmed by **≥2
  independent public tables**; drive-, dome-, and crown-specific and representative fields
  documented as such, never fabricated as normative. Head shape and drive verified against the
  tables; the cross recess is a representative tapered-pyramidal icon, not ISO 4757.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- A new self-contained generator; do **not** modify `socket_screw`, `set_screw`, or any existing
  generator, and add **nothing** to `screw_common` (only consume `_screw_shank`); existing SVGs
  byte-identical.
- **No render/preset change** (verified at build). Smooth envelope cylinder shank (no thread).
- opt-in invariant 0/0 after build.
