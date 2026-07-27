# Structural & Fit Hex-Bolt Coverage (screw gap, family 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 10 structural/fit hex-head bolt ids in the `coverage.py` screw gap by adding two
sourced bases (`din6914` HV heavy hex, `din609` fit-shank) and 8 aliases to
`catalog/dimensions/hex_bolts.json`, reusing `hex_bolt` (no code change).

**Architecture:** Envelope-only drawing collapses all 10 M12 structural/fit hex bolts to two new
head/shank combinations — heavy hex `s=22`/`d=12` (`din6914`, new) and standard head `s=19` with an
oversize fit shank `d=13` (`din609`, new) — plus the existing `din931` (`s=19`/`d=12`), which
absorbs the two `din7990` ids whose envelope is identical to the plain DIN hex bolt. Thread pitch
and thread-portion length aren't drawn, so fit/short/long variants collapse. Two new data entries +
8 aliases; the build renders two new SVGs (`din6914.svg`, `din609.svg`).

**Tech Stack:** JSON data, `build123d` (run ONLY in the pinned container via `./catalog/run`), pytest.

## Global Constraints

- Reuse `hex_bolt` with **no code change**; add 2 bases (`din6914`, `din609`) + 8 aliases to
  `catalog/dimensions/hex_bolts.json`. Modify no generator.
- Representative size **M12**: `din6914` `s = 22.0`, `k = 8.0`, `d_shank = 12.0`; `din609`
  `s = 19.0`, `k = 7.5`, `d_shank = 13.0` (the 13k6 oversize fit shank). Each confirmed by ≥2 named
  public tables at the sourcing gate. `length = 60.0` representative; `head_chamfer = s`,
  `tip_chamfer = 1.0` (mirroring the existing `din931`/`iso4014` shape at the new head/shank).
- **Aliases never chain:** the 8 aliases target the real non-alias bases `din6914`, `din609`, or the
  existing `din931` — never another alias. `hardwareType: "screw"` on every entry. `verified: true`.
- Source strings cite only public tables — **no** `reyher`, `stalmut`, or any private catalogue.
  Any representative or single-sourced value (`din7999` head, `length`) is flagged as such.
- **Generate-only:** do NOT modify `data/image-mappings.json` or
  `src/lib/data/standards-generated.ts`, and do NOT run `catalog/integrate.py`. `grep -c '.svg'` on
  the diff of both files must be 0. Existing SVGs stay **byte-identical**; manifest change additive.
- After the build, `coverage.check(manifest, image_mappings, "screw")` no longer lists the 10 ids
  (screw gap 73 → 63). No render/preset change.
- All build/test runs in-container: `./catalog/run python -m pytest …`,
  `./catalog/run python -m catalog.build_catalog`.

---

### Task 1: Structural/fit hex-bolt coverage data + tests + build

**Files:**

- Modify: `catalog/dimensions/hex_bolts.json` (add 2 bases + 8 aliases)
- Modify: `catalog/tests/test_hex_bolts_data.py` (add the coverage assertions)
- Build output (generated, committed): `catalog/out/din6914.svg`, `catalog/out/din609.svg` +
  additive `catalog/out/manifest.json`

**Interfaces:**

- Consumes: `hex_bolt(s, k, length, d_shank, head_chamfer=None, tip_chamfer=None)` (existing,
  unchanged); `validate_entry` from `catalog.schema`; `build_part` from `catalog.models._registry`;
  `catalog.qa.coverage.check`.
- Produces: 10 new hex-bolt data entries (2 bases + 8 aliases) that validate, build, and close the
  gap ids.

**SOURCING GATE (controller-supplied — do NOT invent numbers).** The exact `din6914` and `din609`
shapes and every `source` string are provided by the controller's sourcing gate (in
`.superpowers/sdd/task-1-sourcing.md`), each envelope dim confirmed against ≥2 named public tables.
Transcribe the provided values and alias targets verbatim; do not guess.

- [ ] **Step 1: Write the failing coverage assertions**

Append to `catalog/tests/test_hex_bolts_data.py`:

```python
# Family 2 (structural/fit hex bolts). Two new bases:
#   din6914 = heavy hex HV head (s=22, d=12); din609 = standard head with oversize fit shank
#   (s=19, d=13). din7990/din7990d share din931's plain envelope (s=19, d=12).
# Pitch and thread-portion length are not drawn, so fit/short/long variants collapse onto these.
_STRUCT_HEX_ALIASES = {
    "din6914i": "din6914", "din7999": "din6914",
    "din609p": "din609", "din610": "din609", "din610p": "din609", "din7968": "din609",
    "din7990": "din931", "din7990d": "din931",
}


def test_din6914_is_the_heavy_hex_hv_base():
    entries = json.loads(DATA.read_text())
    assert "din6914" in entries and "alias_of" not in entries["din6914"]   # real drawing, not alias
    assert entries["din6914"]["family"] == "hex_bolt"
    assert entries["din6914"]["hardwareType"] == "screw"
    assert entries["din6914"]["shape"]["s"] == 22.0                        # heavy hex head (>din931 19)
    assert entries["din6914"]["shape"]["d_shank"] == 12.0                  # standard (clearance) shank
    build_part(entries["din6914"]["family"], entries["din6914"]["shape"])  # builds without raising


def test_din609_is_the_fit_shank_base():
    entries = json.loads(DATA.read_text())
    assert "din609" in entries and "alias_of" not in entries["din609"]     # real drawing, not alias
    assert entries["din609"]["family"] == "hex_bolt"
    assert entries["din609"]["hardwareType"] == "screw"
    assert entries["din609"]["shape"]["s"] == 19.0                         # standard hex head
    assert entries["din609"]["shape"]["d_shank"] == 13.0                   # oversize fit shank (>12)
    build_part(entries["din609"]["family"], entries["din609"]["shape"])    # builds without raising


def test_struct_hex_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _STRUCT_HEX_ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from hex_bolts.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_bolts_data.py -q`
Expected: FAIL — `din6914`, `din609`, and the new alias keys are not in `hex_bolts.json` yet.

- [ ] **Step 3: Add the data entries**

Add these 10 entries to `catalog/dimensions/hex_bolts.json` (alongside the existing `iso4014`/
`iso4017`/`din931` + family-1 entries), filling both base shapes and every `source` string from the
controller's sourcing-gate values (`.superpowers/sdd/task-1-sourcing.md`) **verbatim**. Keep the
existing entry shape: base = `family`/`shape`/`hardwareType`/`source`/`verified`/`designations`;
alias = `alias_of`/`hardwareType`/`source`/`verified`/`designations`.

Base shapes (fill `source` from the sourcing file):

```json
"din6914": {
  "family": "hex_bolt",
  "shape": { "s": 22.0, "k": 8.0, "length": 60.0, "d_shank": 12.0, "head_chamfer": 22.0, "tip_chamfer": 1.0 },
  "hardwareType": "screw",
  "source": "<from sourcing gate>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "6914" }]
},
"din609": {
  "family": "hex_bolt",
  "shape": { "s": 19.0, "k": 7.5, "length": 60.0, "d_shank": 13.0, "head_chamfer": 19.0, "tip_chamfer": 1.0 },
  "hardwareType": "screw",
  "source": "<from sourcing gate>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "609" }]
}
```

The full id → base + designation map to produce (exactly these 10 entries — 2 bases + 8 aliases):

| id         | kind  | alias_of | designation `{system, code}` |
| ---------- | ----- | -------- | ---------------------------- |
| `din6914`  | base  | —        | `{DIN, 6914}`                |
| `din6914i` | alias | din6914  | `{DIN, 6914}`                |
| `din7999`  | alias | din6914  | `{DIN, 7999}`                |
| `din609`   | base  | —        | `{DIN, 609}`                 |
| `din609p`  | alias | din609   | `{DIN, 609}`                 |
| `din610`   | alias | din609   | `{DIN, 610}`                 |
| `din610p`  | alias | din609   | `{DIN, 610}`                 |
| `din7968`  | alias | din609   | `{DIN, 7968}`                |
| `din7990`  | alias | din931   | `{DIN, 7990}`                |
| `din7990d` | alias | din931   | `{DIN, 7990}`                |

Every alias `source` string (verbatim from the sourcing file) states the shared envelope, which
base it aliases, and why (pitch/thread-portion length not drawn; heavy-hex or fit-shank envelope
shared). Keep `_STRUCT_HEX_ALIASES` in the test in sync with the committed data.

- [ ] **Step 4: Run the data tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_hex_bolts_data.py -q`
Expected: PASS — the existing sweep (validate+build, family/type, alias-no-chaining, sourced+
verified, forbidden tokens) plus the three new tests.

- [ ] **Step 5: Run the full suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — no regressions.

- [ ] **Step 6: Build the drawings and verify coverage + invariants**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: two new SVGs `catalog/out/din6914.svg` and `catalog/out/din609.svg`; the 8 aliases render
no new file; `manifest.json` gains the 10 entries.

Verify the screw gap shrank and invariants hold:

```bash
# Screw gap dropped by exactly these 10 (73 -> 63); confirm none of the 10 remain missing:
./catalog/run python -c "import json; from catalog.qa.coverage import check; \
m=check('catalog/out/manifest.json','data/image-mappings.json','screw'); \
ids={'din6914','din6914i','din7999','din609','din609p','din610','din610p','din7968','din7990','din7990d'}; \
print('still missing among ours:', sorted(ids & set(m))); print('screw gap size:', len(m))"
# Expect: "still missing among ours: []" and "screw gap size: 63"

# Existing drawings byte-identical (only din6914.svg + din609.svg new):
git status --porcelain catalog/out    # expect: din6914.svg + din609.svg as ?? + modified manifest.json

# manifest additive; normalise prettier churn if any:
pnpm exec prettier --write catalog/out/manifest.json
git diff --numstat catalog/out/manifest.json   # small line count = only the 10 new entries

# Generate-only: these must NOT be touched:
git diff --stat data/image-mappings.json src/lib/data/standards-generated.ts | grep -c '.svg'
# Expect: 0
```

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/hex_bolts.json catalog/tests/test_hex_bolts_data.py \
  catalog/out/din6914.svg catalog/out/din609.svg catalog/out/manifest.json
git commit -m "feat(catalog): add structural/fit hex-bolt coverage (din6914 + din609 bases + 8 aliases)"
```

---

## Notes for the controller (sourcing gate + review)

- **Sourcing gate before Task 1:** confirm against ≥2 named public tables each: `din6914` M12
  `s = 22`, `k = 8`, `d_shank = 12`; `din609` M12 `s = 19`, `k = 7.5`, `d_shank = 13` (13k6 fit).
  Confirm `din610`/`din7968` share the `din609` envelope and `din7990` shares `din931`'s. Hand the
  implementer both base shapes and all 10 `source` strings in `.superpowers/sdd/task-1-sourcing.md`.
  Perplexity / Playwright MCP may read tables.
- **Visual confirmation before merge:** render `din6914.svg` (a visibly wider heavy hex head than
  `din931`) and `din609.svg` (same head as `din931` but a fatter shank). Serve `catalog/out` over
  the running dev server / `http.server` for a Playwright check if desired.
- **zen review** (`deepseek/deepseek-v4-pro`, thinking=high) after push + PR — even though there's
  no code, the data/alias correctness on a shared data surface is worth the pass. Apply findings as
  additional commits.
- **Coverage:** after Task 1, the screw gap is 63 (down from 73). This is measured, not gated
  (`coverage.py`'s CI gate enforces only `washer`).
