# Structural & Fit Hex-Bolt Coverage (screw gap, family 2) — Design

**Date:** 2026-07-27
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — increasing coverage; second screw-gap family
**Predecessor:** plain hex-head bolt coverage #123 (`din931` base + 11 aliases; screw gap 85 → 73)

## Context

`coverage.py` reports 73 app-served `screw` standards with no generated drawing. That gap is still
many families (carriage bolts, studs, flange bolts, T-head/square-head, socket-cap variants,
specialty). This spec covers the **second slice: structural and fit hexagon-head bolts** — the
DIN steelwork bolts (`din6914` HV, `din7990`) and the machined-shank fit bolts (`din609`, `din610`,
`din7968`, `din7999`). Like family 1, they reuse the existing `hex_bolt` generator with **no code
change** — the work is data + aliases.

Envelope-only drawing is again the lever: the catalog draws the hex head + smooth shank, with **no
thread lines**. So thread pitch and thread-portion length are invisible (they produce the _same_
drawing). Only three things change a hex-bolt drawing at a fixed representative size: head
across-flats `s`, head height `k`, and shank diameter `d_shank`. Structural/fit bolts move all
three away from the plain-bolt values in a small number of combinations.

## The 10 ids

Sourced M12 values (fasteners.eu, Schrauben-Lexikon, TraceParts, ITA Fasteners, Normteile-Leinigen,
Befestigungsfuchs, Wegertseder — confirmed at the sourcing gate against ≥2 named tables each):

| id         | standard | head             | s     | k   | d_shank | maps to         |
| ---------- | -------- | ---------------- | ----- | --- | ------- | --------------- |
| `din6914`  | DIN 6914 | heavy hex HV     | 22    | 8   | 12      | **NEW base**    |
| `din6914i` | DIN 6914 | (variant)        | 22    | 8   | 12      | alias `din6914` |
| `din7999`  | DIN 7999 | heavy hex HV fit | ~21\* | 8   | ~13\*   | alias `din6914` |
| `din609`   | DIN 609  | std hex fit      | 19    | 7.5 | 13      | **NEW base**    |
| `din609p`  | DIN 609  | (variant)        | 19    | 7.5 | 13      | alias `din609`  |
| `din610`   | DIN 610  | std hex fit      | 19    | 7.5 | 13      | alias `din609`  |
| `din610p`  | DIN 610  | (variant)        | 19    | 7.5 | 13      | alias `din609`  |
| `din7968`  | DIN 7968 | std hex fit      | 19    | 7.5 | 13      | alias `din609`  |
| `din7990`  | DIN 7990 | std hex          | 19    | 7.5 | 12      | alias `din931`  |
| `din7990d` | DIN 7990 | (variant)        | 19    | 7.5 | 12      | alias `din931`  |

This collapses to **two new drawings** plus reuse of the existing `din931`:

- **`din6914`** (heavy hex HV, `s = 22`, `k = 8`, standard shank `d = 12`) — the big-head bolt.
- **`din609`** (standard hex head `s = 19`, `k = 7.5`, **oversize fit shank `d = 13`**) — the fit
  bolt, one drawing whose only difference from `din931` is the 1 mm-wider machined shank.
- **`din931`** (existing, `s = 19`, `k = 7.5`, `d = 12`) absorbs `din7990`/`din7990d`, whose
  envelope is identical to the plain DIN hex bolt.

## Design decisions / tradeoffs

- **Honor the 1 mm fit shank (12 → 13).** Family 1 already treated a 1 mm _head_ difference
  (ISO `s=18` vs DIN `s=19`) as its own drawing; by the same fidelity standard the fit bolts'
  1 mm oversize shank earns `din609` its own drawing instead of collapsing into `din931`. The
  oversize precision shank is the fit bolt's defining visual feature.
- **`din7999` aliases `din6914` (does _not_ get its own base).** Its M12 head is single-sourced
  (TraceParts ~21 mm, "große Schlüsselweite", with makers aligning to the 22 mm heavy hex) and its
  fit shank is inferred, so it fails the ≥2-named-tables rule for a faithfully-dimensioned base.
  Aliasing it to the well-sourced `din6914` heavy-hex HV base is more defensible than shipping a
  base on weak evidence. Accepted consequence: `din7999` renders with the `din6914` standard shank
  (d = 12), i.e. its fit shank is not separately drawn — a deliberate, documented simplification at
  the heavy-hex tier only (the standard-head fit bolts still get their d = 13 shank via `din609`).
- **Aliases never chain.** Every alias targets a real non-alias base (`din6914`, `din609`, or the
  existing `din931`) — never another alias. (`test_hex_bolts_data.py` asserts this generically.)
- **`din610` (a real standard) aliases `din609` (a real standard).** Same as family 1's
  `din933 → din931`; the alias target only has to be a non-alias base, which `din609` is.

## Architecture

- **No generator change.** `hex_bolt(s, k, length, d_shank, head_chamfer=None, tip_chamfer=None)`
  already draws the chamfered hex head + smooth shank. `din6914` and `din609` are data entries only.
- **Two new base data entries** in `catalog/dimensions/hex_bolts.json`:
  - `din6914`: `{ s: 22.0, k: 8.0, length: 60.0, d_shank: 12.0, head_chamfer: 22.0, tip_chamfer: 1.0 }`
  - `din609`: `{ s: 19.0, k: 7.5, length: 60.0, d_shank: 13.0, head_chamfer: 19.0, tip_chamfer: 1.0 }`
- **Eight alias entries** (`alias_of` + `hardwareType` + `source` + `verified` + `designations`),
  per the table above.
- Build renders **two** new SVGs (`din6914.svg`, `din609.svg`); the eight aliases render no new file
  (they reuse `din6914.svg`, `din609.svg`, or the existing `din931.svg`).
- Generator guards are satisfied: `d_shank < s` (13 < 19; 12 < 22) and `d_shank ≤ head_chamfer`
  (13 ≤ 19; 12 ≤ 22).

## Representative size

**M12** (the epic default; hex bolts define M12). `length = 60` is a representative catalog length,
documented as chosen (same as `din931`/`iso4014`). `din6914`/`din609` exist at M12 in their
standards (confirmed at the sourcing gate).

## Data / sourcing

All entries live in the existing `catalog/dimensions/hex_bolts.json`.

- **Sourcing gate (controller, before the data task):** confirm against **≥2 named public tables**
  each: `din6914` M12 `s = 22`, `k = 8`, `d_shank = 12`; `din609` M12 `s = 19`, `k = 7.5`,
  `d_shank = 13` (the 13k6 fit shank). Confirm `din610`/`din7968` share the `din609` envelope
  (std head + 13 mm fit shank) and that `din7990` shares the `din931` envelope (s=19/d=12). Provide
  the implementer the two base shapes and all 10 `source` strings verbatim.
- `source` strings cite only public tables — never a private catalogue (**no** `reyher`, `stalmut`).
  Alias `source` strings state the shared envelope, which base they alias, and why (pitch and
  thread-portion length not drawn; heavy-hex or fit-shank envelope shared). Any representative or
  single-sourced value (e.g. `din7999`'s head, `length`) is flagged as such in the string.
- `verified: true` only after the cross-check. `hardwareType: "screw"` on every entry.

## Non-goals

- **No generator change**; no modification to any existing generator; existing SVGs byte-identical.
- **No other screw families** — carriage bolts (din603…), studs (din938/939/835/525…), flange
  (din6921), socket-cap variants (din6912/din7984/iso7380/iso10642/iso7379), T-head/square-head/
  knurled/capstan are later families, not this one.
- **No `din7999` base** — it aliases `din6914` (see tradeoffs).
- **No app integration** beyond generation: `data/image-mappings.json` and
  `src/lib/data/standards-generated.ts` stay untouched; `integrate.py` is not run. The ids are
  already app-served; closing the `coverage.py` gap only requires the drawing to exist in the
  manifest.

## Testing

Extend `catalog/tests/test_hex_bolts_data.py` (its existing sweeps already cover validate+build,
family/hardwareType, alias resolution without chaining, sourced+verified, forbidden tokens — they
sweep the new entries automatically). Add focused assertions:

- `din6914` is a real base (`family == "hex_bolt"`, not an alias), builds one solid, and its shape
  has `s == 22.0` and `d_shank == 12.0` (the heavy hex head, distinct from `din931`'s 19.0).
- `din609` is a real base, builds one solid, and its shape has `s == 19.0` and `d_shank == 13.0`
  (the standard head with the oversize fit shank, distinct from `din931`'s 12.0).
- A per-id alias map asserts the 8 new aliases each resolve to a real **non-alias** base
  (`din6914`, `din609`, or `din931`) — no chaining — and carry `hardwareType == "screw"`.
- Existing `iso4014`/`iso4017`/`din931` entries unchanged; existing SVGs byte-identical.

## Rollout / invariants

- **Generate-only.** In-container (`./catalog/run`). Build produces **2 new drawings**
  (`din6914.svg`, `din609.svg`) + 8 aliases (no new files); no existing drawing changes
  (byte-identical). `data/image-mappings.json` and `src/lib/data/standards-generated.ts` stay
  untouched (`grep -c '.svg'` on the diff → 0); `integrate.py` not run.
- **Coverage check:** after the build, `coverage.check(manifest, image_mappings, "screw")` no longer
  lists the 10 ids — the screw gap drops from **73 to 63**. (The `coverage.py` CI gate enforces only
  `washer`; the screw improvement is measured, not gated.)
- If `manifest.json` shows a whitespace-only rebuild reformat, normalise with prettier so the
  committed diff is only the new entries.
- Convention: TDD → commit → push → PR → zen review (`deepseek/deepseek-v4-pro`, thinking=high) →
  apply findings as commits → CI green → squash-merge (admin). Visual confirmation of `din6914.svg`
  (a wider heavy hex head) and `din609.svg` (a fatter shank than `din931`) before merge.

## Global constraints (verbatim)

- Reuse `hex_bolt` with **no code change**; add 2 bases (`din6914`, `din609`) + 8 aliases to
  `hex_bolts.json`.
- Representative size **M12**; `din6914` `s = 22`, `k = 8`, `d = 12`; `din609` `s = 19`, `k = 7.5`,
  `d = 13`; each confirmed by **≥2 named public tables** at the sourcing gate; `length = 60`
  representative.
- Aliases never chain (target `din6914` / `din609` / `din931`, the real bases).
  `hardwareType: "screw"` on every entry. `verified: true` only after cross-check.
- Source strings: **no** `reyher`, `stalmut`, or any private catalogue.
- **Generate-only:** do not modify `data/image-mappings.json` or
  `src/lib/data/standards-generated.ts`; do not run `integrate.py`. Existing SVGs byte-identical.
- No render/preset change.
