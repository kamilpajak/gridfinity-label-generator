import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/prism_head_bolts.json")
_FORBIDDEN = ("reyher", "stalmut")

# Filled from the sourcing gate — only din261 shipped (din787/din478/din186 dropped, no public data).
_BASES = {"din261": "none"}
_ALIASES = {"din261d": "din261"}


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


def test_family_hardware_type_and_under_enum():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        assert entry["family"] == "prism_head_bolt", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"
        assert entry["shape"]["under"] in ("none", "square_neck", "collar")


def test_each_base_has_its_expected_under_feature():
    entries = json.loads(DATA.read_text())
    for base_id, expected_under in _BASES.items():
        assert base_id in entries and "alias_of" not in entries[base_id], f"{base_id} must be a base"
        assert entries[base_id]["shape"]["under"] == expected_under, \
            f"{base_id}: expected under={expected_under}"
        build_part(entries[base_id]["family"], entries[base_id]["shape"])


def test_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from prism_head_bolts.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"


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
