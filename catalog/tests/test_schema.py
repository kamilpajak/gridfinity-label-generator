from catalog.schema import validate_entry


def test_valid_flat_washer_entry_passes():
    entry = {
        "family": "flat_washer",
        "shape": {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5},
        "hardwareType": "washer",
        "source": "DIN 125-1:2011",
        "verified": False,
        "designations": [{"system": "DIN", "code": "125"}],
    }
    assert validate_entry("din125", entry) == []


def test_missing_source_is_reported():
    entry = {
        "family": "flat_washer",
        "shape": {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5},
        "hardwareType": "washer",
        "designations": [{"system": "DIN", "code": "125"}],
    }
    problems = validate_entry("din125", entry)
    assert any("source" in p for p in problems)


def test_unknown_family_is_reported():
    entry = {
        "family": "warp_drive",
        "shape": {},
        "hardwareType": "washer",
        "source": "x",
        "designations": [{"system": "DIN", "code": "1"}],
    }
    problems = validate_entry("din1", entry)
    assert any("family" in p for p in problems)
