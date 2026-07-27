# Hex-Head Bolt Coverage (screw gap, family 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 12 plain hex-head bolt ids in the `coverage.py` screw gap by adding one sourced base
(`din931`) and 11 aliases to `catalog/dimensions/hex_bolts.json`, reusing `hex_bolt` (no code change).

**Architecture:** Envelope-only drawing collapses all M12 plain hex bolts to two head widths — ISO
s=18 (`iso4014`, exists) and DIN s=19 (`din931`, new). Thread pitch/length aren't drawn, so
coarse/fine and partial/full are the same drawing (`iso4017` already aliases `iso4014`). One new
data entry + 11 aliases; the build renders one new SVG (`din931.svg`).

**Tech Stack:** JSON data, `build123d` (run ONLY in the pinned container via `./catalog/run`), pytest.

## Global Constraints

- Reuse `hex_bolt` with **no code change**; add 1 base (`din931`) + 11 aliases to
  `catalog/dimensions/hex_bolts.json`. Modify no generator.
- Representative size **M12**: `din931` `s = 19.0`, `k = 7.5` (confirmed ≥2 named public tables at
  the sourcing gate); `length = 60.0` representative; `head_chamfer = 19.0`, `tip_chamfer = 1.0`
  (mirroring the existing `iso4014` shape at the DIN head width).
- **Aliases never chain:** DIN variants target base `din931`; ISO variants target base `iso4014`
  (never the aliases `din933`/`iso4017`). `hardwareType: "screw"` on every entry. `verified: true`.
- Source strings cite only public tables — **no** `reyher`, `stalmut`, or any private catalogue.
- **Generate-only:** do NOT modify `data/image-mappings.json` or
  `src/lib/data/standards-generated.ts`, and do NOT run `catalog/integrate.py`. `grep -c '.svg'` on
  the diff of both files must be 0. Existing SVGs stay **byte-identical**; manifest change additive.
- After the build, `coverage.check(manifest, image_mappings, "screw")` no longer lists the 12 ids
  (screw gap 85 → 73). No render/preset change.
- All build/test runs in-container: `./catalog/run python -m pytest …`,
  `./catalog/run python -m catalog.build_catalog`.

---

### Task 1: Hex-bolt coverage data + tests + build

**Files:**

- Modify: `catalog/dimensions/hex_bolts.json` (add 1 base + 11 aliases)
- Modify: `catalog/tests/test_hex_bolts_data.py` (add the coverage assertions)
- Build output (generated, committed): `catalog/out/din931.svg` + additive `catalog/out/manifest.json`

**Interfaces:**

- Consumes: `hex_bolt(s, k, length, d_shank, head_chamfer=None, tip_chamfer=None)` (existing, unchanged);
  `validate_entry` from `catalog.schema`; `build_part` from `catalog.models._registry`;
  `catalog.qa.coverage.check`.
- Produces: 12 new hex-bolt data entries (1 base + 11 aliases) that validate, build, and close the
  gap ids.

**SOURCING GATE (controller-supplied — do NOT invent numbers).** The exact `din931` shape and every
`source` string are provided by the controller's sourcing gate (in
`.superpowers/sdd/task-1-sourcing.md`), each envelope dim confirmed against ≥2 named public tables.
The sourcing gate also fixes whether `din960`/`din961` (+ their `i` variants) alias `din931` (s=19)
or `iso4014` (s=18). Transcribe the provided values and alias targets verbatim; do not guess.

- [ ] **Step 1: Write the failing coverage assertions**

Append to `catalog/tests/test_hex_bolts_data.py`:

```python
# The DIN M12 hex head is s=19 (its own drawing din931); the ISO M12 head is s=18 (iso4014).
# Pitch/thread-length are not drawn, so fine/coarse and full/partial collapse onto these two bases.
# NOTE: the din960/din961 (+ i) alias target is confirmed at the sourcing gate; if a table shows
# they use s=18 they alias "iso4014" instead. Update _NEW_HEX_ALIASES to match the sourced values.
_NEW_HEX_ALIASES = {
    "din933": "din931", "din960": "din931", "din961": "din931",
    "din931i": "din931", "din933i": "din931", "din960i": "din931", "din961i": "din931",
    "iso8676": "iso4014", "iso8765": "iso4014", "iso4014p": "iso4014", "iso4017p": "iso4014",
}


def test_din931_is_the_din_head_base():
    entries = json.loads(DATA.read_text())
    assert "din931" in entries and "alias_of" not in entries["din931"]   # a real drawing, not an alias
    assert entries["din931"]["family"] == "hex_bolt"
    assert entries["din931"]["hardwareType"] == "screw"
    assert entries["din931"]["shape"]["s"] == 19.0                        # DIN head width (ISO is 18.0)
    build_part(entries["din931"]["family"], entries["din931"]["shape"])   # builds without raising


def test_new_hex_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _NEW_HEX_ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from hex_bolts.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_bolts_data.py -q`
Expected: FAIL — `din931` and the new alias keys are not in `hex_bolts.json` yet.

- [ ] **Step 3: Add the data entries**

Add these 12 entries to `catalog/dimensions/hex_bolts.json` (alongside the existing `iso4014`/
`iso4017`), filling `din931`'s shape and every `source` string from the controller's sourcing-gate
values. The illustrative numbers below are SHAPE-ONLY — replace with the sourced values; keep the
existing entry shape (`family`/`shape`/`hardwareType`/`source`/`verified`/`designations` for the
base; `alias_of`/`hardwareType`/`source`/`verified`/`designations` for aliases).

Base (`din931`):

```json
"din931": {
  "family": "hex_bolt",
  "shape": { "s": 19.0, "k": 7.5, "length": 60.0, "d_shank": 12.0, "head_chamfer": 19.0, "tip_chamfer": 1.0 },
  "hardwareType": "screw",
  "source": "<DIN 931 hex head bolt (partial thread), M12: s=19.0 (across-flats, the DIN head width — ISO 4014 reduced it to 18.0) and k=7.5 confirmed vs >=2 named public tables (name them). d_shank=12.0 M12 major; length=60.0 representative; head_chamfer=19.0=s; tip_chamfer=1.0 representative. Envelope only (no thread).>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "931" }]
}
```

Aliases (one per remaining id; `<BASE>` is `din931` or `iso4014` per `_NEW_HEX_ALIASES` / the
sourcing gate). Each `source` states the shared M12 hex envelope and why it aliases (pitch and
thread length are not drawn):

```json
"din933": {
  "alias_of": "din931",
  "hardwareType": "screw",
  "source": "<DIN 933 fully threaded hex bolt, M12 — same M12 hex envelope as DIN 931 (s=19, k=7.5); only thread coverage differs (not drawn), so it aliases the DIN base. Confirmed vs the same >=2 tables.>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "933" }]
}
```

The full id → base + designation map to produce (exactly these 12 entries):

| id         | kind  | alias_of | designation `{system, code}` |
| ---------- | ----- | -------- | ---------------------------- |
| `din931`   | base  | —        | `{DIN, 931}`                 |
| `din933`   | alias | din931   | `{DIN, 933}`                 |
| `din960`   | alias | din931\* | `{DIN, 960}`                 |
| `din961`   | alias | din931\* | `{DIN, 961}`                 |
| `din931i`  | alias | din931   | `{DIN, 931}`                 |
| `din933i`  | alias | din931   | `{DIN, 933}`                 |
| `din960i`  | alias | din931\* | `{DIN, 960}`                 |
| `din961i`  | alias | din931\* | `{DIN, 961}`                 |
| `iso8676`  | alias | iso4014  | `{ISO, 8676}`                |
| `iso8765`  | alias | iso4014  | `{ISO, 8765}`                |
| `iso4014p` | alias | iso4014  | `{ISO, 4014}`                |
| `iso4017p` | alias | iso4014  | `{ISO, 4017}`                |

`*` = final target (`din931` vs `iso4014`) set by the sourcing gate's din960/din961 across-flats
finding; keep `_NEW_HEX_ALIASES` in the test in sync with the committed data.

- [ ] **Step 4: Run the data tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_bolts_data.py -q`
Expected: PASS — the existing sweep (validate+build, family/type, sourced+verified, forbidden
tokens) plus the two new tests.

- [ ] **Step 5: Run the full suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — no regressions.

- [ ] **Step 6: Build the drawing and verify coverage + invariants**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: one new SVG `catalog/out/din931.svg`; the 11 aliases render no new file; `manifest.json`
gains the 12 entries.

Verify the screw gap shrank and invariants hold:

```bash
# Screw gap dropped by exactly these 12 (85 -> 73); confirm none of the 12 remain missing:
./catalog/run python -c "import json; from catalog.qa.coverage import check; \
m=check('catalog/out/manifest.json','data/image-mappings.json','screw'); \
ids={'din931','din933','din960','din961','din931i','din933i','din960i','din961i','iso8676','iso8765','iso4014p','iso4017p'}; \
print('still missing among ours:', sorted(ids & set(m))); print('screw gap size:', len(m))"
# Expect: "still missing among ours: []" and "screw gap size: 73"

# Existing drawings byte-identical (only din931.svg new):
git status --porcelain catalog/out    # expect: only din931.svg as ?? + modified manifest.json

# manifest additive; normalise prettier churn if any:
pnpm exec prettier --write catalog/out/manifest.json
git diff --numstat catalog/out/manifest.json   # small line count = only the 12 new entries

# Generate-only: these must NOT be touched:
git diff --stat data/image-mappings.json src/lib/data/standards-generated.ts | grep -c '.svg'
# Expect: 0
```

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/hex_bolts.json catalog/tests/test_hex_bolts_data.py catalog/out/din931.svg catalog/out/manifest.json
git commit -m "feat(catalog): add DIN hex-bolt coverage (din931 base + 11 aliases)"
```

---

## Notes for the controller (sourcing gate + review)

- **Sourcing gate before Task 1:** confirm `din931` M12 `s = 19.0` and `k = 7.5` against ≥2 named
  public tables; confirm DIN 960 / DIN 961 M12 across-flats (18 vs 19) to fix their alias target
  (and update `_NEW_HEX_ALIASES` + the data to match). Hand the implementer the `din931` shape and
  all 12 `source` strings. Perplexity / Playwright MCP may read tables.
- **Visual confirmation before merge:** render `din931.svg` and eyeball it — a chamfered hex head
  (s=19) + smooth shank, visually the DIN sibling of the existing `iso4014` (very slightly wider
  head). Serve `catalog/out` over `http.server` for a Playwright check if desired.
- **zen review** (`deepseek/deepseek-v4-pro`, thinking=high) after push + PR — even though there's
  no code, the data/alias correctness on a shared data surface is worth the pass. Apply findings as
  additional commits.
- **Coverage:** after Task 1, the screw gap is 73 (down from 85). This is measured, not gated
  (`coverage.py`'s CI gate enforces only `washer`).
