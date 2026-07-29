# T-head / T-slot / Square-head Bolt Coverage (screw gap, family 7) — Design

**Date:** 2026-07-28
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — increasing coverage; seventh screw-gap family
**Predecessors:** plain hex bolts #123 (85→73), structural/fit hex bolts #124 (73→63),
socket low-head + Torx cheese #125 (63→57), plain studs #126 (57→51), carriage/cup-head bolts
#127 (51→46), countersunk + button socket #128 (46→42)

## Context

`coverage.py` reports 42 app-served `screw` standards with no generated drawing. This spec covers the
**prism-head bolts** — bolts whose head is a rectangular or square block rather than a hex, socket, or
round head: T-head bolts (DIN 261), T-head bolts with a square neck (DIN 186), T-slot bolts (DIN 787),
and square-head bolts with a collar (DIN 478). Every head here is a rectangular box (a square head is
the special case `len == width`), and the only under-head variation is a square anti-rotation neck, a
round bearing collar, or nothing. So this is **one new generator** that composes existing primitives.

The generator invents no geometry: the head is a `Box`, the square neck is a `Box`
(`under_size × under_size`), the collar is the `collar_nut` `Cylinder`, and the shank is the shared
`screw_common._screw_shank`. Fusion is face-contact `add()` (the same stacking seam the other screw
generators use), backstopped by a net `volume > 0` and single-solid guard.

## Shape fidelity (why the geometry is what it is)

Classified against public references (Schrauben-Lexikon, machine-tool T-slot supplier tables tied to
DIN 650 slot widths, square-head flange-bolt datasheets, plus the DIN 186/261/478/787 vendor pages):

| ids                | head                    | under-head feature | in scope? |
| ------------------ | ----------------------- | ------------------ | --------- |
| `din186` `din186p` | rectangular T-head      | **square neck**    | **yes**   |
| `din261` `din261d` | rectangular T-head      | none (fillet)      | **yes**   |
| `din787` `din787i` | rectangular T-slot head | none (fillet)      | **yes**   |
| `din478` `din478p` | **square** head         | **round collar**   | **yes**   |

- **T-head / T-slot head** (DIN 186, 261, 787) — a rectangular block (length ≠ width), symmetric about
  the shank axis; the end view is the distinctive rectangle. DIN 787 heads are sized to DIN 650 T-slots.
- **Square head + collar** (DIN 478) — a square prism head (length = width) over a round bearing collar
  (Bund) concentric with the shank.
- **Square neck** (DIN 186) — a square prism between the T-head and the shank; the anti-rotation feature
  (the same feature carriage bolts carry).
- The under-head fillet on DIN 261/787 is an envelope simplification: the head sits directly on the
  bearing plane (no drawn fillet), flagged.

**Sourcing risk (flagged for Task 2):** exact M12 dimensions for the structural T-head bolts (DIN 186,
DIN 261) sit behind paywalled DIN tables — public sources give proportions, not tabulated numbers. DIN
787 (machine-tool T-slot) and DIN 478 (square-head flange bolt) are better documented. The Task 2
sourcing gate confirms each committed dimension against ≥2 named public tables; any id that cannot be
sourced is **dropped or drawn at a sourceable representative size (flagged), never fabricated** — the
same precedent as the DIN 605 M10 drop in family 5. The final shipped set may therefore be fewer than
four bases.

## The ids (up to 8)

| id        | standard | head               | under-head   | maps to                              |
| --------- | -------- | ------------------ | ------------ | ------------------------------------ |
| `din186`  | DIN 186  | rectangular T      | square neck  | **NEW base** (`under:"square_neck"`) |
| `din186p` | DIN 186  | rectangular T      | square neck  | alias `din186`                       |
| `din261`  | DIN 261  | rectangular T      | none         | **NEW base** (`under:"none"`)        |
| `din261d` | DIN 261  | rectangular T      | none         | alias `din261`                       |
| `din787`  | DIN 787  | rectangular T-slot | none         | **NEW base** (`under:"none"`)        |
| `din787i` | DIN 787  | rectangular T-slot | none         | alias `din787`                       |
| `din478`  | DIN 478  | square             | round collar | **NEW base** (`under:"collar"`)      |
| `din478p` | DIN 478  | square             | round collar | alias `din478`                       |

Up to 4 new drawings (`din186.svg`, `din261.svg`, `din787.svg`, `din478.svg`), 4 aliases. Each `…p`/
`…d`/`…i` suffix is the app's image-variant key and aliases its own base (no chaining). Screw gap
**42 → 34** if all four ship. `din261` and `din787` are both rectangular no-under heads but are
separate bases if their tabulated head dimensions differ (like the family-3 din6912/din7984 split); the
sourcing gate confirms whether they are distinct drawings or one aliases the other.

## Generator design (`prism_head_bolt.py`)

```
prism_head_bolt(d, length, head_len, head_width, head_height,
                under="none", under_size=None, under_height=None, tip_chamfer=None)
```

- **Head:** `Box(head_len, head_width, head_height)`, centered in X/Y, its bottom on the under-head top
  plane. Square head = `head_len == head_width`.
- **Under-head feature** (`under`): `"none"` → head sits on z=0 (bearing plane); `"square_neck"` →
  `Box(under_size, under_size, under_height)` at z in [0, under_height]; `"collar"` →
  `Cylinder(radius=under_size/2, height=under_height)` at z in [0, under_height].
- **Shank:** `_screw_shank(d, length, tip_chamfer)`, z in [−length, 0], fuses at z=0.
- **Guards:** all of `d`, `length`, `head_len`, `head_width`, `head_height` > 0; `under` in
  `("none", "square_neck", "collar")`; when `under != "none"`, `under_size > 0` and `under_height > 0`;
  `d < min(head_len, head_width)` (shank narrower than the head); net `volume > 0`; `len(solids()) == 1`
  (head + under + shank must fuse to one solid).
- Register `prism_head_bolt` in `catalog/models/_registry.py`.

## Data (`prism_head_bolts.json`, new file)

Each entry `family:"prism_head_bolt"`, `hardwareType:"screw"`, `verified:true` (only after the sourcing
gate). Representative M12 shapes are set in Task 2 from the sourcing gate; the fields are
`d, length, head_len, head_width, head_height, under, under_size, under_height, tip_chamfer`. Aliases
(`din186p`→din186, `din261d`→din261, `din787i`→din787, `din478p`→din478) carry `alias_of` and target the
real non-alias bases (no chaining).

## Design decisions / tradeoffs

- **One generator with an `under` discriminator** (Approach A) rather than two generators. The box head
  is the shared primitive for all four; `under` captures the only real difference (square neck vs round
  collar vs nothing). Mirrors the `drive` param on `socket_screw` and the `head` param on
  `carriage_bolt`/`socket_screw`.
- **Sourcing gate governs the shipped set.** DIN 186/261 dimensions are the least public; the gate may
  draw them at a representative/max-published size (flagged) or drop them, exactly like the DIN 605 M10
  drop. No dimension ships without ≥2 named tables or an explicit representative flag.
- **Envelope simplifications, flagged:** the under-head fillet on DIN 261/787 is not drawn (the head
  sits on the bearing plane); `length` and `tip_chamfer` are representative, as in every prior family.

## Invariants (verbatim, epic-wide)

- **Generate-only:** do NOT touch `data/image-mappings.json` or `src/lib/data/standards-generated.ts`;
  do NOT run `catalog/integrate.py`.
- **Additive:** manifest gains only the new bases; all existing SVGs byte-identical after rebuild;
  manifest whitespace churn normalized with `pnpm exec prettier --write catalog/out/manifest.json`.
- **Sourcing:** every committed dimension confirmed by ≥2 named public tables; representative fields
  flagged; source strings contain NO `reyher` / `stalmut` tokens; `verified:true` only after cross-check.
- **Aliases never chain:** each `…p`/`…d`/`…i` variant targets its real base.
- **Container-only:** all build123d runs via `./catalog/run`.

## Testing

- **Generator (`test_prism_head_bolt.py`):**
  - rectangular head end-view extents (solid to head_len/2 on X and head_width/2 on Y, void beyond);
  - square head (head_len == head_width) end-view is square;
  - `under="square_neck"` puts a square cross-section between shank and head; `under="collar"` puts a
    round cross-section there; `under="none"` has only the shank below the head;
  - single fused solid (`len(solids()) == 1`) for each `under` value;
  - guards: unknown `under` rejected, `d >= head_width` rejected, non-positive dims rejected.
- **Data (`test_prism_head_bolts_data.py`):** family == prism_head_bolt, hardwareType screw, per-id
  `under` value correct, aliases resolve to a real non-alias base (no chaining), every entry sourced +
  verified with a non-empty source, no forbidden tokens.

## Success criteria

- Each shipped base renders a rectangular/square block head over a round shank, with the correct
  under-head feature (square neck for din186, round collar for din478, nothing for din261/787), distinct
  from the hex/socket/round heads already in the catalog.
- `coverage.py` screw gap drops toward 34 (by the number of ids that clear the sourcing gate).
- Every existing SVG byte-identical after rebuild.
- Full catalog test suite green.
