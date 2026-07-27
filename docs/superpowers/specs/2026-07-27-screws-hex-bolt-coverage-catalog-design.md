# Hex-Head Bolt Coverage (screw gap, family 1) — Design

**Date:** 2026-07-27
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — increasing coverage; first of several screw-gap families
**Predecessors:** hex-head bolt generator #110 (`hex_bolt`, ships iso4014/iso4017), socket-cap #111,
set-screw #115, slotted/cross machine screw #116/#117

## Context

`coverage.py` reports 85 app-served `screw` standards with no generated drawing. That gap is
**many families** (hex bolts, socket-cap variants, carriage bolts, studs, flange bolts, specialty).
This spec covers the **first and highest-value slice: plain hex-head bolts**, which reuse the
existing `hex_bolt` generator with **no code change** — the work is data + aliases.

Envelope-only drawing is the key lever: the catalog draws the hex head + smooth shank, with **no
thread lines**. So thread pitch (coarse vs fine) and thread length (partial vs full) are invisible
— they produce the _same drawing_. `iso4017` (full thread) already ships as a plain **alias** of
`iso4014` (partial thread) for exactly this reason. The only thing that changes the M12 hex-bolt
drawing is the **head across-flats `s`**, and there are just two values in play:

- **ISO** M12 hex bolts: `s = 18` (the existing `iso4014` base).
- **DIN** M12 hex bolts: `s = 19` (DIN 931/933 — ISO later reduced 19→18; documented in the
  `iso4014` source string).

So this whole family collapses to **one new drawing** (`din931`, s=19) plus aliases.

## Goal

Close the 12 plain hex-head bolt ids in the screw gap by adding **one sourced base `din931`** and
**11 aliases** to `catalog/dimensions/hex_bolts.json`, reusing `hex_bolt`. After the build,
`coverage.check(manifest, image_mappings, "screw")` shrinks from 85 to 73 missing.

## The 12 ids

| id         | thread          | head s | maps to         |
| ---------- | --------------- | ------ | --------------- |
| `din931`   | coarse, partial | 19     | **NEW base**    |
| `din933`   | coarse, full    | 19     | alias `din931`  |
| `din960`   | fine, partial   | 19\*   | alias `din931`  |
| `din961`   | fine, full      | 19\*   | alias `din931`  |
| `din931i`  | (image variant) | 19     | alias `din931`  |
| `din933i`  | (image variant) | 19     | alias `din931`  |
| `din960i`  | (image variant) | 19\*   | alias `din931`  |
| `din961i`  | (image variant) | 19\*   | alias `din931`  |
| `iso8676`  | fine, full      | 18     | alias `iso4014` |
| `iso8765`  | fine, partial   | 18     | alias `iso4014` |
| `iso4014p` | (variant)       | 18     | alias `iso4014` |
| `iso4017p` | (variant)       | 18     | alias `iso4014` |

- `*` **din960/din961 across-flats (18 vs 19) is confirmed at the sourcing gate.** If a table
  shows M12 DIN 960/961 uses s=18 (ISO head), those four ids (din960/din961 + din960i/din961i)
  alias `iso4014` instead of `din931`. The default assumption is s=19 (DIN 931 head) → `din931`.
- **Aliases never chain.** Every DIN variant targets the base `din931`, never the alias `din933`.
  The ISO variants target the existing base `iso4014`, never the alias `iso4017`. (`test_hex_bolts_
data.py` already asserts alias targets are real non-alias bases.)
- The `i`/`p` suffixes are the app's variant keys (already served in `image-mappings.json`); each
  shares its base's drawing, same as the washer/nut `i`/`p` aliases already in the catalog.

## Architecture

- **No generator change.** `hex_bolt(s, k, length, d_shank, head_chamfer=None, tip_chamfer=None)`
  already draws the chamfered hex head + smooth shank. `din931` is a data entry only.
- **New base data entry `din931`** in `catalog/dimensions/hex_bolts.json`, shape
  `{s: 19.0, k: 7.5, length: 60.0, d_shank: 12.0, head_chamfer: 19.0, tip_chamfer: 1.0}` — the
  same shape iso4014 uses, with `s`/`head_chamfer` at the DIN 19 mm value. (Confirm `s`/`k` at the
  sourcing gate.)
- **11 alias entries** (`alias_of` + `hardwareType` + `source` + `verified` + `designations`), per
  the table above.
- Build renders **one** new SVG (`din931.svg`); the 11 aliases render no new file (they reuse
  `din931.svg` or `iso4014.svg`).

## Representative size

**M12** (the epic default; hex bolts define M12, so no deviation is needed — unlike the slotted
machine-screw family that had to drop to M10). `length = 60` is a representative catalog length,
documented as chosen (same as the existing `iso4014`).

## Data / sourcing

All entries live in the existing `catalog/dimensions/hex_bolts.json`.

- **Sourcing gate (controller, before the data task):** confirm `din931` M12 `s = 19` and
  `k = 7.5` against **≥2 named public tables** (e.g. Fasteners.eu DIN 931 + one more; the existing
  `iso4014` source already cites the DIN-19/ISO-18 split). Confirm the DIN 960/961 M12 across-flats
  to fix their alias target (s=19 → `din931`, s=18 → `iso4014`).
- `source` strings cite only public tables — never a private catalogue (no `reyher`, `stalmut`);
  `verified: true` only after the cross-check. Alias `source` strings state the shared envelope and
  which base they alias, and why (same M12 hex envelope; pitch/thread-length not drawn).
- `hardwareType: "screw"` for every entry.

## Non-goals

- **No generator change** and no modification to any existing generator; existing SVGs
  byte-identical.
- **No structural / fit / flange / carriage / socket / stud hex-adjacent bolts** — din6914 (HV),
  din7968/din7990/din7999 (structural), din609/din610 (fit), din6921 (flange), din603… (carriage)
  are later screw-gap families, not this one. This family is _plain_ hex bolts only.
- **No app integration** beyond generation: `data/image-mappings.json` and
  `src/lib/data/standards-generated.ts` stay untouched; `integrate.py` is not run. Closing the
  `coverage.py` gap only requires the drawing to exist in the manifest (the ids are already served).

## Testing

Extend `catalog/tests/test_hex_bolts_data.py` (its existing tests already cover validate+build,
family/hardwareType, alias resolution, sourced+verified, forbidden tokens — they will now sweep the
new entries automatically). Add focused assertions:

- `din931` is a real base (`family == "hex_bolt"`), builds one solid, and its shape has `s == 19.0`
  (the DIN head width, distinct from `iso4014`'s 18.0).
- The 11 new aliases each resolve to a real **non-alias** base (`din931` or `iso4014`) — no
  chaining. (The existing suite asserts this generically; add an explicit per-id map for the
  DIN→din931 and ISO→iso4014 groups.)
- Existing `iso4014`/`iso4017` entries unchanged; existing SVGs byte-identical.

## Rollout / invariants

- **Generate-only.** In-container (`./catalog/run`). Build produces **1 new drawing** (`din931.svg`)
  - 11 aliases (no new files); no existing drawing changes (byte-identical). `data/image-mappings.
json` and `src/lib/data/standards-generated.ts` stay untouched (`grep -c '.svg'` on the diff → 0);
    `integrate.py` not run.
- **Coverage check:** after the build, `coverage.check(manifest, image_mappings, "screw")` no longer
  lists din931/din933/din960/din961(+i) or iso8676/iso8765/iso4014p/iso4017p — the screw gap drops
  from 85 to 73. (The `coverage.py` CI gate only enforces `washer`; the screw improvement is
  measured, not gated.)
- If `manifest.json` shows a whitespace-only rebuild reformat, normalise with prettier so the
  committed diff is only the new entries.
- Convention: TDD → commit → push → PR → zen review (`deepseek/deepseek-v4-pro`, thinking=high) →
  apply findings as commits → CI green → squash-merge (admin). Visual confirmation of `din931.svg`
  (a hex head + shank, s=19) before merge.

## Global constraints (verbatim)

- Reuse `hex_bolt` with **no code change**; add 1 base (`din931`) + 11 aliases to `hex_bolts.json`.
- Representative size **M12**; `s = 19` (DIN head), `k = 7.5`, confirmed by **≥2 named public
  tables**; `length = 60` representative. Confirm din960/din961 across-flats to fix their alias
  target.
- Aliases never chain (target `din931` / `iso4014`, the real bases). `hardwareType: "screw"`.
- Source strings: **no** `reyher`, `stalmut`, or any private catalogue.
- **Generate-only:** do not modify `data/image-mappings.json` or
  `src/lib/data/standards-generated.ts`; do not run `integrate.py`. Existing SVGs byte-identical.
- No render/preset change.
