import json
from pathlib import Path


def test_integrate_copies_svg_and_repoints_mapping(tmp_path: Path):
    from catalog.integrate import apply

    out = tmp_path / "out"; out.mkdir()
    (out / "din125.svg").write_text("<svg/>")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"standards": {"din125": {"svg": "din125.svg"}}}))
    static_dir = tmp_path / "static"; static_dir.mkdir()
    mappings = tmp_path / "image-mappings.json"
    mappings.write_text(json.dumps({
        "din125": {"image": "/images/standards/din_125.png", "hardwareType": "washer"}
    }))

    changed = apply(str(manifest), str(out), str(static_dir), str(mappings))

    assert changed == ["din125"]
    assert (static_dir / "din125.svg").exists()
    updated = json.loads(mappings.read_text())
    assert updated["din125"]["image"] == "/images/standards/din125.svg"
    assert updated["din125"]["hardwareType"] == "washer"  # preserved
