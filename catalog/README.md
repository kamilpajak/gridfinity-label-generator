# Fastener asset catalog (maintainer-only)

Generates the 2D SVG technical drawings shipped in `static/images/standards/`.
The app and `pnpm build` do NOT run this — outputs are committed files.

## Add / fix a standard

1. Add or edit its entry in `catalog/dimensions/<hardwareType>.json`
   (`family`, `shape` params, `hardwareType`, `source` citation, `designations`).
2. Point `family` at a generator in `catalog/models/_registry.py`
   (add a new generator only for a genuinely new shape family).
3. Generate + QA (all commands run in the pinned container via `./catalog/run`):
   - `./catalog/run pytest catalog/tests -v`
   - `./catalog/run python catalog/build_catalog.py`
   - `./catalog/run python catalog/qa/coverage.py`
   - `./catalog/run python catalog/qa/contact_sheet.py` (review the HTML)
4. Integrate the SVGs into the app:
   - `./catalog/run python catalog/integrate.py` — copies the SVGs into
     `static/images/standards/` and repoints `data/image-mappings.json`.
   - Update `src/lib/data/standards-generated.ts` **surgically**: change the `image`
     path only for the migrated **top-level** entries to the new `.svg`.
5. Commit the new SVG(s), `image-mappings.json`, the surgical
   `standards-generated.ts` image edits, and `manifest.json`.

> **Do NOT run `pnpm standards:build` to integrate.** That command regenerates the
> whole `standards-generated.ts` from the maintainer pipeline and **requires the local
> `data/dinmedia-*.json` cache** (git-ignored, not committed). Without the cache it
> produces a **lossy** dataset — it drops fields and breaks search (721→711 passing
> unit tests). `standards-generated.ts` is the authoritative committed artifact; edit
> its `image` paths by hand for a migration, and only run `standards:build` when the
> full dinmedia cache is present.

Determinism: versions are pinned in `requirements.txt` / `requirements.lock` and
recorded in `manifest.json`. Regenerating the whole catalog is a deliberate,
reviewed operation — never silent CI.

## Known scope / follow-ups

**Flat-washer ISO wiring is deferred (option A).** DIN 125, 126, 433, and 9021
are served in the app through their ISO-equivalent entries (iso7089, iso7090,
iso7091, iso7093). Those ISO entries still point at the old PNGs in
`data/image-mappings.json`, so repointing them in that file is currently a UI
no-op — the SVG files exist but are not reached by those ISO keys. Repointing
the ISO rendering-entries to the generated SVGs is deferred to the supervised
data/mapping pass: each ISO→SVG assignment must be verified on the contact sheet
before committing. DIN 127 and DIN 128 are top-level entries with no ISO alias
and already render the new SVG live.

**Toothed lock washers — all real DIN forms generated.** Three generators cover
the family: `toothed_lock_washer` (external teeth on the outer edge — DIN 6797 A
/ 6798 A), `toothed_lock_washer_internal` (teeth on the bore — DIN 6797 J /
6798 J), and `countersunk_toothed_washer` (external teeth on a body dished for a
90° countersunk screw — DIN 6798 V). Same body per standard; tooth count carries
the coarse-vs-fine identity.

`din6798d` still shows in the coverage gate but is **not a real DIN form** — "Form
D" is a catalog-specific label whose geometry maps to Form V. It is deliberately
not generated (nothing to fabricate); resolve it at the app-data level (alias
`din6798d` to the Form V drawing, or drop the key), not with a new generator.

**Tab lock washers — generated.** `tab_washer` builds a round disc with one or
more locking tabs bent up ~90°: external at the rim (DIN 432 nose, DIN 93 one tab,
DIN 463 two tabs) or internal at the bore (DIN 462, `"internal": true` per tab).
Disc dimensions and tab widths are sourced; tab **lengths** are representative (the
manufacturer tables datum them inconsistently) and flagged in each `source` string.
DIN 7980 is a split spring lock washer (not a tab) and reuses `helical_spring_washer`,
like DIN 127. The plated `p`-suffix variants are handled by the alias mechanism (below).

**Spherical seating washers (DIN 6319) — generated.** `spherical_seating_washer`
builds the matched pair by revolving a meridian cross-section with a true spherical
arc (the first family to use arc edges, so the face view stays a clean bore + rim
pair of circles rather than a stack of facet circles). The convex form (Form C,
`concave` = false, Kugelscheibe) has a flat top and a convex spherical underside; the
concave form (Form D, `concave` = true, Kegelpfanne) is the mating seat with a concave
spherical recess. Form G (enlarged outer diameter for slotted holes) is supported via
`seat_diameter` — the recess reaches that diameter and a flat flange fills out to
`d_outer` — but only C and D are app-served, so no Form G data entry is shipped. The
mating `sphere_radius` is representative: DIN tables publish it inconsistently, so it
is chosen to mate the two forms and leave a sensible floor under the seat's recess
(flagged in each `source`).

**Spring washers (DIN 137) — Form A shipped, Form B deferred.** DIN 137 A (gewölbt /
curved-domed, a continuous washer with no split) reuses `curved_washer` with `gap_deg` = 0
and renders cleanly. DIN 137 B (gewellt / waved, the multi-wave ring) has a working
`wave_washer` generator — it sweeps the rectangular section along a closed sinusoidal path
(three waves is typical; DIN does not fix the count) and sews the result into a seamless
four-face solid — but it is **not yet wired to a data entry**. A swept periodic surface
carries a parametric seam that the generic edge projector draws as a short radial line in
the plan view; revolved families avoid this, sweeps cannot. `din137b` stays in the
coverage gate until that plan-view seam is resolved (a seamless closed-pipe primitive, or
seam-edge filtering in `render.py`). The generator and its geometry tests are kept so the
work is ready to wire up once the render side can drop the seam.

**Plain flat washers (DIN 6340 / 1440 / 7349 / 7603 / 988, ISO 8738) — generated.**
These reuse `flat_washer` (annular disc); each is one sourced data entry, no new
generator. DIN 6340 (13×35×5, clamping fixtures), DIN 1440 and ISO 8738 (12×25×3, the two
are dimensionally equivalent clevis-pin washers), and DIN 7349 (13×30×6, heavy thick) come
straight from Fasteners.eu tables. DIN 7603 (12×18, sealing ring) and DIN 988 (12×18, shim
ring) have a **representative thickness** — both are thickness _series_ rather than a single
value — flagged in each `source`. The duplicate/variant app keys that share these standards'
images (`din6340d`, `din1440i`, `iso8738p`, and the plated `p`-suffix set) are covered by the
alias mechanism (below). **DIN 25201 wedge-lock is intentionally not generated:** its cam angle,
cam count, and tooth geometry are proprietary (absent even from the patents), and for M12
the cams are ~0.2 mm — sub-visible at label scale — so there is nothing faithful to draw.

**DIN 440 / DIN 74361 not generated.** DIN 440 Form V (`din440v`) has a _square_ bore, which
`flat_washer` (round bore) does not model; Form R (`din440r`) OD/thickness are not cleanly
published. DIN 74361 C (`din74361c`) is a conical wheel-bolt collar washer, a separate shape.

**Alias entries — variant keys reuse a base drawing.** A dimension entry may carry
`alias_of: "<base-id>"` instead of `family` + `shape`. The build renders bases first, then
points each alias at its base's SVG and hash (recording `alias_of` in the manifest) — no
duplicate file is written. This covers standards whose geometry is identical to a base:
plated `p`-variants (plating does not change shape), the `i`-suffix variant keys (the app
already serves them the base image), `din128a` (Form A is the base curved washer),
`din2093d` / `din6340d`, and `din6798d` (its "Form D" label resolves to Form V, so it
aliases `din6798v`). An `alias_of` target must be a rendered base, not another alias.

**Remaining washer gaps (all deliberate).** After the alias pass only five entries stay in
the coverage gate: `din137b` (wave washer — generator ready, plan-view seam deferred),
`din25201` (wedge-lock — proprietary, sub-visible), `din440r` / `din440v` (DIN 440 not
generated — see above), and `din74361c` (conical collar, a different shape).

**Nut families — DIN 80701 and DIN 562 not generated (deliberate).** Every other nut
standard that carries a legacy raster is generated; two are documented skips:

- **`din80701`** (toggle / long-lever wing nut) is a distinct form from the DIN 315 wing nut
  (long straight bar wings, ~240 mm span on M16, not rounded paddles). It fails the sourcing
  bar: only a single second-hand vendor table exists (Aspen, which states its data is "not
  acquired through standards agencies"), it lists only M16–M24 (no M10/M12), and no second
  independent public table was found. The representative M12 size is not publicly documented
  and the exact wing form cannot be verified against an authoritative reference — so there is
  nothing faithful to draw without fabricating both dimensions and shape.
- **`din562`** (thin square nut) — the standard's normative range is M1.6–M10; **M12 is not
  defined** by DIN 562. "DIN 562 M12" listings are manufacturer extensions coinciding with
  DIN 557. We do not ship a size the standard does not define.
