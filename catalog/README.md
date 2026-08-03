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
   - `./catalog/run python -m catalog.integrate` — copies the SVGs into
     `static/images/standards/` and repoints `data/image-mappings.json`
     (new mapping entries get their `hardwareType` from `FAMILY_TO_HARDWARE_TYPE`;
     the dict is a deliberate whitelist — it raises for an unlisted family, so
     extend it explicitly when a new family first produces a brand-new mapping key).
   - `node scripts/catalog-repoint-standards.mjs` — the **surgical**
     `standards-generated.ts` update: repoints (or inserts) the `image` field for
     every shipped standard whose id is a manifest key. Touches nothing else.
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

**App integration is live.** Every manifest key is integrated: the SVGs are
copied into `static/images/standards/`, `data/image-mappings.json` points at
them, and `scripts/catalog-repoint-standards.mjs` keeps the shipped
`standards-generated.ts` in sync (117 shipped standards render an SVG). The
label renderer loads `.svg` standard images directly — the old png→svg
"priority" upgrade path (`AVAILABLE_SVGS`) is no longer load-bearing.

The repoint script has a second pass for shipped entries with no manifest key
of their own whose legacy png already showed another standard's drawing via a
designation cross-reference (e.g. `iso8678` → `din_603.png`): it swaps that png
for the same standard's svg — a like-for-like upgrade, no new equivalence
claim. Still deferred at the data level: the 18 `image-mappings.json` keys that
are not manifest keys and still point at legacy pngs (mostly unshipped ids);
repointing those is a per-key visual-equivalence decision for the contact
sheet.

`data/legacy-image-mappings.json` is a **frozen** snapshot of the standard →
raster mapping as it shipped before vectorization. `/dev/asset-compare` reads
its legacy column from that file, because `integrate.py` repoints the live
`data/image-mappings.json` at the generated SVGs — comparing against the live
file would show each drawing next to itself. Never regenerate the snapshot.

**Line style is a target on the paper, not a width in drawing units**
(`catalog/render.py`). The app scales every drawing into an image slot on the
label, but drawings span 21mm to 129mm in their own coordinates, so a width fixed
in drawing units reaches the paper at wildly different widths — the 0.5mm this
catalog used landed between 0.5 and 3.1 dots at 360dpi. `VISIBLE_DOTS` (1.5),
`HIDDEN_DOTS` (1.2) and `CENTER_DOTS` (0.9) are printed widths;
`_weights_for_geometry()` converts each back into drawing units per drawing. The
values keep the 5:4:3 ratio of the 0.5/0.4/0.3mm they replace and sit on what that
scheme printed at the median drawing, so the average weight is unchanged and only
the spread is gone. Tune them from printed results. All layers are pure black: the
printer is monochrome, so the former gray hidden line could only dither.

The reference is the slot the app hands a drawing on its DEFAULT label — 12mm
tape, 35mm long, no QR — which `calculateOptimalImageSize()` makes 11.4 x 10mm.
The slot is **not square** and the app fits contain-style, so the weights solve
against `min(slotW/w, slotH/h)`; sizing the pen from the drawing's longer side
alone made a portrait and a landscape drawing differ by half again on the same
label. On that reference every drawing prints 1.50 dots exactly. Longer labels
give a wider slot (22.1mm at 70mm, 32.6mm at 100mm), so a drawing reproduced there
is larger and its lines print proportionally thicker, up to 2.9x at 100mm — the
same behaviour as any illustration scaled up. Uniformity is a promise across
drawings at one label size, not across label sizes. With the QR code on a 35mm
label the slot collapses to 4mm and everything prints sub-dot; that is a layout
problem (a 57-dot drawing), not something a line width can fix.

The dash patterns are uniform too, by two different mechanisms. Hidden lines get
it for free: the exporter derives the dash from the line weight, and the weight
is now proportional to the drawing, so the dash lands on a constant 14.4 dots.
Centerlines are drawn as geometry with the pattern in dots (`_CENTER_LONG_DOTS`),
deliberately _not_ following the pen the way ISO 128 and the exporter do for a
full-size sheet: the width here is a printer setting being tuned, and tying the
rhythm to it collapsed 69 of 125 axes into a solid line when the pen went from
0.2 to 0.3mm.

For scale: the legacy rasters this catalog replaces measured a median of 1.14
printed dots, with 72 of 181 under a single dot. A uniform 2 dots was tried and
rejected as too heavy for the detail — see the commits "set line widths in
printed dots instead of drawing millimetres" and "draw at the 2-dot print floor".

**Drawings are simplified after sampling** (`_simplify`). Every projected edge is
sampled at `_SEGMENTS` points because the sampler cannot tell a line from an arc,
so a hex outline used to store each straight side as 73 points: 904 of the 942
paths in din472.svg were perfectly straight and the catalog weighed 14.5MB against
0.77MB for the rasters it replaces. Ramer-Douglas-Peucker at 1/2000 of the drawing
extent brings that to 1.3MB (0.24MB gzipped) and moves 1% of ink pixels, all of
them single boundary pixels. The standard picker renders one image per standard,
so its thumbnails also load lazily.

**Centerlines are drawn as geometry, not as a `stroke-dasharray`**
(`_chain_dashes`). ISO 128 wants a chain line to begin and end with a long dash;
a dash array cannot promise that, because the pattern simply runs until the line
stops, wherever that falls. Some arms therefore ended in a gap — the axis faded
out short of its tip, and the image carried an empty band up to 1.3mm wide,
since the view box follows the geometry, which does reach the tip. Each arm now
keeps its exact length (so the overhang past the outline stays consistent) and
the pattern is stretched to land on it — what a drafter does with the linetype
scale. What remains at the edge of the image is the half line width the exporter
adds so the outermost stroke is not clipped.

An arm collapses to a single solid stroke only when it is shorter than one long
dash. Rounding the repeat count without a floor also collapsed arms up to 1.8
long dashes, which drew 338 of the 750 axes as one continuous line — the wrong
line type, reading as an edge. Forcing the chain on costs rhythm instead: an arm
just over one long dash squeezes a whole period into it and its dashes run as
short as 0.4 of nominal, which is a far smaller lie than a solid line. 8 arms of
750 are now solid, and no segment exceeds the fitter's worst-case stretch.

**The view box hugs the drawing — no margin.** The whole box is scaled into a
fixed slot on the label, so any padding baked into the SVG comes straight out of
the drawing's own size. Spacing around the image belongs to whoever places it
(the label's constraint solver already keeps the image clear of the text). With
the former 2mm margin the geometry filled only 72-88% of the box (measured
against legacy rasters, which are cropped to the ink and fill 99-100%); it now
fills 86-93%, the rest being the centerline overhang. The exporter still pads by
half a line width so the outermost stroke is not clipped.

Not done, and why: dropping the hidden layer on dense drawings was considered,
but a 1-bit print simulation over all 125 drawings (erode twice, count surviving
ink) showed hidden lines cause only 23% of the fill-in, and 34 of the 89
affected drawings do not change at all without them. The fill-in that remains
comes from genuinely thin geometry — a washer or retaining ring seen edge-on is
a few dots thick, so it prints solid. Dropping the centerlines was also tried
and rejected: they are what makes the drawing read as an engineering drawing
rather than an icon.

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
