import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/retaining_rings.json")
_FORBIDDEN = ("reyher", "stalmut")


def test_every_retaining_ring_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 2
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_retaining_ring_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "retaining_ring", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "ring"


def test_has_external_and_internal_forms():
    entries = json.loads(DATA.read_text())
    assert "din471" in entries and entries["din471"]["shape"]["internal"] is False
    assert "din472" in entries and entries["din472"]["shape"]["internal"] is True


def test_every_retaining_ring_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_retaining_ring_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
