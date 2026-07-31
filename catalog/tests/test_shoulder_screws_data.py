import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/shoulder_screws.json")
_FORBIDDEN = ("reyher", "stalmut")

_BASES = ("iso7379",)
_ISO_CODE = {"iso7379": "7379"}


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
        assert entry["family"] == "shoulder_screw", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"


def test_bases_are_real_and_build():
    entries = json.loads(DATA.read_text())
    for base_id in _BASES:
        assert base_id in entries and "alias_of" not in entries[base_id], f"{base_id} must be a base"
        build_part(entries[base_id]["family"], entries[base_id]["shape"])


def test_no_aliases_expected():
    # iso7379 is the only app key for this family; every entry must be a real base
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert "alias_of" not in entry, f"{sid}: unexpected alias entry"


def test_shoulder_is_the_designating_diameter():
    # ISO 7379 designates by SHOULDER diameter: the shoulder must exceed the thread envelope
    entries = json.loads(DATA.read_text())
    shape = entries["iso7379"]["shape"]
    assert shape["d_shoulder"] == 12.0
    assert shape["d_thread"] < shape["d_shoulder"]


def test_designations_name_the_right_iso_standard():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        code = _ISO_CODE[sid]
        assert {"system": "ISO", "code": code} in entry["designations"], f"{sid}: ISO {code} missing"


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
