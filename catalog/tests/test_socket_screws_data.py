import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/socket_screws.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_socket_screw_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 3
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_socket_family_hardware_type_and_drive():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "socket_screw", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"
        assert entry["shape"]["drive"] in ("hex", "lobular")


def test_din912_aliases_iso4762_and_iso14579_is_a_distinct_lobular_base():
    entries = json.loads(DATA.read_text())
    assert "iso4762" in entries and "family" in entries["iso4762"]       # hex base is a drawing
    assert entries["iso4762"]["shape"]["drive"] == "hex"
    assert entries["din912"]["alias_of"] == "iso4762"                    # same screw -> alias
    assert entries["din912"]["hardwareType"] == "screw"
    assert "family" in entries["iso14579"]                              # Torx is its OWN base
    assert entries["iso14579"]["shape"]["drive"] == "lobular"
    assert "alias_of" not in entries["iso14579"]


def test_every_socket_screw_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_socket_screw_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
