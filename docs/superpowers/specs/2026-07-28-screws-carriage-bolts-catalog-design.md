# Carriage / Cup-Head Bolt Coverage (screw gap, family 5) — Design

**Date:** 2026-07-28
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — increasing coverage; fifth screw-gap family
**Predecessors:** plain hex bolts #123 (85→73), structural/fit hex bolts #124 (73→63),
socket low-head + Torx cheese #125 (63→57), plain studs #126 (57→51)

## Context

`coverage.py` reports 51 app-served `screw` standards with no generated drawing. This spec covers the
**square-neck carriage bolts** — headless-of-drive bolts with an anti-rotation **square neck**
(Vierkantansatz) directly under the head. Two head shapes are in scope: a **cup / mushroom dome**
(DIN 603 / ISO 8677) and a **countersunk cone** (DIN 605). Both carry the same square neck, so one
new generator with a `head` parameter draws both.

This is a new generator (like family 4's `stud`), not a reuse. But it **composes existing idioms**
rather than inventing geometry: the dome reuses the `cap_nut` spherical-cap technique, the square
neck reuses the `square_nut` extruded-square-prism technique, and the round shank reuses
`screw_common._screw_shank`. The only genuinely new profile is the countersunk cone frustum, which is
a straight revolve.

## Shape fidelity (why the geometry is what it is)

Classified against named public tables (fasteners.eu, Schrauben-Lexikon, Vipa, Fuller, RS, plus the
DIN 603/605/604/607 vendor pages). The nine carriage-type ids in the gap split across **two head
shapes × two anti-rotation features**:

| ids                                     | head                | anti-rotation     | in scope? |
| --------------------------------------- | ------------------- | ----------------- | --------- |
| `din603` `din603i` `iso8677` `iso8677p` | cup / mushroom dome | **square neck**   | **yes**   |
| `din605`                                | countersunk cone    | **square neck**   | **yes**   |
| `din604` `din604d`                      | countersunk cone    | nib (single nose) | deferred  |
| `din607` `din607d`                      | cup dome            | nib (single nose) | deferred  |

- **Square neck** is a clean, four-fold-symmetric envelope feature (a square collar under the head).
- **Nib** (Nase) is a single small asymmetric lug that breaks axial symmetry — fiddly to model
  faithfully and low-value at drawing scale. Modelling it wrong is exactly the shape-fidelity trap the
  epic warns about, so `din604`/`din607` are deferred to a later "carriage nib" family rather than
  drawn as plain (nib-less) heads (which would lose the anti-rotation feature entirely).

## The 5 ids

| id         | standard | head                 | maps to                             |
| ---------- | -------- | -------------------- | ----------------------------------- |
| `din603`   | DIN 603  | cup + square         | **NEW base** (`head:"cup"`)         |
| `din603i`  | DIN 603  | cup + square         | alias `din603`                      |
| `iso8677`  | ISO 8677 | cup + square         | alias `din603`                      |
| `iso8677p` | ISO 8677 | cup + square         | alias `din603`                      |
| `din605`   | DIN 605  | countersunk + square | **NEW base** (`head:"countersunk"`) |

Two new drawings (`din603.svg`, `din605.svg`). ISO 8677 is the ISO twin of DIN 603 (same envelope) so
it aliases `din603`; the `…i` / `…p` suffixes are the app's image-variant keys.

## Design decisions / tradeoffs

- **din603 is the base for the cup+square group; din605 is its own base.** DIN 603 / ISO 8677 are the
  same mushroom-head square-neck bolt (the ISO 8677 = DIN 603 equivalence is standard), so the four
  ids collapse to one drawing. DIN 605 has a different head (countersunk cone) so it is a separate
  drawing. Every alias targets the real non-alias base `din603` (no chaining).
- **One generator, `head` parameter.** `head:"cup"` draws a spherical cap; `head:"countersunk"` draws
  a cone frustum. Both share the square-neck + shank stack, so the two bases differ only in the head
  profile — the same "one generator, head selects the silhouette" pattern as `set_screw` (point) and
  `slotted_screw` (head).
- **Nib variants deferred, not drawn as plain heads.** `din604`/`din607` keep the head but drop the
  square; drawing them without their nib would misrepresent them as plain dome/countersunk bolts, so
  they are documented non-goals.
- **Square neck ≈ nominal diameter.** The square across-flats `square_w` is about the shank major
  diameter (M12 → ~13 mm); its corners fuse with the round shank into one solid.

## Architecture

- **New generator** `catalog/models/carriage_bolt.py`:

  ```
  carriage_bolt(d, length, dk, k, head, square_w, square_depth, tip_chamfer=None)
  ```

  Stacked along Z with the z=0 seam at the shank top / square-neck bottom:
  - **Shank** (`screw_common._screw_shank(d, length, tip_chamfer)`): round cylinder Ø`d`,
    `z ∈ [−length, 0]`, optional 45-degree lead chamfer at the free end.
  - **Square neck**: an extruded square prism (across-flats `square_w`), `z ∈ [0, square_depth]`,
    fused with the shank top at z=0 (`square_nut` idiom).
  - **Head** above `z = square_depth`:
    - `"cup"`: a spherical cap (`cap_nut` idiom) with base circle Ø`dk` at the neck top, apex at
      `z = square_depth + k` (shallow dome overhanging the square).
    - `"countersunk"`: a cone frustum, Ø`dk` at the top face (`z = square_depth + k`) narrowing to
      ≈`square_w` at the neck top (`z = square_depth`) — a revolve of a trapezoidal meridian.
  - **Guards:** `d, length, dk, k, square_w, square_depth > 0`; `head in {"cup","countersunk"}`;
    `dk > square_w` (the head must overhang the neck); `tip_chamfer` delegated to `_screw_shank`. Net
    `volume > 0` (not `is_valid` — sewn-shell gotcha) and exactly one solid.

- **Registry:** add `carriage_bolt` to `_registry.KNOWN_FAMILIES` (import + map entry). No change to
  `build_part`.

- **New dimension file** `catalog/dimensions/carriage_bolts.json` with the 5 entries:
  - `din603` (base): `family:"carriage_bolt"`, `shape:{ d, length, dk, k, head:"cup", square_w, square_depth, tip_chamfer }`.
  - `din605` (base): `shape:{ ..., head:"countersunk", ... }`.
  - `din603i`, `iso8677`, `iso8677p`: `alias_of:"din603"`.
  - Each entry: `hardwareType:"screw"`, `verified:true`, `designations`, `source`.

- Build renders **two** new SVGs (`din603.svg`, `din605.svg`); the 3 aliases reuse `din603.svg`.

## Representative size

**M12** (the epic default). Confirmed at the sourcing gate against ≥2 named tables:

- `din603` (cup+square): `dk ≈ 30`, `k ≈ 7` (dome height), `square_w ≈ 13`, `square_depth ≈ 5`.
- `din605` (countersunk+square): `dk ≈ 24–26`, `k ≈ 7` (cone height above the square), `square_w ≈ 13`,
  `square_depth ≈ 8` (DIN 605 has a taller square).
- Both: `d = 12.0` (M12 major), `length = 60.0` and `tip_chamfer = 1.0` (representative, flagged).

Exact values are set at the sourcing gate and handed to the implementer verbatim; representative
fields (`length`, `tip_chamfer`, and the countersunk cone bottom radius) are flagged in the source.

## Data / sourcing

All entries live in the new `catalog/dimensions/carriage_bolts.json`.

- **Sourcing gate (controller, before the data task):** confirm against ≥2 named public tables each:
  DIN 603 / ISO 8677 M12 `dk`, `k`, square across-flats and depth (fasteners.eu DIN 603 + Schrauben-
  Lexikon DIN 603 + a manufacturer M12 table); DIN 605 M12 `dk`, `k`, square (Vipa DIN 605 + Fuller /
  Krepcom DIN 605 + the DIN 605 vendor table). Provide the implementer both base shapes and all 5
  `source` strings verbatim.
- `source` strings cite only public tables — never a private catalogue (**no** `reyher`, `stalmut`).
  Representative fields (`length`, `tip_chamfer`, cone bottom radius) are flagged. Alias `source`
  strings state the shared envelope and which base they alias (ISO 8677 = DIN 603 equivalence).
- `verified: true` only after the cross-check. `hardwareType: "screw"` on every entry.

## Non-goals

- **No nib variants.** `din604`/`din604d` (countersunk + nib) and `din607`/`din607d` (dome + nib)
  need an asymmetric-lug feature and their own shape-fidelity sourcing. A later family.
- **No thread, no drive.** Carriage bolts have no drive recess (they are held by the square neck); the
  shank is the plain envelope (no drawn thread), consistent with the epic.
- **No app integration** beyond generation: `data/image-mappings.json` and
  `src/lib/data/standards-generated.ts` stay untouched; `integrate.py` is not run.

## Testing

Two new files, house style:

- `catalog/tests/test_carriage_bolt.py` — generator unit tests:
  - Envelope extents for a cup bolt: `bb.size.X == dk` (head is the widest), total height
    `≈ length + square_depth + k`, `min.Z == −length`, `volume > 0`.
  - Cup vs countersunk head discrimination: the cup apex has material near the axis at the top; the
    countersunk head is widest at its top face and narrows downward (probe the outer radius at the top
    vs just below).
  - Square-neck presence: material at a square corner (radius `square_w·√2/2` off-axis at a neck z)
    that would be void for a round neck of diameter `square_w`.
  - Exactly one solid; guards raise `ValueError` (bad `head`, `dk <= square_w`, non-positive dims).

- `catalog/tests/test_carriage_bolts_data.py` — data sweep:
  - Validate + build every entry (non-alias builds a solid).
  - `family == "carriage_bolt"` and `hardwareType == "screw"` on every entry.
  - `din603` is a real base with `head == "cup"`; `din605` is a real base with `head == "countersunk"`;
    both carry a `square_w`/`square_depth`.
  - Alias map asserts `din603i`, `iso8677`, `iso8677p` resolve to the real non-alias base `din603`
    (no chaining) and carry `hardwareType == "screw"`.
  - Every entry sourced (`len(source) >= 3`) and `verified is True`.
  - No `source` names a private catalogue (`reyher`, `stalmut`).

## Rollout / invariants

- **Generate-only.** In-container (`./catalog/run`). Build produces **2 new drawings**
  (`din603.svg`, `din605.svg`) + 3 aliases (no new files); no existing drawing changes
  (byte-identical). `data/image-mappings.json` and `src/lib/data/standards-generated.ts` stay
  untouched (`grep -c '.svg'` on the diff → 0); `integrate.py` not run.
- **Coverage check:** after the build, `coverage.check(manifest, image_mappings, "screw")` no longer
  lists the 5 ids — the screw gap drops from **51 to 46**. (The `coverage.py` CI gate enforces only
  `washer`; the screw improvement is measured, not gated.)
- If `manifest.json` shows whitespace-only rebuild reformat, normalise with prettier so the committed
  diff is only the two new entries.
- Convention: TDD → commit → push → PR → zen review (`deepseek/deepseek-v4-pro`, thinking=high) →
  apply findings as commits → CI green → squash-merge (admin). Visual confirmation of both new SVGs
  before merge: `din603` a mushroom-dome head over a square collar over a round shank; `din605` a
  countersunk cone over a (taller) square collar over a round shank.

## Global constraints (verbatim)

- Add a new generator `carriage_bolt` (register it) + a new `carriage_bolts.json`; add 2 bases
  (`din603` cup, `din605` countersunk) + 3 aliases. Compose existing idioms (`cap_nut` sphere-cap,
  `square_nut` square extrude, `_screw_shank`); the only new profile is the countersunk cone.
- Representative size **M12**. Each envelope dim confirmed by **≥2 named public tables** at the
  sourcing gate; representative fields (`length`, `tip_chamfer`, cone bottom radius) flagged.
- Aliases never chain (target `din603`, the real base). `hardwareType: "screw"` on every entry.
  `verified: true` only after cross-check.
- Source strings: **no** `reyher`, `stalmut`, or any private catalogue.
- **Generate-only:** do not modify `data/image-mappings.json` or `src/lib/data/standards-generated.ts`;
  do not run `integrate.py`. Existing SVGs byte-identical.
- No render/preset change.
