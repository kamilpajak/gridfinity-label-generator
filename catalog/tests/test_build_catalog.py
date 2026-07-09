import json
from pathlib import Path


def test_build_generates_svg_and_manifest_for_valid_entries(tmp_path: Path):
    from catalog.build_catalog import build

    dims = tmp_path / "dimensions"
    dims.mkdir()
    (dims / "washers.json").write_text(json.dumps({
        "din125": {
            "family": "flat_washer",
            "shape": {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5},
            "hardwareType": "washer",
            "source": "DIN 125-1:2011 (M12)",
            "verified": False,
            "designations": [{"system": "DIN", "code": "125"}],
        }
    }))
    out = tmp_path / "out"
    manifest = tmp_path / "manifest.json"

    report = build(str(dims), str(out), str(manifest))

    assert report["ok"] == ["din125"]
    assert (out / "din125.svg").exists()
    m = json.loads(manifest.read_text())
    assert m["standards"]["din125"]["svg"] == "din125.svg"
    assert len(m["standards"]["din125"]["sha256"]) == 64
    assert "build123d" in m["toolchain"]


def test_toolchain_records_real_ocp_version(tmp_path: Path):
    from catalog.build_catalog import build

    dims = tmp_path / "dimensions"
    dims.mkdir()
    (dims / "washers.json").write_text(json.dumps({
        "din125": {
            "family": "flat_washer",
            "shape": {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5},
            "hardwareType": "washer",
            "source": "DIN 125-1:2011 (M12)",
            "verified": False,
            "designations": [{"system": "DIN", "code": "125"}],
        }
    }))
    out = tmp_path / "out"
    manifest_path = tmp_path / "manifest.json"

    build(str(dims), str(out), str(manifest_path))

    manifest = json.loads(manifest_path.read_text())
    toolchain = manifest["toolchain"]
    assert "unknown" not in toolchain.values(), (
        f"manifest toolchain has 'unknown' values: {toolchain}"
    )
    assert "cadquery-ocp-novtk" in toolchain, (
        f"cadquery-ocp-novtk not in toolchain keys: {list(toolchain.keys())}"
    )
    assert isinstance(toolchain["cadquery-ocp-novtk"], str)
    assert toolchain["cadquery-ocp-novtk"] != ""


def test_build_reports_failed_entry_without_aborting(tmp_path: Path):
    from catalog.build_catalog import build

    dims = tmp_path / "dimensions"
    dims.mkdir()
    (dims / "washers.json").write_text(json.dumps({
        "bad1": {
            "family": "flat_washer",
            "shape": {"d_inner": 30.0, "d_outer": 10.0, "thickness": 2.0},
            "hardwareType": "washer",
            "source": "x",
            "designations": [{"system": "DIN", "code": "1"}],
        },
        "din125": {
            "family": "flat_washer",
            "shape": {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5},
            "hardwareType": "washer",
            "source": "DIN 125-1:2011",
            "designations": [{"system": "DIN", "code": "125"}],
        },
    }))
    report = build(str(dims), str(tmp_path / "out"), str(tmp_path / "manifest.json"))
    assert "din125" in report["ok"]
    assert any(f["id"] == "bad1" for f in report["failed"])
