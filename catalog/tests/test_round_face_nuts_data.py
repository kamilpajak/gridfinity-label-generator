import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/round_face_nuts.json")
_FORBIDDEN = ("reyher", "stalmut")
_EXPECTED_FAMILY = {"din546": "slotted_face_nut", "din1816": "cross_hole_nut"}


def test_every_round_face_nut_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 2
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_round_face_nut_families_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == _EXPECTED_FAMILY[sid], f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "nut"


def test_every_round_face_nut_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_round_face_nut_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
