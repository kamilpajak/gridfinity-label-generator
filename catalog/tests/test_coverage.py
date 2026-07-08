import json
from pathlib import Path


def test_coverage_reports_missing_standard(tmp_path: Path):
    from catalog.qa.coverage import check

    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"standards": {"din125": {"svg": "din125.svg"}}}))
    mappings = tmp_path / "image-mappings.json"
    mappings.write_text(json.dumps({
        "din125": {"image": "/images/standards/din_125.png", "hardwareType": "washer"},
        "din127": {"image": "/images/standards/din_127.png", "hardwareType": "washer"},
        "din933": {"image": "/images/standards/din_933.png", "hardwareType": "screw"},
    }))

    missing = check(str(manifest), str(mappings), "washer")
    assert missing == ["din127"]  # din933 ignored (screw); din125 present
