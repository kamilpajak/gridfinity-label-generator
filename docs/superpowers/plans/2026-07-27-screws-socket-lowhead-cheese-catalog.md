# Socket Low-Head + Torx Cheese Coverage (screw gap, family 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 6 socket-screw ids in the `coverage.py` screw gap by adding three sourced bases
(`din6912`, `din7984` low-head caps; `iso14580` Torx cheese) and 3 aliases to
`catalog/dimensions/socket_screws.json`, reusing `socket_screw` (no code change).

**Architecture:** `socket_screw(dk, k, length, d_shank, drive, socket_af, socket_depth, tip_chamfer)`
already draws a cylindrical head with a blind hex/lobular socket over a smooth shank. The low-head
caps are `dk=18, k=7` (vs the standard cap's `k=12`) with hex sockets of 10 (`din6912`) and 8
(`din7984`) — the socket size is the drawn difference, so each is its own base. `iso14580` is a Torx
cheese head (`dk=16, k=6`, lobular) drawn at M10 (ISO 14580 has no M12). `din912i`/`iso4762p` are the
standard M12 cap and alias the existing `iso4762`. Three new data entries + 3 aliases; the build
renders three new SVGs.

**Tech Stack:** JSON data, `build123d` (run ONLY in the pinned container via `./catalog/run`), pytest.

## Global Constraints

- Reuse `socket_screw` with **no code change**; add 3 bases (`din6912`, `din7984`, `iso14580`) + 3
  aliases to `catalog/dimensions/socket_screws.json`. Modify no generator; no registry change
  (`socket_screw` is already registered).
- Representative size **M12** for the caps (`din6912`/`din7984`: `dk=18, k=7, d_shank=12, length=60`);
  **M10** for `iso14580` (`dk=16, k=6, d_shank=10, length=50`) because ISO 14580 has no M12. Each
  envelope dim confirmed by ≥2 named public tables at the sourcing gate. `socket_depth`, `tip_chamfer`,
  and the lobular `socket_af` are representative, flagged in the source strings.
- **Aliases never chain:** `din7984i` → `din7984`; `din912i`/`iso4762p` → `iso4762` (the real base, not
  `din912` which is itself an alias). `hardwareType: "screw"` on every entry. `verified: true`.
- Source strings cite only public tables — **no** `reyher`, `stalmut`, or any private catalogue.
- **Generate-only:** do NOT modify `data/image-mappings.json` or `src/lib/data/standards-generated.ts`,
  and do NOT run `catalog/integrate.py`. `grep -c '.svg'` on the diff of both files must be 0. Existing
  SVGs stay **byte-identical**; manifest change additive.
- After the build, `coverage.check(manifest, image_mappings, "screw")` no longer lists the 6 ids
  (screw gap 63 → 57). No render/preset change.
- All build/test runs in-container: `./catalog/run python -m pytest …`,
  `./catalog/run python -m catalog.build_catalog`.

---

### Task 1: Socket low-head + cheese coverage data + tests + build

**Files:**

- Modify: `catalog/dimensions/socket_screws.json` (add 3 bases + 3 aliases)
- Modify: `catalog/tests/test_socket_screws_data.py` (add the coverage assertions)
- Build output (generated, committed): `catalog/out/din6912.svg`, `catalog/out/din7984.svg`,
  `catalog/out/iso14580.svg` + additive `catalog/out/manifest.json`

**Interfaces:**

- Consumes: `socket_screw(dk, k, length, d_shank, drive, socket_af, socket_depth, tip_chamfer)`
  (existing, unchanged); `validate_entry` from `catalog.schema`; `build_part` from
  `catalog.models._registry`; `catalog.qa.coverage.check`.
- Produces: 6 new socket-screw data entries (3 bases + 3 aliases) that validate, build, and close the
  gap ids.

**SOURCING GATE (controller-supplied — do NOT invent numbers).** The exact `din6912`, `din7984`,
`iso14580` shapes and every `source` string are provided by the controller's sourcing gate (in
`.superpowers/sdd/task-1-sourcing.md`), each envelope dim confirmed against ≥2 named public tables.
Transcribe the provided values and alias targets verbatim; do not guess.

- [ ] **Step 1: Write the failing coverage assertions**

Append to `catalog/tests/test_socket_screws_data.py`:

```python
# Family 3 (socket low-head + Torx cheese). Three new bases: din6912 low-head cap (dk=18,k=7,hex
# socket 10); din7984 low-head cap (dk=18,k=7,hex socket 8) — same external head, the socket size is
# the drawn difference. iso14580 Torx cheese (dk=16,k=6,lobular) drawn at M10 (ISO 14580 has no M12).
# din912i/iso4762p are the standard cap -> iso4762 (the real base, not the din912 alias).
_SOCKET_LOWHEAD_ALIASES = {
    "din7984i": "din7984", "din912i": "iso4762", "iso4762p": "iso4762",
}


def test_din6912_and_din7984_are_lowhead_bases_differing_by_socket():
    entries = json.loads(DATA.read_text())
    for sid in ("din6912", "din7984"):
        assert sid in entries and "alias_of" not in entries[sid]          # real drawing, not alias
        assert entries[sid]["family"] == "socket_screw"
        assert entries[sid]["hardwareType"] == "screw"
        assert entries[sid]["shape"]["dk"] == 18.0                        # same external head...
        assert entries[sid]["shape"]["k"] == 7.0                          # ...low head (std cap is 12)
        assert entries[sid]["shape"]["drive"] == "hex"
        build_part(entries[sid]["family"], entries[sid]["shape"])         # builds without raising
    assert entries["din6912"]["shape"]["socket_af"] == 10.0               # the drawn difference
    assert entries["din7984"]["shape"]["socket_af"] == 8.0


def test_iso14580_is_a_lobular_cheese_base():
    entries = json.loads(DATA.read_text())
    assert "iso14580" in entries and "alias_of" not in entries["iso14580"]
    assert entries["iso14580"]["family"] == "socket_screw"
    assert entries["iso14580"]["hardwareType"] == "screw"
    assert entries["iso14580"]["shape"]["drive"] == "lobular"
    assert entries["iso14580"]["shape"]["dk"] == 16.0                     # M10 cheese head (no M12)
    assert entries["iso14580"]["shape"]["k"] == 6.0
    build_part(entries["iso14580"]["family"], entries["iso14580"]["shape"])


def test_socket_lowhead_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _SOCKET_LOWHEAD_ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from socket_screws.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `./catalog/run python -m pytest catalog/tests/test_socket_screws_data.py -q`
Expected: FAIL — `din6912`, `din7984`, `iso14580`, and the new alias keys are not in
`socket_screws.json` yet.

- [ ] **Step 3: Add the data entries**

Add these 6 entries to `catalog/dimensions/socket_screws.json` (alongside the existing `iso4762`/
`din912`/`iso14579`), filling the three base shapes and every `source` string from the controller's
sourcing-gate values (`.superpowers/sdd/task-1-sourcing.md`) **verbatim**. Keep the existing entry
shape: base = `family`/`shape`/`hardwareType`/`source`/`verified`/`designations`; alias =
`alias_of`/`hardwareType`/`source`/`verified`/`designations`.

Base shapes (fill `source` from the sourcing file):

```json
"din6912": {
  "family": "socket_screw",
  "shape": { "dk": 18.0, "k": 7.0, "length": 60.0, "d_shank": 12.0, "drive": "hex", "socket_af": 10.0, "socket_depth": 4.0, "tip_chamfer": 1.0 },
  "hardwareType": "screw",
  "source": "<from sourcing gate>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "6912" }]
},
"din7984": {
  "family": "socket_screw",
  "shape": { "dk": 18.0, "k": 7.0, "length": 60.0, "d_shank": 12.0, "drive": "hex", "socket_af": 8.0, "socket_depth": 4.0, "tip_chamfer": 1.0 },
  "hardwareType": "screw",
  "source": "<from sourcing gate>",
  "verified": true,
  "designations": [{ "system": "DIN", "code": "7984" }]
},
"iso14580": {
  "family": "socket_screw",
  "shape": { "dk": 16.0, "k": 6.0, "length": 50.0, "d_shank": 10.0, "drive": "lobular", "socket_af": 7.0, "socket_depth": 3.5, "tip_chamfer": 0.8 },
  "hardwareType": "screw",
  "source": "<from sourcing gate>",
  "verified": true,
  "designations": [{ "system": "ISO", "code": "14580" }]
}
```

The full id → base + designation map to produce (exactly these 6 entries — 3 bases + 3 aliases):

| id         | kind  | alias_of | designation `{system, code}` |
| ---------- | ----- | -------- | ---------------------------- |
| `din6912`  | base  | —        | `{DIN, 6912}`                |
| `din7984`  | base  | —        | `{DIN, 7984}`                |
| `din7984i` | alias | din7984  | `{DIN, 7984}`                |
| `iso14580` | base  | —        | `{ISO, 14580}`               |
| `din912i`  | alias | iso4762  | `{DIN, 912}`                 |
| `iso4762p` | alias | iso4762  | `{ISO, 4762}`                |

Every alias `source` string (verbatim from the sourcing file) states the shared envelope and which base
it aliases. Keep `_SOCKET_LOWHEAD_ALIASES` in the test in sync with the committed data.

- [ ] **Step 4: Run the data tests to verify they pass**

Run: `./catalog/run python -m pytest catalog/tests/test_socket_screws_data.py -q`
Expected: PASS — the existing sweep (validate+build, family/type/drive, sourced+verified, forbidden
tokens) plus the three new tests.

- [ ] **Step 5: Run the full suite**

Run: `./catalog/run python -m pytest catalog/tests -q`
Expected: PASS — no regressions.

- [ ] **Step 6: Build the drawings and verify coverage + invariants**

Run: `./catalog/run python -m catalog.build_catalog`
Expected: three new SVGs `catalog/out/din6912.svg`, `catalog/out/din7984.svg`,
`catalog/out/iso14580.svg`; the 3 aliases render no new file; `manifest.json` gains the 6 entries.

Verify the screw gap shrank and invariants hold:

```bash
# Screw gap dropped by exactly these 6 (63 -> 57); confirm none of the 6 remain missing:
./catalog/run python -c "import json; from catalog.qa.coverage import check; \
m=check('catalog/out/manifest.json','data/image-mappings.json','screw'); \
ids={'din6912','din7984','din7984i','iso14580','din912i','iso4762p'}; \
print('still missing among ours:', sorted(ids & set(m))); print('screw gap size:', len(m))"
# Expect: "still missing among ours: []" and "screw gap size: 57"

# Existing drawings byte-identical (only the 3 new SVGs new):
git status --porcelain catalog/out    # expect: din6912.svg + din7984.svg + iso14580.svg as ?? + modified manifest.json

# manifest additive; normalise prettier churn if any:
pnpm exec prettier --write catalog/out/manifest.json
git diff --numstat catalog/out/manifest.json   # small line count = only the 6 new entries

# Generate-only: these must NOT be touched:
git diff --stat data/image-mappings.json src/lib/data/standards-generated.ts | grep -c '.svg'
# Expect: 0
```

- [ ] **Step 7: Commit**

```bash
git add catalog/dimensions/socket_screws.json catalog/tests/test_socket_screws_data.py \
  catalog/out/din6912.svg catalog/out/din7984.svg catalog/out/iso14580.svg catalog/out/manifest.json
git commit -m "feat(catalog): add socket low-head + Torx cheese coverage (din6912/din7984/iso14580 bases + 3 aliases)"
```

---

## Notes for the controller (sourcing gate + review)

- **Sourcing gate before Task 1:** confirm against ≥2 named public tables each: `din6912` M12 `dk=18`,
  `k=7`, hex `s=10`; `din7984` M12 `dk=18`, `k=7`, hex `s=8`; `iso14580` max size M10 `dk=16`, `k=6`
  (lobular). Flag the representative fields (socket depth, lobular `socket_af`, `length`, the M10 drop).
  Hand the implementer the three base shapes and all 6 `source` strings in
  `.superpowers/sdd/task-1-sourcing.md`. Perplexity / Playwright MCP may read tables.
- **Visual confirmation before merge:** render the three new SVGs — `din6912`/`din7984` a lower head
  than `iso4762` with a hex socket (10 vs 8), `iso14580` a low cheese head with a lobular (Torx) socket.
  Serve `catalog/out` over the running dev server / `http.server` for a Playwright check.
- **zen review** (`deepseek/deepseek-v4-pro`, thinking=high) after push + PR — data/alias correctness on
  a shared data surface is worth the pass. Apply findings as additional commits.
- **Coverage:** after Task 1, the screw gap is 57 (down from 63). Measured, not gated (`coverage.py`'s
  CI gate enforces only `washer`).
