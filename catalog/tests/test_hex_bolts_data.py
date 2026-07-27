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


# The DIN M12 hex head is s=19 (its own drawing din931); the ISO M12 head is s=18 (iso4014).
# Pitch/thread-length are not drawn, so fine/coarse and full/partial collapse onto these two bases.
# NOTE: the din960/din961 (+ i) alias target is confirmed at the sourcing gate; if a table shows
# they use s=18 they alias "iso4014" instead. Update _NEW_HEX_ALIASES to match the sourced values.
_NEW_HEX_ALIASES = {
    "din933": "din931", "din960": "din931", "din961": "din931",
    "din931i": "din931", "din933i": "din931", "din960i": "din931", "din961i": "din931",
    "iso8676": "iso4014", "iso8765": "iso4014", "iso4014p": "iso4014", "iso4017p": "iso4014",
}


def test_din931_is_the_din_head_base():
    entries = json.loads(DATA.read_text())
    assert "din931" in entries and "alias_of" not in entries["din931"]   # a real drawing, not an alias
    assert entries["din931"]["family"] == "hex_bolt"
    assert entries["din931"]["hardwareType"] == "screw"
    assert entries["din931"]["shape"]["s"] == 19.0                        # DIN head width (ISO is 18.0)
    build_part(entries["din931"]["family"], entries["din931"]["shape"])   # builds without raising


def test_new_hex_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _NEW_HEX_ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from hex_bolts.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"
