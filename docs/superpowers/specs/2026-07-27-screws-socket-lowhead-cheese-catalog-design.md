# Socket Low-Head + Torx Cheese Coverage (screw gap, family 3) — Design

**Date:** 2026-07-27
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — increasing coverage; third screw-gap family
**Predecessors:** plain hex bolts #123 (85→73), structural/fit hex bolts #124 (73→63)

## Context

`coverage.py` reports 63 app-served `screw` standards with no generated drawing. This spec covers a
**data-only** slice that reuses the existing `socket_screw` generator (ISO 4762 / DIN 912 hex socket,
ISO 14579 Torx): **low-head hex-socket cap screws** (`din6912`, `din7984`) and a **Torx cheese head**
(`iso14580`), plus two image-variant aliases of the existing standard cap.

`socket_screw(dk, k, length, d_shank, drive, socket_af, socket_depth, tip_chamfer)` draws a plain
cylindrical head with a **blind** hex or lobular drive socket cut into its top, over a smooth shank —
envelope only (no thread, no through bore). At a fixed size the drawing changes with head diameter
`dk`, head height `k`, shank `d_shank`, and the drive socket (`drive` + `socket_af`). This family
moves those away from the standard cap in a few combinations, so it needs **no code change**.

## The 6 ids

Sourced values (fasteners.eu, Schrauben-Lexikon, Westfield, Spaenaur, Aspen, Accu, Fastenright, the
DIN/ISO cross-reference + ISO 7045 cheese tables — confirmed at the sourcing gate against ≥2 named
tables each):

| id         | standard  | size  | head        | dk  | k   | drive   | socket | maps to         |
| ---------- | --------- | ----- | ----------- | --- | --- | ------- | ------ | --------------- |
| `din6912`  | DIN 6912  | M12   | low cap     | 18  | 7   | hex     | s=10   | **NEW base**    |
| `din7984`  | DIN 7984  | M12   | low cap     | 18  | 7   | hex     | s=8    | **NEW base**    |
| `din7984i` | DIN 7984  | M12   | (variant)   | 18  | 7   | hex     | s=8    | alias `din7984` |
| `iso14580` | ISO 14580 | M10\* | Torx cheese | 16  | 6   | lobular | ~T50   | **NEW base**    |
| `din912i`  | DIN 912   | M12   | std cap     | 18  | 12  | hex     | s=10   | alias `iso4762` |
| `iso4762p` | ISO 4762  | M12   | std cap     | 18  | 12  | hex     | s=10   | alias `iso4762` |

Three new drawings + reuse of the existing `iso4762`:

- **`din6912`** — M12 low-head cap, `dk=18, k=7`, hex socket `s=10` (retains the full DIN 912 hex; the
  key-guide pilot is an internal feature, not drawn).
- **`din7984`** — M12 low-head cap, `dk=18, k=7`, hex socket `s=8` (reduced hex). Same external head as
  `din6912`; the **socket size is the drawn difference**, so it is its own drawing (honoring the drive,
  the design decision below).
- **`iso14580`** — Torx cheese head, `dk=16, k=6`, lobular drive. `*` ISO 14580 has **no M12 size** (its
  standard range ends at M10), so this base is drawn at **M10** — the same precedent as the slotted
  machine-screw family, which dropped to M10 when M12 was unavailable.
- **`iso4762`** (existing) absorbs `din912i` and `iso4762p` (both the standard M12 cap, `dk=18, k=12`,
  hex `s=10`).

## Design decisions / tradeoffs

- **din6912 and din7984 get separate drawings.** They share the external head (`dk=18, k=7`) but differ
  in hex socket across-flats (10 vs 8). The socket is the drive recess the generator actually draws, so
  honoring it is consistent with families 1–2 (which drew 1 mm head/shank differences). `din7984i`
  aliases `din7984`.
- **iso14580 drawn at M10, not M12.** ISO 14580 is standardized only M2–M10 (confirmed at the sourcing
  gate: the ISO 14580 `dk max` series ends at M10=16 mm; ISO 14579/4762 also give M10 dk=16). The
  representative size drops to the standard's real maximum, flagged in the source string.
- **Representative socket depth + lobular socket size.** `socket_depth` (blind, `< k`) and the ISO 14580
  lobular `socket_af` are representative (the lobular profile is already a representative icon, not
  dimensioned ISO 10664, per the `socket_screw` docstring and THIRD-PARTY-NOTICES). Both are flagged in
  the source strings.
- **Aliases never chain.** `din912i`/`iso4762p` target the real base `iso4762` (never `din912`, which is
  itself an alias of `iso4762`); `din7984i` targets `din7984`. Every target is a real non-alias base.

## Architecture

- **No generator change.** `socket_screw(...)` already draws the cylindrical head + blind socket + shank.
  `din6912`, `din7984`, `iso14580` are data entries only. `socket_screw` is already in
  `_registry.KNOWN_FAMILIES` — no registry change.
- **Three new base data entries** in `catalog/dimensions/socket_screws.json`:
  - `din6912`: `{ dk:18.0, k:7.0, length:60.0, d_shank:12.0, drive:"hex", socket_af:10.0, socket_depth:4.0, tip_chamfer:1.0 }`
  - `din7984`: `{ dk:18.0, k:7.0, length:60.0, d_shank:12.0, drive:"hex", socket_af:8.0, socket_depth:4.0, tip_chamfer:1.0 }`
  - `iso14580`: `{ dk:16.0, k:6.0, length:50.0, d_shank:10.0, drive:"lobular", socket_af:7.0, socket_depth:3.5, tip_chamfer:0.8 }`
- **Three alias entries** (`alias_of` + `hardwareType` + `source` + `verified` + `designations`).
- Build renders **three** new SVGs (`din6912.svg`, `din7984.svg`, `iso14580.svg`); the 3 aliases render
  no new file (reuse `din7984.svg` or the existing `iso4762.svg`).
- Generator guards hold: `d_shank < dk` (12<18; 10<16); blind socket `socket_depth < k` (4<7; 3.5<6);
  the drive-aware wall guard clears (hex outer radius `s/√3`: 10→5.77, 8→4.62 < dk/2=9; lobular
  `0.5·socket_af`=3.5 < dk/2=8).

## Representative size

**M12** for the socket caps (the epic default; the existing `iso4762`/`iso14579` bases are M12, `dk=18`,
`d_shank=12`, `length=60`). **M10** for `iso14580` only (ISO 14580 has no M12 — `dk=16`, `d_shank=10`,
`length=50`), flagged as the standard's maximum size. `socket_depth`, `tip_chamfer`, and the lobular
`socket_af` are representative, flagged.

## Data / sourcing

All entries live in the existing `catalog/dimensions/socket_screws.json`.

- **Sourcing gate (controller, before the data task):** confirm against ≥2 named public tables each:
  `din6912` M12 `dk=18, k=7`, hex `s=10` (Schrauben-Lexikon low-head progression + Accu/Aspen M12
  listing); `din7984` M12 `dk=18, k=7`, hex `s=8` (Westfield + Spaenaur/fasteners.eu); `iso14580` max
  size M10 `dk=16, k=6` (ISO 14580 `dk max` series + ISO 7045 cheese-head `k`; corroborated by the M10
  cap dk=16). Provide the implementer the three base shapes and all 6 `source` strings verbatim.
- `source` strings cite only public tables — never a private catalogue (**no** `reyher`, `stalmut`).
  Representative fields (socket depth, lobular socket size, `length`, and the M10 drop for `iso14580`)
  are flagged as such. Alias `source` strings state the shared envelope and which base they alias.
- `verified: true` only after the cross-check. `hardwareType: "screw"` on every entry.

## Non-goals

- **No generator change**; existing SVGs byte-identical.
- **No countersunk / button / shoulder socket screws** — `din7991`/`din7991i`/`iso10642` (countersunk
  conical head), `iso7380` (button dome head), `iso7379` (shoulder screw) need new head geometry and are
  a later family, not this one. This family is only the drawings `socket_screw` can already produce
  (plain cylindrical / cheese head + hex or lobular socket).
- **No app integration** beyond generation: `data/image-mappings.json` and
  `src/lib/data/standards-generated.ts` stay untouched; `integrate.py` is not run. The ids are already
  app-served; closing the `coverage.py` gap only requires the drawing to exist in the manifest.

## Testing

Extend `catalog/tests/test_socket_screws_data.py` (its existing sweeps cover validate+build,
family/hardwareType, alias resolution, sourced+verified, forbidden tokens — they sweep the new entries
automatically). Add focused assertions:

- `din6912` and `din7984` are real bases (`family == "socket_screw"`, not aliases), each builds one
  solid, share `dk == 18.0` and `k == 7.0`, and differ in the socket: `din6912` `socket_af == 10.0`,
  `din7984` `socket_af == 8.0` (the drawn distinction).
- `iso14580` is a real base, builds one solid, `drive == "lobular"`, `dk == 16.0`, `k == 6.0`.
- A per-id alias map asserts `din7984i → din7984`, `din912i → iso4762`, `iso4762p → iso4762` each resolve
  to a real **non-alias** base (no chaining) and carry `hardwareType == "screw"`.
- Existing `iso4762`/`din912`/`iso14579` entries unchanged; existing SVGs byte-identical.

## Rollout / invariants

- **Generate-only.** In-container (`./catalog/run`). Build produces **3 new drawings** (`din6912.svg`,
  `din7984.svg`, `iso14580.svg`) + 3 aliases (no new files); no existing drawing changes
  (byte-identical). `data/image-mappings.json` and `src/lib/data/standards-generated.ts` stay untouched
  (`grep -c '.svg'` on the diff → 0); `integrate.py` not run.
- **Coverage check:** after the build, `coverage.check(manifest, image_mappings, "screw")` no longer
  lists the 6 ids — the screw gap drops from **63 to 57**. (The `coverage.py` CI gate enforces only
  `washer`; the screw improvement is measured, not gated.)
- If `manifest.json` shows a whitespace-only rebuild reformat, normalise with prettier so the committed
  diff is only the new entries.
- Convention: TDD → commit → push → PR → zen review (`deepseek/deepseek-v4-pro`, thinking=high) → apply
  findings as commits → CI green → squash-merge (admin). Visual confirmation of the three new SVGs
  before merge: `din6912`/`din7984` a lower head than `iso4762` with a hex socket (10 vs 8), `iso14580` a
  low cheese head with a Torx (lobular) socket.

## Global constraints (verbatim)

- Reuse `socket_screw` with **no code change**; add 3 bases (`din6912`, `din7984`, `iso14580`) + 3
  aliases to `socket_screws.json`.
- Representative size **M12** for the caps; **M10** for `iso14580` (no M12 exists). Each envelope dim
  confirmed by **≥2 named public tables** at the sourcing gate; representative fields flagged.
- Aliases never chain (target `din7984` / `iso4762`, the real bases). `hardwareType: "screw"` on every
  entry. `verified: true` only after cross-check.
- Source strings: **no** `reyher`, `stalmut`, or any private catalogue.
- **Generate-only:** do not modify `data/image-mappings.json` or `src/lib/data/standards-generated.ts`;
  do not run `integrate.py`. Existing SVGs byte-identical.
- No render/preset change.
