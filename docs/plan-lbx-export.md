# Plan: Export to Brother P-touch `.lbx`

**Status:** Proposed (not started)
**Owner:** maintainer
**Related:** Recommended Products already promote Brother P-touch printers (PT-E560BT, PT-P710BT)

## Summary

Add an **"Export to P-touch (`.lbx`)"** action alongside the existing PNG export. Unlike a
PNG (a raster the user must import into P-touch Editor), an `.lbx` file opens natively in
Brother P-touch Editor with **editable text** on the correct tape, ready to print or tweak.

Feasibility is **confirmed**: `.lbx` is a ZIP of XML, the schema is well understood, and
P-touch Editor ships **1501 real `.lbx` templates** on macOS — including a fastener label
("Bin Box") that is almost exactly what this app produces. We model the generator on those
golden samples and validate by opening generated files in the installed P-touch Editor.

## Why (value)

- Native, **editable** output on Brother hardware (the app's promoted printers) vs a flat PNG.
- Correct tape width and print metadata baked in.
- Text stays text (searchable/editable/re-sizable), not pixels.

## The `.lbx` format (from real golden samples)

`.lbx` = a ZIP archive containing `label.xml` (layout + objects), `prop.xml` (metadata), and
optional embedded bitmaps. Text/barcode-only labels omit bitmaps (2 files only).

Golden references on disk (installed P-touch Editor, this exact version):

- `/Applications/P-touch Editor.app/Contents/Resources/Template/en/Roll/**/*.lbx` — 1501 templates.
  Filenames/dirs under `Template/` are URL-encoded (`Bin%20Box.lbx`).
- Best analogue: `.../en/Roll/Asset%20Management/Bin%20Box.lbx` — a fastener label
  (`1/4 - 20 NF Thread Size`, `Lock Washer`) with a barcode. Use this as the primary model.

Community references: `jdlien/lbx-utils` (Python generator + `lbx-specification.md` + XSD),
`Alecto3-D/brother-p-touch-editor-format` (sample XML). No JS/TS writer exists — we port.

### `prop.xml` (metadata)

Namespaces: `meta="http://schemas.brother.info/ptouch/2007/lbx/meta"`, `dc`, `dcterms`.

```xml
<meta:properties xmlns:meta="…/meta" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  <meta:appName>P-touch Editor</meta:appName>
  <dc:title>…label title…</dc:title>
  <dc:creator>…</dc:creator>
  <dcterms:created>…Z</dcterms:created>
  <dcterms:modified>…Z</dcterms:modified>
  <meta:revision>1</meta:revision>
  <meta:numPages>1</meta:numPages>
  <!-- plus meta:security etc. — copy the field set + order from a golden sample -->
</meta:properties>
```

### `label.xml` (layout + objects)

Root `<pt:document version="1.0">` with 8 namespaces, all
`http://schemas.brother.info/ptouch/2007/lbx/{main,style,text,draw,image,barcode,database,table}`.
**Units are points (`pt`).** Element order is significant.

Skeleton (condensed from the real Bin Box template):

```xml
<pt:document version="1.0" xmlns:pt="…/main" xmlns:style="…/style" xmlns:text="…/text"
             xmlns:image="…/image" xmlns:barcode="…/barcode" …>
  <pt:body currentSheet="Sheet 1">
    <style:sheet name="Sheet 1">
      <style:paper media="0" width="48.2pt" height="152.6pt"
                   marginLeft="4.3pt" marginTop="8.4pt" marginRight="4.3pt" marginBottom="8.4pt"
                   orientation="landscape" autoLength="false" paperColor="#FFFFFF" paperInk="#000000"
                   format="269" printerID="…" printerName="Brother …"/>
      <style:cutLine regularCut="0pt" freeCut=""/>
      <style:backGround x="…pt" y="…pt" width="…pt" height="…pt" brushStyle="NULL" .../>
      <pt:objects>

        <text:text>
          <pt:objectStyle x="…pt" y="…pt" width="…pt" height="…pt" anchor="TOPLEFT" …>
            <pt:pen style="NULL" .../><pt:brush style="NULL" .../>
            <pt:expanded objectName="" ID="…" lock="0" .../>
          </pt:objectStyle>
          <text:ptFontInfo>
            <text:logFont name="Helsinki Narrow" weight="700" italic="false" charSet="0" pitchAndFamily="34"/>
            <text:fontExt effect="NOEFFECT" size="10pt" orgSize="28.8pt" textColor="#000000"/>
          </text:ptFontInfo>
          <text:textControl control="FIXEDFRAME" shrink="true" clipFrame="false" autoLF="false"/>
          <text:textAlign horizontalAlignment="CENTER" verticalAlignment="CENTER" inLineAlignment="BASELINE"/>
          <text:textStyle vertical="false" charSpace="0" lineSpace="-25" orgPoint="10pt"/>
          <pt:data>Lock Washer</pt:data>
          <text:stringItem charLen="11"><text:ptFontInfo>…same font…</text:ptFontInfo></text:stringItem>
        </text:text>

        <barcode:barcode>
          <pt:objectStyle x="…pt" y="…pt" width="…pt" height="…pt" anchor="TOP" …>…</pt:objectStyle>
          <barcode:barcodeStyle protocol="QRCODE" …/>   <!-- UPCA in the sample; QR params from a QR template -->
          <pt:data>https://…</pt:data>
        </barcode:barcode>

      </pt:objects>
    </style:sheet>
  </pt:body>
</pt:document>
```

Key facts that simplify the implementation:

- **Font:** use a Brother built-in font (`Helsinki` / `Helsinki Narrow`), not the app's Noto Sans / Oswald (not present in P-touch). Text is editable, so exact visual parity with the PNG is not required.
- **`textControl shrink="true"`** auto-shrinks text to its frame → **no per-glyph metric math needed** to avoid clipping. This removes the plan's biggest complexity.
- **`text:stringItem`** runs partition the string by character count with per-run font. For uniform formatting, a **single `stringItem charLen={text.length}`** suffices.
- **Native barcode/QR** is viable (`barcode:barcode` + `protocol`), so QR can be an editable object, not just a bitmap.

## Codebase integration (existing code to reuse)

- **Label model:** `src/lib/types/batch.ts` — `LabelMode`, `TapeHeight` (9|12), `FastenerLabelConfig`,
  `GeneralLabelConfig`, `CustomImage`, `BatchLabel`, `BatchRenderData`.
- **Text:** `src/lib/utils/label-formatter.ts` — `formatPrimaryText`, `formatSecondaryText`,
  `appendOptionalNote`; batch: `deriveLabelText()` in `src/lib/utils/batch-renderer.ts`.
  These produce the exact strings the PNG uses → reuse verbatim for `pt:data`.
- **Dimensions:** margins `MARGIN_*_MM` (batch-renderer.ts), `MM_TO_INCH`; tape height 9/12 mm;
  label width 35–100 mm (`label-settings-content.svelte`). Optional layout: `solveLabelLayout()`
  (`src/lib/utils/label-constraint-solver.ts`) for element positions/font size.
- **Download mechanism:** `downloadCanvasAsPng()` in `src/lib/utils/label-exporter.ts:171` — extract a
  generic `downloadBlob(blob, filename)` and reuse for the `.lbx` Blob.
- **UI hooks:** single mode `downloadLabelAsPNG()` + button at `src/routes/+page.svelte:982`
  (guard `hasContent`); batch `handleExport()` + button in
  `src/lib/components/batch/batch-mode-panel.svelte:68`.

## Architecture (new modules)

| File                                  | Mirrors             | Role                                               |
| ------------------------------------- | ------------------- | -------------------------------------------------- |
| `src/lib/utils/lbx/units.ts`          | —                   | `mmToPt` (`* 72/25.4`), tape/margins → paper block |
| `src/lib/utils/lbx/label-xml.ts`      | —                   | config → `label.xml` string (namespaced, ordered)  |
| `src/lib/utils/lbx/prop-xml.ts`       | —                   | config → `prop.xml` string                         |
| `src/lib/utils/lbx/lbx-zip.ts`        | —                   | zip files → `Blob` (**fflate**, ~8 KB, zero-dep)   |
| `src/lib/utils/label-lbx-exporter.ts` | `label-exporter.ts` | single label → `.lbx` → download                   |
| `src/lib/utils/batch-lbx-exporter.ts` | `batch-exporter.ts` | batch → ZIP of N `.lbx`                            |

Dependencies to add: **`fflate`** (ZIP). XML via hand-rolled template functions + `xmlEscape`
(schema is fixed; element order is load-bearing; avoid a heavy XML builder). QR reuses the
existing `qrcode` dependency if we go the bitmap route.

## Data mapping

- **Tape:** app `labelHeight` (9|12 mm) → Brother tape **width**; app `labelWidth` (mm) → label
  **length**. Convert to `pt`. Lift the exact `style:paper` attribute set (media/format/printerID)
  from a **PT-series continuous-tape** golden template (the Bin Box sample is a QL die-cut roll).
- **Text objects:** primary line = `formatPrimaryText(...)` / `deriveLabelText().primaryText`;
  optional secondary (general mode) = `secondaryText`; note appended as today. One `text:text`
  per line, `shrink="true"`, Helsinki font, single `stringItem`.
- **Positions:** MVP centers text in the printable area; later, map `SolverOutput` (mm→pt) for
  closer parity.

## Phased rollout

- **Phase 0 — spike / de-risk (do first):** generate a text-only `.lbx` modeled 1:1 on Bin Box;
  **open it in the installed P-touch Editor** to confirm acceptance. Lift the exact `style:paper`
  block for a 12 mm PT tape and the `prop.xml` field set from golden templates.
- **Phase 1 — MVP:** single-label, text-only (`units` + `label-xml` + `prop-xml` + `lbx-zip` +
  `label-lbx-exporter` + "Export .lbx" button + unit tests vs golden fixtures).
- **Phase 2 — QR:** native `barcode:barcode protocol="QRCODE"` (params lifted from a QR template),
  with a bitmap `image:image` fallback (reuses `qrcode` + custom-image base64).
- **Phase 3 — Batch:** `batch-lbx-exporter` → a ZIP of individual `.lbx` files (P-touch stores one
  label per file). Same success/error status UX as the PNG batch export.
- **Phase 4 — polish (optional):** custom images as `image:image`, closer positions from the solver,
  imperial/metric edge cases.

## Testing & validation

- **Unit (vitest):** `label.xml` / `prop.xml` generation against golden fixtures (namespaces,
  element order, tape width, `pt:data` content); `mmToPt`; ZIP structure (unzip + parse).
- **Integration:** generate → unzip → assert well-formed XML + required nodes.
- **Acceptance (manual, maintainer):** open generated `.lbx` in the installed P-touch Editor — the
  only true schema-acceptance test. Diff generated XML against the Bin Box golden sample.

## Risks & mitigations

| Risk                                                        | Mitigation                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| P-touch rejects the file (strict schema / order / versions) | Model 1:1 on installed golden templates; validate in P-touch (Phase 0) |
| Font mismatch (Noto/Oswald absent)                          | Use Helsinki/Helsinki Narrow; text is editable, parity not required    |
| Text clipping                                               | `textControl shrink="true"` (built-in auto-fit)                        |
| QR/barcode params                                           | Lift from a real QR template; bitmap fallback                          |
| Batch semantics                                             | ZIP of one `.lbx` per label                                            |
| Reverse-engineered format drift                             | Pin to one known-good structure; golden fixtures in tests              |

## Effort (estimate)

Phase 0+1 (MVP + validation) ~1–2 days · Phase 2 ~0.5–1 day · Phase 3 ~0.5 day · Phase 4 optional.

## References

- Golden samples: `/Applications/P-touch Editor.app/Contents/Resources/Template/` (1501 `.lbx`).
- `jdlien/lbx-utils` — https://github.com/jdlien/lbx-utils (spec + XSD + Python generator).
- `Alecto3-D/brother-p-touch-editor-format` — https://github.com/Alecto3-D/brother-p-touch-editor-format.
