# Hex-Socket Set Screw (Grub Screw) Family Catalog — Design (third screw family)

**Date:** 2026-07-20
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — sub-family (headless set / grub screws), after A hex-head bolts and B hex-socket cap screws
**Predecessors:** …hex-head bolt (#110), socket-head cap screw (#111)

## Category context

The socket-cap family (#111) introduced the blind hex drive socket cut into a head's top face,
parametrised by drive style. This family reuses that **pattern** for a headless part: a
grub/set screw is a plain threaded cylinder (envelope-only) with a hex socket in one end and a
**point** (tip) at the other. The point is the identifying feature — the four standards differ
only by point shape — so `point` is parametrised the way `socket_screw` parametrised `drive` and
`lock_nut` parametrised its top feature.

**Reuse decision (settled):** a **new** generator `set_screw`, with the small blind hex-socket
cut **reimplemented locally** (a ~4-line build123d idiom: `RegularPolygon(major_radius=False)` →
`extrude(SUBTRACT)`). It does **not** import from or modify the just-merged `socket_screw.py`,
preserving the byte-identical invariant and the "do not modify existing generators" rule. The
reuse is conceptual (same recess idiom), not a code dependency. (Extracting a shared recess
helper into `screw_common` and refactoring `socket_screw` was considered and rejected: it
reopens a byte-locked file for a 4-line idiom — not worth the regression risk.)

## Goal

Add a **hex-socket set screw (grub screw)** family (`set_screw`) at a representative **M12 × 30**,
shipping the four standards distinguished by point type, each with its ISO alias:

- **`din913`** flat point + **`iso4026`** alias
- **`din914`** cone point + **`iso4027`** alias
- **`din915`** dog point + **`iso4028`** alias
- **`din916`** cup point + **`iso4029`** alias

A set screw = a headless cylinder of diameter `d` (major dia, envelope-only, no drawn thread),
with a blind hex socket in the top (+Z) end and a point feature at the bottom (−Z) end.

## Non-goals

- **No drawn thread.** Smooth major-diameter cylinder (inherited envelope rule).
- **No slotted-drive set screws** (DIN 551/553/417/438) — those swap the hex socket for a straight
  slot; a separate future family or a later `drive` parameter.
- **No new preset.** Axis-along-Z → `DEFAULT_AXIS_Z` (confirmed at build).
- **No modification to `socket_screw.py` / `screw_common.py`.** The hex-socket idiom is local.
- **No sizes beyond the M12 × 30 representative.** No user-facing toggle (epic END goal).

## Silhouette to match

| Standard (DIN / ISO) | Point | End view (down Z) | Side elevation                                   |
| -------------------- | ----- | ----------------- | ------------------------------------------------ |
| din913 / iso4026     | flat  | hexagon socket    | plain cylinder, flat end                         |
| din914 / iso4027     | cone  | hexagon socket    | cylinder tapering to a small flat cone tip       |
| din915 / iso4028     | dog   | hexagon socket    | cylinder with a narrower cylindrical dog pilot   |
| din916 / iso4029     | cup   | hexagon socket    | cylinder with a concave cupped end (annular rim) |

- **End view** (front, down the Z axis): the head-less cylinder circle with the **hexagon socket**
  outline concentric inside it (same for all four — the socket end is identical).
- **Side elevation** (side, axis horizontal): the cylinder body with the point at the free end.
  The point is what discriminates the four drawings.

## Architecture

**Generator — new `catalog/models/set_screw.py`:**

```python
def set_screw(d, length, socket_af, socket_depth, point,
              point_h=None, point_d=None, tip_chamfer=None):
    ...
```

- **Body + point:** built by revolving a point-specific outer meridian in the XZ plane about Z, so
  the body and its point are one solid (deterministic — no fragile edge selection, same technique
  as `_screw_shank` and the `lock_nut` cone). Body occupies `z∈[0, length]`; the point is at the
  `z=0` (bottom) end, the socket opens at the `z=length` (top) end.
  - `flat` (din913): meridian is a plain rectangle `(0,length)-(d/2,length)-(d/2,0)-(0,0)`;
    optional 45° edge break of leg `tip_chamfer` at the bottom outer corner.
  - `cone` (din914): the bottom `z∈[0, point_h]` tapers from `d/2` to a small flat tip radius
    `point_d/2`: meridian `…-(d/2,point_h)-(point_d/2,0)-(0,0)`.
  - `dog` (din915): a narrower cylindrical dog of radius `point_d/2` and length `point_h` below a
    flat shoulder: meridian `…-(d/2,point_h)-(point_d/2,point_h)-(point_d/2,0)-(0,0)`.
  - `cup` (din916): body is the plain rectangle (like flat); a shallow **cone recess** of mouth
    diameter `point_d` and depth `point_h` is then **subtracted** from the bottom face, leaving an
    annular cup rim.
- **Hex socket:** a blind socket cut from the top face (`z=length`) down by `socket_depth`
  (`BuildSketch` on `Plane.XY.offset(length - socket_depth)`, `RegularPolygon(radius=socket_af/2,
side_count=6, major_radius=False)` — across-flats `socket_af`, `extrude(socket_depth + eps,
mode=SUBTRACT)`). Local idiom; not imported from `socket_screw`.
- Net guards: `part.volume > 0` and `len(part.solids()) == 1` (one fused solid).
- `hardwareType: "screw"` → `DEFAULT_AXIS_Z`. No preset change.

Representative **M12** (confirm the point fields at the sourcing gate): `d=12`, `length=30`,
`socket_af=6.0`, `socket_depth=4.5`. **Key-size confirmed** already: M12 hex-socket set screws
take a **6 mm** hex key (NOT the 10 mm of an M12 cap screw) and socket depth `t≈4.5 mm` — verified
against fasteners.eu (DIN 916 + ISO 4029 tables) and the Aspen Fasteners DIN 916 spec sheet.

### Drive-aware wall guard (lesson carried from socket_screw I1)

The hex socket's corners reach the circumradius `socket_af/√3 ≈ 0.577·socket_af`, further than the
apothem. The wall guard bounds the **circumradius** against the body wall:
`socket_af/√3 ≥ d/2 − _MIN_WALL_MM` raises. (`_MIN_WALL_MM = 0.1`, a local constant, as in
`socket_screw`.)

### Guards (ValueError)

1. `d, length, socket_af, socket_depth` all `> 0`.
2. `point ∈ {"flat", "cone", "dog", "cup"}` (else raise).
3. Wall guard: `socket_af/√3 ≥ d/2 − _MIN_WALL_MM` raises (socket sits within the body).
4. `cone`/`dog`/`cup` require `point_h, point_d > 0`; `point_d < d` (the tip/dog/cup mouth is
   narrower than the body). `flat` ignores `point_h`/`point_d`.
5. `point_h` (when used) `< length`, and `socket_depth < length − point_h` (the socket and the
   point feature do not collide — a solid core remains between them).
6. `tip_chamfer` (when given, `flat` only) `> 0` and `< d/2`.
7. Final `part.volume > 0` and `len(part.solids()) == 1`.

## Data

New `catalog/dimensions/set_screws.json`. Shape = `{d, length, socket_af, socket_depth, point,
point_h?, point_d?, tip_chamfer?}`.

| id     | family    | point | alias   |
| ------ | --------- | ----- | ------- |
| din913 | set_screw | flat  | iso4026 |
| din914 | set_screw | cone  | iso4027 |
| din915 | set_screw | dog   | iso4028 |
| din916 | set_screw | cup   | iso4029 |

- **Four bases** (one per point silhouette) + **four ISO aliases** (ISO 4026-4029 share the DIN
  M12 envelope; only the standard number differs). `alias_of` targets a base, never another alias.
- **Sourcing gate:** `d`, `length`, `socket_af`, `socket_depth` confirmed against **≥2 independent
  public tables** (key size already confirmed: `socket_af=6.0`, `socket_depth≈4.5`). The
  point-specific fields are tabulated where the standard defines them and confirmed at the data
  task, documented in `source` as tabulated vs representative:
  - cone (din914): cone angle (90° for M12; representative `point_h`) + flat tip `point_d`.
  - dog (din915): dog diameter `dp` (`point_d`) + dog length `z` (`point_h`) — both tabulated.
  - cup (din916): cup mouth diameter `dv` (`point_d`, ≈7.6 for M12 per Aspen) + representative cup
    depth `point_h`.
  - flat (din913): plain end, optional representative `tip_chamfer`.
- `source` strings cite only public tables — never a private catalogue (no `reyher`, `stalmut`);
  `verified: true` only after the cross-check. `length=30` is a representative catalog length,
  documented as chosen.
- Perplexity and the Playwright MCP may be used to read point-dimension tables that live in PDFs
  at the data task.

## Registration & render

- `catalog/models/_registry.py`: add `"set_screw": set_screw` to `KNOWN_FAMILIES` (+ import), after
  `socket_screw`. (No shared helper added; the generator is self-contained.)
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("screw")` → `DEFAULT_AXIS_Z`. The alias two-pass handles the ISO ids.

## Testing

Generator geometry tests use **synthetic** fixtures (geometrically valid, not any real standard);
real dimensions come from the sourcing pass at the data task.

- `catalog/tests/test_set_screw.py` (generator; a 3D point-probe helper):
  - **Envelope:** bbox Z (axis) = `length`; body extent on X/Y = `d`; `volume > 0`.
  - **Socket blind, opens from top:** void on the axis just below the top face; solid below the
    socket floor (`length − socket_depth`); solid on the axis in the mid-body.
  - **Each point discriminates:** `cone` removes the bottom outer corner (void where `flat` is
    solid); `dog` leaves material on the axis below the shoulder but void in the outer ring there;
    `cup` leaves void on the axis at the very bottom (the recess) but solid in the outer rim —
    each point differs from `flat` (e.g. by a volume delta and a targeted probe).
  - **Single solid:** `len(part.solids()) == 1` for every point.
  - **Guards** each raise (unknown point; wall guard via oversized `socket_af`; `socket_depth`
    colliding with `point_h`; `point_d ≥ d`; non-positive dims); a valid config of each point
    builds `volume > 0`.
- `catalog/tests/test_set_screws_data.py` (data): every entry validates + builds; the four ISO
  aliases resolve to their DIN bases; `family`/`hardwareType`/`point` as expected; sourced +
  `verified`; no forbidden source token.
- Existing tests stay green; existing SVGs stay byte-identical (a new self-contained generator; no
  shared code touched).

## Rollout / invariants

- **Opt-in 0/0.** In-container only (`./catalog/run`; pre-warm the image once). Build produces
  **4 new drawings** (din913-916) + 4 aliases (iso4026-4029, no new files); no existing drawing
  changes (byte-identical). `image-mappings.json` and `src/lib/data/standards-generated.ts` stay
  untouched (`grep -c '.svg'` → 0 for both).
- Build entrypoint in-container: `python -m catalog.build_catalog`.
- Convention: TDD → commit → push → PR → zen review (`deepseek/deepseek-v4-pro`, thinking=high — a
  new generator on a shared surface) → apply findings as additional commits → CI green →
  squash-merge (admin). Visual confirmation of all four drawings before merge — each point reads
  correctly (flat / cone / dog / cup) and the M12×30 frames acceptably under `DEFAULT_AXIS_Z`.

## Global constraints (verbatim)

- Representative size **M12 × 30**. Ships din913-916 + iso4026-4029 (aliases).
- Every committed **envelope** dimension (`d`, `length`, `socket_af`, `socket_depth`) confirmed by
  **≥2 independent public tables**; point-specific and representative fields documented as such,
  never fabricated as normative. Shape (headless cylinder + hex socket + point) verified against
  the tables; the M12 hex key is **6 mm** (confirmed, not the cap-screw 10 mm).
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- A new self-contained generator; do **not** modify `socket_screw`, `screw_common`, or any existing
  generator; existing SVGs byte-identical.
- **No render/preset change** (verified at build). Smooth envelope cylinder (no thread).
- opt-in invariant 0/0 after build.
