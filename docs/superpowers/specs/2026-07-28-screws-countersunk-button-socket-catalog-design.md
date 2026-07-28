# Countersunk + Button Socket Screw Coverage (screw gap, family 6) — Design

**Date:** 2026-07-28
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — increasing coverage; sixth screw-gap family
**Predecessors:** plain hex bolts #123 (85→73), structural/fit hex bolts #124 (73→63),
socket low-head + Torx cheese #125 (63→57), plain studs #126 (57→51), carriage/cup-head bolts
#127 (51→46)

## Context

`coverage.py` reports 46 app-served `screw` standards with no generated drawing. This spec covers
two **hex-socket screws whose heads are not the plain cylinder** the existing `socket_screw`
generator already draws: a **countersunk (flat 90° cone) head** (DIN 7991 / ISO 10642) and a
**button (low spherical dome) head** (ISO 7380). Both carry the same hex drive socket as the
existing socket-head cap screws, so this is an **extension of `socket_screw`**, not a new module.

The existing `socket_screw` already discriminates the drive recess on a `drive` parameter
(`"hex"` / `"lobular"`). This family adds a parallel `head` parameter (`"cylindrical"` /
`"countersunk"` / `"button"`) so one generator draws all socket-head screw shapes. The two new
head profiles **compose existing idioms** rather than inventing geometry: the countersunk cone
reuses the `carriage_bolt` countersunk-cone revolve, and the button dome reuses the `cap_nut` /
cup-carriage spherical-cap technique. The hex-socket cut and its guards are reused verbatim.

## Shape fidelity (why the geometry is what it is)

Classified against named public tables (Fuller Fasteners, Intafast, Brighton-Best, fasteners.eu,
plus vendor DIN 7991 / ISO 7380 datasheets). The candidate socket-screw ids in the gap split by
head shape:

| ids                             | head                        | in scope? |
| ------------------------------- | --------------------------- | --------- |
| `din7991` `din7991i` `iso10642` | **countersunk 90° cone**    | **yes**   |
| `iso7380`                       | **button spherical dome**   | **yes**   |
| `iso7379`                       | cylindrical + shoulder      | deferred  |
| `iso7412` `iso7412p`            | (structural hex bolt image) | excluded  |

- **Countersunk head (DIN 7991 / ISO 10642)** — a right circular cone, 90° included angle, with a
  flat flush top face and a hex socket cut into the top. Confirmed flat-top conical head (Fuller
  Fasteners DIN 7991 + Brighton-Best + Intafast DIN 7991 / ISO 10642 drawing).
- **Button head (ISO 7380-1)** — a low spherical dome with a flat bearing underside (a small
  cylindrical base belt) and a hex socket in the top. Confirmed dome profile from ISO 7380-1
  vendor tables.
- **`iso7379` shoulder screw** is deferred: it is a _cylindrical_ head over a precision shoulder
  wider than the thread — a stepped shank, a third distinct geometry unrelated to countersunk or
  button heads. It belongs to a later shoulder-screw family, not this one.
- **`iso7412` / `iso7412p`** are excluded: their app image is `din_6914.png` (a structural HV hex
  bolt), so they are not socket screws at all — grouped elsewhere.

## The 4 ids

| id         | standard  | head             | maps to                             |
| ---------- | --------- | ---------------- | ----------------------------------- |
| `din7991`  | DIN 7991  | countersunk cone | **NEW base** (`head:"countersunk"`) |
| `din7991i` | DIN 7991  | countersunk cone | alias `din7991`                     |
| `iso10642` | ISO 10642 | countersunk cone | alias `din7991`                     |
| `iso7380`  | ISO 7380  | button dome      | **NEW base** (`head:"button"`)      |

Two new drawings (`din7991.svg`, `iso7380.svg`). ISO 10642 is the ISO twin of DIN 7991 (same
`din_7991.png` image, same countersunk envelope) so it aliases `din7991`; `din7991i` is the app's
image-variant key. Screw gap **46 → 42**.

## Generator design (`socket_screw.py`, Approach A)

Add an optional `head: str = "cylindrical"` parameter (keyword-defaulted, so existing entries that
never pass it are unaffected) and a `_HEAD_SHAPES = ("cylindrical", "countersunk", "button")`
guard. The single `Cylinder(radius=dk/2, height=k, …)` that builds the head today becomes three
branches; everything below it (add shank, cut hex/lobular socket, volume + single-solid guards) is
unchanged.

- **`"cylindrical"`** (default) — the existing `Cylinder` path, byte-for-byte unchanged.
- **`"countersunk"`** — revolve an XZ frustum profile from bottom radius `d_shank/2` at z=0 up to
  top radius `dk/2` at z=`k`, with a flat top at z=`k` (the `carriage_bolt` countersunk-cone
  idiom). Using tabulated `dk` and `k` directly makes the slant approximate the nominal 90°; the
  exact cone angle is a representative envelope simplification (flagged in the source string). The
  frustum's bottom disc radius = `d_shank/2` so it fuses to the shank at z=0.
- **`"button"`** — build a spherical cap of base radius `dk/2` at z=0 and apex at z=`k`
  (`sphere_r = ((dk/2)**2 + k**2) / (2*k)`, centre at z=`k − sphere_r`, trimmed below z=0), the
  `cap_nut` / cup-carriage idiom. The small cylindrical base belt of a real button head is omitted
  as an envelope simplification (flagged), exactly as the cup carriage head omits it.

The hex-socket cut sketches at the socket floor plane and subtracts upward through the top face; it
works unchanged for a flat cone top or a domed top (the cutter pokes `_RECESS_EPS` past the top).
Existing guards hold for the new heads: `d_shank < dk`; the wall check vs `dk/2` (the widest head
radius, conservative for the button whose top is narrower); and the blind-floor check
`socket_depth < k`.

## Data (`socket_screws.json`, additive)

Add to the existing `socket_screws.json` (which already holds `iso4762`, `din912`, `iso14579`,
`din6912`, `din7984`, `iso14580`, and their aliases):

- **`din7991`** — new base, `family:"socket_screw"`, `head:"countersunk"`, `drive:"hex"`.
  Representative M12 shape (sourced in Task 2): `dk` 24.0, `k` 6.5, `socket_af` 8.0,
  `socket_depth` ~3.5 (blind, < k), `d_shank` 12.0, `length` 60.0 representative, `tip_chamfer`
  1.0. `hardwareType:"screw"`, `verified:true`, designations `{DIN, 7991}`.
- **`din7991i`** — `alias_of: din7991` (image-variant key), designations `{DIN, 7991}`.
- **`iso10642`** — `alias_of: din7991` (ISO twin, same countersunk envelope), designations
  `{ISO, 10642}`.
- **`iso7380`** — new base, `family:"socket_screw"`, `head:"button"`, `drive:"hex"`.
  Representative M12 button shape (sourced in Task 2): `dk`, `k`, `socket_af`, `socket_depth`,
  `d_shank` 12.0, `length` 60.0, `tip_chamfer` 1.0. `hardwareType:"screw"`, `verified:true`,
  designations `{ISO, 7380}`.

Every alias targets the real non-alias base `din7991` (no chaining).

## Design decisions / tradeoffs

- **Extend `socket_screw` (Approach A)** rather than a new module. The hex/lobular socket cut and
  its wall/floor guards are the genuinely shared logic; a standalone generator would either
  duplicate them (DRY loss) or force factoring a helper out of `socket_screw` (still edits the
  shared file, and splits one "socket-head screw" family across two modules). A defaulted `head`
  param keeps the family coherent, mirrors the existing `drive` param, and keeps existing SVGs
  byte-identical.
- **`din7991` is the base for the countersunk group; `iso7380` is its own base.** DIN 7991 and ISO
  10642 are the same countersunk hex-socket screw (ISO 10642 is the ISO equivalent, "reduced
  loadability", drawn to the same `din_7991.png` image at envelope scale), so the three countersunk
  ids collapse to one drawing. ISO 7380 is a different head (button dome) so it is a separate
  drawing.
- **Representative sizes flagged.** Exact M12 values are confirmed in Task 2 against ≥2 named public
  tables. The ISO 7380 button dimensions especially are re-confirmed there (vendor tables vary; the
  brainstorm values were flagged as inferred). `length` and `tip_chamfer` are representative, as in
  every prior screw family. The countersunk cone's exact 90° angle and the button's omitted base
  belt are flagged envelope simplifications.

## Invariants (verbatim, epic-wide)

- **Generate-only:** do NOT touch `data/image-mappings.json` or `src/lib/data/standards-generated.ts`;
  do NOT run `catalog/integrate.py`.
- **Additive:** manifest gains only `din7991` and `iso7380` (+ the two aliases resolve to bases);
  all existing SVGs are byte-identical after rebuild (verified by rebuild + `git diff`); manifest
  whitespace churn normalized with `pnpm exec prettier --write catalog/out/manifest.json`.
- **Sourcing:** every committed dimension confirmed by ≥2 named public tables; representative fields
  flagged; source strings contain NO `reyher` / `stalmut` tokens; `verified:true` only after
  cross-check.
- **Aliases never chain:** `din7991i` and `iso10642` target the real base `din7991`.
- **Container-only:** all build123d runs via `./catalog/run`.

## Testing

- **Generator (`test_socket_screw.py`)** — new cases:
  - countersunk head: solid at the wide flat top rim near z=`k`, void just above the top face,
    material narrowing toward the shank lower down;
  - button head: domed over the axis (solid just below the apex, void just above it);
  - both new heads still cut a single fused solid (`len(solids()) == 1`) with a hex socket present
    (void on the axis at the top face);
  - a `head` guard rejecting an unknown value;
  - existing cylindrical cases remain (regression: default `head` unchanged).
- **Data (`test_socket_screws_data.py`)** — new cases: `din7991` head==countersunk & drive==hex,
  `iso7380` head==button & drive==hex, aliases resolve to a real non-alias base (no chaining),
  every entry `hardwareType:"screw"` + `verified:true` with a non-empty source, no forbidden
  (`reyher`/`stalmut`) tokens.

## Success criteria

- `din7991.svg` renders a flat-top conical (countersunk) head with a hex socket over a round shank;
  `iso7380.svg` renders a low domed (button) head with a hex socket over a round shank; both read
  distinctly from the existing cylindrical `iso4762` cap.
- `coverage.py` screw gap drops 46 → 42 (`din7991`, `din7991i`, `iso10642`, `iso7380` covered).
- Every existing socket-screw SVG byte-identical after rebuild.
- Full catalog test suite green.
