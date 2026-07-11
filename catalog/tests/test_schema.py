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


def test_alias_entry_without_family_or_shape_passes():
    entry = {
        "alias_of": "din432",
        "hardwareType": "washer",
        "source": "DIN 432 P (plated variant of DIN 432)",
        "designations": [{"system": "DIN", "code": "432 P"}],
    }
    assert validate_entry("din432p", entry) == []


def test_entry_with_neither_family_nor_alias_is_reported():
    entry = {
        "hardwareType": "washer",
        "source": "no geometry and no alias",
        "designations": [{"system": "DIN", "code": "1"}],
    }
    assert validate_entry("din1", entry) != []


def test_entry_mixing_family_and_alias_is_reported():
    entry = {
        "family": "flat_washer",
        "shape": {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5},
        "alias_of": "din125",
        "hardwareType": "washer",
        "source": "both a body and an alias is contradictory",
        "designations": [{"system": "DIN", "code": "1"}],
    }
    assert validate_entry("din1", entry) != []
