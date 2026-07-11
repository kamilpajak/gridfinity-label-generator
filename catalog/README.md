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

**Toothed lock washers — external and internal (flat) forms generated.**
`toothed_lock_washer` covers external-tooth forms (teeth on the outer edge):
DIN 6797 A (coarse toothed / Zahnscheibe) and DIN 6798 A (fine serrated /
Fächerscheibe). `toothed_lock_washer_internal` covers internal-tooth forms
(teeth on the bore): DIN 6797 J and DIN 6798 J. Same body per standard; tooth
count carries the coarse-vs-fine identity. Only the countersunk / dished forms
remain in the coverage gate (`din6798d`, `din6798v`) — they need a conical body
matching a countersunk screw head, a separate model, and are a follow-up.
