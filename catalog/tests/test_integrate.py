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


def test_integrate_creates_entry_with_hardware_type_from_family(tmp_path: Path):
    from catalog.integrate import apply

    out = tmp_path / "out"; out.mkdir()
    (out / "iso4026.svg").write_text("<svg/>")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({
        "standards": {"iso4026": {"svg": "iso4026.svg", "family": "set_screw"}}
    }))
    static_dir = tmp_path / "static"; static_dir.mkdir()
    mappings = tmp_path / "image-mappings.json"
    mappings.write_text(json.dumps({}))

    changed = apply(str(manifest), str(out), str(static_dir), str(mappings))

    assert changed == ["iso4026"]
    updated = json.loads(mappings.read_text())
    assert updated["iso4026"] == {
        "image": "/images/standards/iso4026.svg",
        "hardwareType": "screw",
    }


def test_integrate_rejects_new_entry_with_unknown_family(tmp_path: Path):
    import pytest

    from catalog.integrate import apply

    out = tmp_path / "out"; out.mkdir()
    (out / "din999.svg").write_text("<svg/>")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({
        "standards": {"din999": {"svg": "din999.svg", "family": "mystery"}}
    }))
    static_dir = tmp_path / "static"; static_dir.mkdir()
    mappings = tmp_path / "image-mappings.json"
    mappings.write_text(json.dumps({}))

    with pytest.raises(KeyError, match="din999"):
        apply(str(manifest), str(out), str(static_dir), str(mappings))


def test_integrate_touches_nothing_when_one_standard_is_rejected(tmp_path: Path):
    # A rejected standard used to abort mid-loop, after the ones before it had
    # already been copied: static/ then held drawings that image-mappings.json
    # knew nothing about, with nothing recording the mismatch.
    import pytest

    from catalog.integrate import apply

    out = tmp_path / "out"; out.mkdir()
    (out / "iso4026.svg").write_text("<svg/>")
    (out / "din999.svg").write_text("<svg/>")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({
        "standards": {
            "iso4026": {"svg": "iso4026.svg", "family": "set_screw"},
            "din999": {"svg": "din999.svg", "family": "mystery"},
        }
    }))
    static_dir = tmp_path / "static"; static_dir.mkdir()
    mappings = tmp_path / "image-mappings.json"
    mappings.write_text(json.dumps({}))

    with pytest.raises(KeyError, match="din999"):
        apply(str(manifest), str(out), str(static_dir), str(mappings))

    assert list(static_dir.iterdir()) == []
    assert json.loads(mappings.read_text()) == {}
