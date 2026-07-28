import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/studs.json")
_FORBIDDEN = ("reyher", "stalmut")

# Plain double-end studs. One drawn base (din938, a plain chamfered M12 rod); DIN 939 (metal end
# 1.25d) and DIN 835 (2d) differ from DIN 938 only in the undrawn thread-engagement length, so they
# alias din938. The "...d" ids are the app's image-variant keys.
_STUD_ALIASES = {
    "din938d": "din938", "din939": "din938", "din939d": "din938",
    "din835": "din938", "din835d": "din938",
}


def test_every_stud_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 6
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_stud_family_and_hardware_type():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert entry["hardwareType"] == "screw"
        if "alias_of" in entry:
            continue
        assert entry["family"] == "stud", f"{sid}: unexpected family {entry['family']}"


def test_din938_is_a_plain_rod_base():
    entries = json.loads(DATA.read_text())
    assert "din938" in entries and "alias_of" not in entries["din938"]
    assert entries["din938"]["family"] == "stud"
    shape = entries["din938"]["shape"]
    assert shape["d"] == 12.0
    assert shape["length"] == 60.0
    assert "tip_chamfer" in shape, "din938 shape must carry tip_chamfer (both-ends lead chamfer)"
    # plain rod: carries no head / socket / drive fields
    for forbidden in ("socket_af", "socket_depth", "drive", "dk", "k", "s"):
        assert forbidden not in shape, f"din938 shape must not carry {forbidden}"
    build_part(entries["din938"]["family"], shape)


def test_stud_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _STUD_ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from studs.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"


def test_every_stud_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_no_stud_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
