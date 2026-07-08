"""Generate an HTML review page pairing each new SVG with the current PNG + source."""
import json
from pathlib import Path

_ROW = """
<div class="row">
  <div class="id">{sid}<br><small>{source}</small></div>
  <figure><figcaption>current PNG</figcaption>
    <img src="/{png}" alt="{sid} png"></figure>
  <figure><figcaption>new SVG</figcaption>
    <img src="{svg}" alt="{sid} svg"></figure>
</div>
"""

_PAGE = """<!doctype html><meta charset="utf-8"><title>Catalog contact sheet</title>
<style>
body{{font:14px system-ui;background:#fff}}
.row{{display:flex;gap:24px;align-items:center;border-bottom:1px solid #eee;padding:12px}}
.id{{width:140px;font-weight:600}}
img{{height:96px;image-rendering:auto}}
figure{{margin:0;text-align:center}}figcaption{{font-size:11px;color:#888}}
</style>
<h1>Washer catalog review</h1>
{rows}
"""


def render(manifest_path, image_mappings_path, out_dir, png_dir, html_path) -> str:
    standards = json.loads(Path(manifest_path).read_text())["standards"]
    mappings = json.loads(Path(image_mappings_path).read_text())
    rows = []
    for sid, meta in sorted(standards.items()):
        png = mappings.get(sid, {}).get("image", "").lstrip("/")
        svg_rel = str(Path(out_dir) / meta["svg"])
        rows.append(_ROW.format(sid=sid, source=meta.get("source", ""), png=png, svg=svg_rel))
    Path(html_path).write_text(_PAGE.format(rows="".join(rows)))
    return html_path


if __name__ == "__main__":
    render("catalog/out/manifest.json", "data/image-mappings.json",
           "catalog/out", "static/images/standards", "catalog/out/contact-sheet.html")
    print("wrote catalog/out/contact-sheet.html")
