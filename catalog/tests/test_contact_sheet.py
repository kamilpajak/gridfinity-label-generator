import json
from pathlib import Path


def test_contact_sheet_pairs_svg_and_png(tmp_path: Path):
    from catalog.qa.contact_sheet import render

    (tmp_path / "out").mkdir()
    (tmp_path / "out" / "din125.svg").write_text("<svg/>")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"standards": {
        "din125": {"svg": "din125.svg", "source": "DIN 125-1:2011"}
    }}))
    mappings = tmp_path / "image-mappings.json"
    mappings.write_text(json.dumps({
        "din125": {"image": "/images/standards/din_125.png", "hardwareType": "washer"}
    }))
    html = tmp_path / "contact.html"

    render(str(manifest), str(mappings), str(tmp_path / "out"),
           "static/images/standards", str(html))

    text = html.read_text()
    assert "din125" in text
    assert "din125.svg" in text
    assert "din_125.png" in text
    assert "DIN 125-1:2011" in text
