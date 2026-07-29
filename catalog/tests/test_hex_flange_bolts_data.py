import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/hex_flange_bolts.json")
_FORBIDDEN = ("reyher", "stalmut")

_BASES = ("din6921",)
_ALIASES = {"din6921d": "din6921"}


def test_every_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 1
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "hex_flange_bolt", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"


def test_bases_are_real_and_build():
    entries = json.loads(DATA.read_text())
    for base_id in _BASES:
        assert base_id in entries and "alias_of" not in entries[base_id], f"{base_id} must be a base"
        build_part(entries[base_id]["family"], entries[base_id]["shape"])


def test_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from hex_flange_bolts.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"


def test_designations_name_din_6921():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert {"system": "DIN", "code": "6921"} in entry["designations"], f"{sid}: DIN 6921 missing"


def test_every_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
