# Plain Stud / Double-End Stud Coverage (screw gap, family 4) — Design

**Date:** 2026-07-28
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Category:** `screw` — increasing coverage; fourth screw-gap family
**Predecessors:** plain hex bolts #123 (85→73), structural/fit hex bolts #124 (73→63),
socket low-head + Torx cheese #125 (63→57)

## Context

`coverage.py` reports 57 app-served `screw` standards with no generated drawing. This spec covers a
slice of that gap: **plain double-end studs** (`din938`, `din939`, `din835`) — headless fasteners
with a thread at each end and a plain unthreaded middle. Envelope-only (no drawn thread), a stud is
simply a plain full-diameter cylindrical rod with a chamfered end at each free end.

Unlike families 1–3, this is **not** a reuse of an existing generator: no current family draws a
plain headless, socket-less rod. `set_screw` is headless but always cuts a hex drive socket in its
top face, which a stud does not have. So this family adds one small, self-contained generator,
`stud`, and one new dimension file, `studs.json`.

## Shape fidelity (why the geometry is what it is)

Confirmed against named public tables (fasteners.eu, Schrauben-Lexikon, BelMetric, din938.com,
Aspen Fasteners, and — for the excluded standards — TorqBolt/PowerBolt):

- **DIN 938 / 939 / 835 are plain full-diameter double-end studs.** The unthreaded middle is at the
  nominal thread diameter — **not** waisted or reduced. The three standards differ only in the
  screw-in ("metal") end thread length: **1d** (DIN 938), **1.25d** (DIN 939), **2d** (DIN 835).
  That difference is a thread feature; envelope-only it is invisible, so all three collapse to the
  same plain rod at the same nominal size — the same collapse precedent as thread pitch/length
  across the whole catalog.
- **DIN 525 is a welding stud** ("weld-on end with hexagon nut", fasteners.eu + Schrauben-Lexikon),
  **not** a plain double-end stud. Drawing it as a plain rod would ship it wrong (it carries a hex
  nut / weld end). Excluded — a later family.
- **DIN 2510 is a reduced/waisted expansion stud** for flanged joints (M12 shank necks to ~8 mm with
  radiused transitions and a centre hole; TorqBolt/PowerBolt). A genuinely different envelope that
  needs reduced-middle + fillet geometry. Excluded — a later family.
- DIN 976 (fully threaded rod) is a plain full-diameter rod too, but it is **not in the gap**, so it
  is out of scope here.

## The 6 ids

| id        | standard | metal end | size | maps to        |
| --------- | -------- | --------- | ---- | -------------- |
| `din938`  | DIN 938  | 1d        | M12  | **NEW base**   |
| `din938d` | DIN 938  | 1d        | M12  | alias `din938` |
| `din939`  | DIN 939  | 1.25d     | M12  | alias `din938` |
| `din939d` | DIN 939  | 1.25d     | M12  | alias `din938` |
| `din835`  | DIN 835  | 2d        | M12  | alias `din938` |
| `din835d` | DIN 835  | 2d        | M12  | alias `din938` |

One new drawing (`din938.svg`); the 5 aliases render no new file. The `…d` suffix is the app's
image-variant key for each standard (same convention as `din603i`, `iso4762p` in earlier families).

## Design decisions / tradeoffs

- **din938 is the base; din939, din835, and all `…d` variants alias it.** DIN 938 (metal end 1d) is
  the canonical, most common form. Envelope-only the three standards are the identical rod, so one
  drawing serves all six ids. `din939`/`din835` alias `din938` even though they are distinct
  standards — consistent with families 1–3, where coarse/fine and partial/full-thread variants that
  differ only in undrawn features aliased a single base. Every alias targets the real non-alias base
  `din938` (no chaining).
- **Both ends chamfered.** A stud has no head and no drive; both ends are free thread ends, each with
  a standard ~45° lead chamfer. This is the visible difference from `_screw_shank` (which chamfers
  only the single free end below a head).
- **Representative M12, length 60.** M12 is the epic default; `length=60.0` matches the M12 rods
  elsewhere (e.g. `iso4762`), and `tip_chamfer=1.0` is a standard edge break. Length and chamfer are
  representative fields, flagged in the source string (a stud ships in many lengths; envelope-only the
  exact length does not change which standard it is).
- **din525 and din2510 deferred, not aliased.** Aliasing a welding stud or a waisted expansion stud
  to a plain rod would misrepresent its shape. Both are documented as non-goals.

## Architecture

- **New generator** `catalog/models/stud.py`, self-contained (mirrors `set_screw`'s deterministic
  revolve-a-meridian technique — no fragile edge selection; does not depend on `screw_common`):

  ```
  stud(d: float, length: float, tip_chamfer: float | None = None)
  ```

  A plain cylinder of diameter `d` and axial `length`, built along +Z with `z ∈ [0, length]`, with a
  45-degree lead chamfer of leg `tip_chamfer` at **both** the `z=0` and `z=length` ends. Built by
  revolving an XZ meridian about Z. Envelope only; no thread, no socket, no head.
  - Meridian (with `r = d/2`, `c = tip_chamfer`): bottom chamfer at `z=0`, top chamfer at
    `z=length` — `[(0,0), (r-c,0), (r,c), (r,length-c), (r-c,length), (0,length)]`. With
    `tip_chamfer=None`: a plain cylinder `[(0,0), (r,0), (r,length), (0,length)]`.
  - **Guards:** `d > 0`; `length > 0`; if `tip_chamfer` given, `0 < tip_chamfer < d/2` **and**
    `2·tip_chamfer < length` (both chamfers must fit within the length). Net `volume > 0` (not
    `is_valid` — sewn-shell gotcha) and exactly one solid, same as the other generators.

- **Registry:** add `stud` to `_registry.KNOWN_FAMILIES` (import + map entry). No change to
  `build_part` (its generic dispatch already handles any registered family).

- **New dimension file** `catalog/dimensions/studs.json` with the 6 entries above:
  - `din938` (base): `family:"stud"`, `shape:{ d:12.0, length:60.0, tip_chamfer:1.0 }`,
    `hardwareType:"screw"`, `verified:true`, `designations:[{system:"DIN", code:"938"}]`, `source`.
  - `din938d`, `din939`, `din939d`, `din835`, `din835d`: `alias_of:"din938"` + `hardwareType` +
    `source` + `verified` + `designations`.

- Build renders **one** new SVG (`din938.svg`); the 5 aliases reuse it (no new file).

## Representative size

**M12** (the epic default). `d=12.0` (M12 major), `length=60.0`, `tip_chamfer=1.0`. `length` and
`tip_chamfer` are representative and flagged; the drive-end distinction (1d/1.25d/2d) is a thread
feature and not drawn.

## Data / sourcing

All entries live in the new `catalog/dimensions/studs.json`.

- **Sourcing gate (controller, before the data task):** confirm against ≥2 named public tables each:
  DIN 938/939/835 are plain full-diameter double-end studs at M12 major `d=12` (fasteners.eu DIN 835
  table + Schrauben-Lexikon DIN 939/835 + BelMetric + din938.com); the metal-end lengths 1d/1.25d/2d
  distinguish the three standards but are undrawn. Provide the implementer the base shape and all 6
  `source` strings verbatim.
- `source` strings cite only public tables — never a private catalogue (**no** `reyher`, `stalmut`).
  Representative fields (`length`, `tip_chamfer`) and the envelope-only collapse (metal-end length not
  drawn) are flagged. Alias `source` strings state the shared plain-rod envelope, the undrawn
  drive-end difference, and which base they alias.
- `verified: true` only after the cross-check. `hardwareType: "screw"` on every entry.

## Non-goals

- **No welding studs.** `din525`/`din525d` are weld-on ends with a hexagon nut — a different fastener
  needing weld-end + nut geometry. Not this family.
- **No waisted / reduced-shank expansion studs.** `din2510d` (DIN 2510) needs a reduced-middle +
  radiused-transition envelope. A later family.
- **No fully threaded rod.** DIN 976 is a plain rod but is not in the coverage gap.
- **No thread, no socket, no head.** The generator draws the plain envelope only.
- **No app integration** beyond generation: `data/image-mappings.json` and
  `src/lib/data/standards-generated.ts` stay untouched; `integrate.py` is not run. The ids are already
  app-served; closing the `coverage.py` gap only requires the drawing to exist in the manifest.

## Testing

Two new files, following house style:

- `catalog/tests/test_stud.py` — generator unit tests (mirrors `test_set_screw.py`):
  - Envelope extents: for a chamfered rod, `bb.size.Z == length`, `bb.size.X == d`, `min.Z == 0`,
    `max.Z == length`, `volume > 0`.
  - Both ends chamfered: the part is narrower at each extreme face (`z≈0` and `z≈length`) than at
    mid-body (probe the outer radius near a face vs mid-length).
  - Exactly one solid.
  - Guards raise `ValueError`: `tip_chamfer >= d/2`; `2·tip_chamfer >= length`; non-positive `d`,
    `length`.
  - A plain cylinder (`tip_chamfer=None`) builds and has full radius at both faces.

- `catalog/tests/test_studs_data.py` — data sweep (mirrors `test_socket_screws_data.py`):
  - Validate + build every entry (non-alias entries build a solid).
  - `family == "stud"` and `hardwareType == "screw"` on every entry.
  - `din938` is a real non-alias base that builds one solid; its shape has no `socket`/`head` fields
    (plain rod: `d`, `length`, `tip_chamfer` only).
  - A per-id alias map asserts `din938d`, `din939`, `din939d`, `din835`, `din835d` each resolve to the
    real non-alias base `din938` (no chaining) and carry `hardwareType == "screw"`.
  - Every entry is sourced (`len(source) >= 3`) and `verified is True`.
  - No `source` names a private catalogue (`reyher`, `stalmut`).

## Rollout / invariants

- **Generate-only.** In-container (`./catalog/run`). Build produces **1 new drawing** (`din938.svg`)
  - 5 aliases (no new files); no existing drawing changes (byte-identical). `data/image-mappings.json`
    and `src/lib/data/standards-generated.ts` stay untouched (`grep -c '.svg'` on the diff → 0);
    `integrate.py` not run.
- **Coverage check:** after the build, `coverage.check(manifest, image_mappings, "screw")` no longer
  lists the 6 ids — the screw gap drops from **57 to 51**. (The `coverage.py` CI gate enforces only
  `washer`; the screw improvement is measured, not gated.)
- If `manifest.json` shows a whitespace-only rebuild reformat, normalise with prettier so the
  committed diff is only the new entry.
- Convention: TDD → commit → push → PR → zen review (`deepseek/deepseek-v4-pro`, thinking=high) →
  apply findings as commits → CI green → squash-merge (admin). Visual confirmation of the new SVG
  before merge: `din938` is a plain headless rod with a chamfer at each end — no head, no socket.

## Global constraints (verbatim)

- Add a new self-contained generator `stud` (register it) + a new `studs.json`; add 1 base
  (`din938`) + 5 aliases. No change to any existing generator or to `build_part`.
- Representative size **M12**. Each envelope dim confirmed by **≥2 named public tables** at the
  sourcing gate; representative fields (`length`, `tip_chamfer`) flagged.
- Aliases never chain (target `din938`, the real base). `hardwareType: "screw"` on every entry.
  `verified: true` only after cross-check.
- Source strings: **no** `reyher`, `stalmut`, or any private catalogue.
- **Generate-only:** do not modify `data/image-mappings.json` or `src/lib/data/standards-generated.ts`;
  do not run `integrate.py`. Existing SVGs byte-identical.
- No render/preset change.
