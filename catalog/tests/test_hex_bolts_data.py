import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/hex_bolts.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_hex_bolt_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 2
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_hex_bolt_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "hex_bolt", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"


def test_iso4017_aliases_iso4014():
    entries = json.loads(DATA.read_text())
    assert "iso4014" in entries and "family" in entries["iso4014"]      # base is a real drawing
    assert entries["iso4017"]["alias_of"] == "iso4014"                  # full thread -> alias
    assert entries["iso4017"]["hardwareType"] == "screw"


def test_every_hex_bolt_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_hex_bolt_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
