# Castle / Slotted Nut Family Catalog — Design

**Date:** 2026-07-13
**Epic:** Generative fastener-asset catalog (opt-in, family-by-family)
**Predecessors:** plain hex (PR #91), conical flange (PR #92), cap/dome (PR #93)

## Goal

Add a **castle / slotted nut** family to the maintainer-only generative catalog: a
chamfered vertex-up hex body with a cylindrical crown on top into which `n` rectangular
radial slots are cut for a cotter pin, plus a through bore. Ship three DIN standards at
M12 (DIN 935 regular, DIN 937 thin/low legacy, DIN 979 thin) plus the verified ISO 7035
alias. Reuse `_chamfered_hex_solid` unchanged and hex_nut's bore.

## Non-goals

- No render/preset change (castle nuts are `hardwareType: "nut"` → existing vertex-up
  `NUT_PRESET`).
- No solid crown band below the slots (see "Documented simplification").
- No legacy SW19 variants of DIN 935 / DIN 979; no ISO 7036 / 7037 (different geometry,
  deferred).
- No user-facing toggle (later epic milestone). No new sizes beyond M12.

## Architecture

New generator `catalog/models/castle_nut.py`:

```python
def castle_nut(s, m, bore, dk, m1, n_slots, e, chamfer=None):
    ...
```

Construction order:

1. `hex_solid = _chamfered_hex_solid(s, m1, chamfer)` — chamfered vertex-up hex body of
   height **m1** (the un-slotted portion). Reused unchanged from `hex_nut.py`.
2. **Crown:** union `Cylinder(radius=dk/2, height=m - m1)` seated with its base at z=m1
   (`align Z=MIN`), rising to z=m. Every sourced `dk/2 < s/2`, so the crown sits within
   the hex top face with a realistic annular shoulder.
3. **Slots:** subtract `n_slots` rectangular boxes (width `e`, radial length `dk/2 +
margin`, height `m - m1 + margin`) via `PolarLocations(slot_len/2, n_slots,
start_angle=_SLOT_START_DEG)`, each box floor exactly at z=m1. For even n this reads
   as diametral saw-cuts through the bore — the real manufacturing.
4. **Bore:** subtract a through `Cylinder(radius=bore/2, height=m*3)` last, exactly like
   `hex_nut`.

`_SLOT_START_DEG = 0.0` → first slot centred on +X (the vertex-up up-axis); slots at
`k*360/n_slots`. Clocking is cosmetic (dk < the hex inscribed circle, so slots never
reach the flats/corners). `margin` is a build overshoot (like cap_nut's trim box), not a
physical constant.

### Guards (ValueError)

1. `bore > 0` and `bore < s - _MIN_WALL_MM` (reuse hex_nut's wall rule).
2. `0 < m1 < m` (crown height `m - m1 > 0`; a hex body remains under the crown).
3. `dk <= s` (crown is a genuine turned-down cylinder within the flats; a shoulder
   exists, no overhang).
4. `dk > bore` (a crown wall remains around the bore for the towers).
5. `0 < e < dk` (each slot narrower than the crown).
6. `n_slots >= 1` and integer, and `n_slots * e < math.pi * dk` (castellation towers
   survive the total slot width).
7. Helper-inherited: `_chamfered_hex_solid(s, m1, chamfer)` validates `s > 0`, `m1 > 0`,
   chamfers fit.
8. Final `part.volume > 0` net guard (matches the family; not `is_valid`).

### No new representative constant

Every dimension (s, m, m1, dk, n, e) is sourced per standard. `bore = 10.1` is the
established M12 thread-minor family constant (already used by hex_nut/flange_nut). The
30° chamfer comes from the shared helper. No novel representative like
`_FLANGE_CONE_ANGLE_DEG` is introduced.

## Documented simplification (don't-fabricate)

Crown base = slot floor = **m1**, so the narrow crown is fully slotted with no solid
crown band below the slots. Real castle nuts usually have a short solid crown ring under
the slots, but no public table publishes the hex→crown transition height, so modelling
one would fabricate a dimension. Recorded in each entry's `source` string. Same class of
choice as "cap nut = solid body, no bore."

## Data

New `catalog/dimensions/castle_nuts.json`. Shape = `{s, m, bore, dk, m1, n_slots, e}`.

| id        | family         | s    | m    | bore | dk   | m1   | n_slots | e   | kind     |
| --------- | -------------- | ---- | ---- | ---- | ---- | ---- | ------- | --- | -------- |
| `din935`  | castle_nut     | 18.0 | 15.0 | 10.1 | 16.0 | 10.0 | 6       | 3.5 | distinct |
| `din937`  | castle_nut     | 19.0 | 10.0 | 10.1 | 17.0 | 6.0  | 6       | 3.5 | distinct |
| `din979`  | castle_nut     | 18.0 | 10.0 | 10.1 | 16.0 | 5.0  | 6       | 3.5 | distinct |
| `iso7035` | alias → din935 | —    | —    | —    | —    | —    | —       | —   | alias    |

All three DIN entries distinct (envelopes differ in ≥2 fields pairwise). Sourcing (each
≥2 independent public tables; conflicts tie-broken):

- **DIN 935** s=18 (current ISO 272 / SW18; legacy SW19 not shipped), m=15, m1(w)=10,
  dk=16, n=6, e=3.5. Fuller Fasteners, Aspen, Trojan SF, Fabory.
- **DIN 937** s=19 (SW19 — the withdrawn legacy standard genuinely used the old width;
  confirmed by all five tables), m=10, m1(w)=6.0 (the geometric slot-floor height, not
  the 5.3 mm m′ proof-load minimum), dk=17, n=6, e=3.5. fasteners.eu, Fuller, fasenco,
  Aspen.
- **DIN 979** s=18 (current successor to DIN 937, SW18), m=10, m1=5, dk=16, n=6, e=3.5.
  Fuller Fasteners, Trojan SF.
- **ISO 7035** = DIN 935 (ISO counterpart, style 1); M12 row verified identical (s=18,
  m=15, w=10, dk=16, 6 slots, 3.5) vs fasteners.eu ISO 7035, TorqBolt ISO 7035, Bolting
  Specialist + combined DIN 935/ISO 7035 listings → aliases din935 (same
  `iso8673→iso4032` pattern).

`bore = 10.1` = M12 thread minor diameter (family constant). `e = 3.5` is the DIN "n"
slot groove min (max 3.8); 3.5 is the modelling value. Source strings cite only public
tables — never any private/internal catalogue.

## Registration & render

- `catalog/models/_registry.py`: add `"castle_nut": castle_nut` to `KNOWN_FAMILIES`.
- `catalog/build_catalog.py`: unchanged — auto-globs `dimensions/*.json`, renders via
  `preset_for_hardware_type("nut")` → vertex-up `NUT_PRESET`.

## Testing

- `catalog/tests/test_castle_nut.py` (generator): vertex-up extents (across-corners on X,
  s on Y, m on Z), crown narrower than the hex (vertices above m1 within dk/2), slots
  remove material (n=6 volume < n=2 volume, same other params), bore open (tiny-bore
  volume > real-bore volume), all guards raise.
- `catalog/tests/test_castle_nuts_data.py` (data): every entry validates + builds,
  family/hardwareType correct, sourced + verified, alias points at a real non-alias base,
  and no source string contains a forbidden token (`reyher`/`stalmut`).
- Existing hex_nut / flange_nut / cap_nut / washer tests stay green; existing SVGs stay
  byte-identical (no shared code changed — `_chamfered_hex_solid` reused unchanged).

## Rollout / invariants

- **Opt-in 0/0:** `data/image-mappings.json` and `src/lib/data/standards-generated.ts`
  keep 0 `.svg` refs. Catalog-only; legacy raster stays default.
- In-container only: `./catalog/run pytest ...` and `./catalog/run python -m
catalog.build_catalog`.
- Build produces 3 new drawings (din935/din937/din979) + the din935-aliased iso7035; no
  existing drawing changes (sha256 byte-identical).
- Convention: TDD → commit → push → PR → zen review (deepseek-v4-pro, generator is a
  shared surface) → apply findings as additional commits → CI green → squash-merge
  (admin).

## Global constraints (verbatim)

- Representative size **M12**. DIN 935/979 ship **s = 18** (no legacy SW19); DIN 937
  ships **s = 19** (its actual standard width).
- Every committed dimension confirmed by **≥2 independent public tables**.
- Source strings: **no** `reyher`, `stalmut`, or any private/internal catalogue.
- Reuse `_chamfered_hex_solid` **unchanged** (existing SVGs byte-identical).
- **No render/preset change.** Vertex-up orientation inherited from the helper + preset.
- opt-in invariant 0/0 after build.
