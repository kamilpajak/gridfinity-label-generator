import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/carriage_bolts.json")
_FORBIDDEN = ("reyher", "stalmut")

# Square-neck carriage bolts. Two drawn bases: din603 (cup/mushroom dome + square neck) covers the
# DIN 603 / ISO 8677 group; din605 (countersunk cone + square neck) is its own base. ISO 8677 is the
# ISO twin of DIN 603 so it aliases din603. The "...i"/"...p" ids are the app's image-variant keys.
_CARRIAGE_ALIASES = {
    "din603i": "din603", "iso8677": "din603", "iso8677p": "din603",
}


def test_every_carriage_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 5
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_carriage_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert entry["hardwareType"] == "screw"
        if "alias_of" in entry:
            continue
        assert entry["family"] == "carriage_bolt", f"{sid}: unexpected family {entry['family']}"


def test_din603_is_a_cup_square_base():
    entries = json.loads(DATA.read_text())
    assert "din603" in entries and "alias_of" not in entries["din603"]
    shape = entries["din603"]["shape"]
    assert shape["head"] == "cup"
    assert shape["dk"] > shape["square_w"]                 # head overhangs the neck
    assert shape["square_depth"] > 0                       # has a square neck
    build_part(entries["din603"]["family"], shape)


def test_din605_is_a_countersunk_square_base():
    entries = json.loads(DATA.read_text())
    assert "din605" in entries and "alias_of" not in entries["din605"]
    shape = entries["din605"]["shape"]
    assert shape["head"] == "countersunk"
    assert shape["dk"] > shape["square_w"]
    assert shape["square_depth"] > 0
    build_part(entries["din605"]["family"], shape)


def test_carriage_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _CARRIAGE_ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from carriage_bolts.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"


def test_every_carriage_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_carriage_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
