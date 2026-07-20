import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/set_screws.json")
_FORBIDDEN = ("reyher", "stalmut")
_ALIASES = {"iso4026": "din913", "iso4027": "din914", "iso4028": "din915", "iso4029": "din916"}


def test_every_set_screw_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 8                                  # 4 bases + 4 aliases
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_set_family_hardware_type_and_point():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "set_screw", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"
        assert entry["shape"]["point"] in ("flat", "cone", "dog", "cup")


def test_iso_aliases_point_at_their_din_bases():
    entries = json.loads(DATA.read_text())
    for iso_id, din_id in _ALIASES.items():
        assert din_id in entries and "family" in entries[din_id], f"{din_id} base missing"
        assert entries[iso_id]["alias_of"] == din_id, f"{iso_id} must alias {din_id}"
        assert "alias_of" not in entries[din_id], f"{din_id} must be a base, not an alias"


def test_every_set_screw_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_set_screw_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
