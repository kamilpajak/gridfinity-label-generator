import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/slotted_screws.json")
_FORBIDDEN = ("reyher", "stalmut")
# ISO aliases -> DIN slotted bases; DIN aliases -> ISO cross bases. iso7047 has NO alias.
_ALIASES = {
    "iso1207": "din84", "iso1580": "din85", "iso2009": "din963", "iso2010": "din966",
    "din7985": "iso7045", "din965": "iso7046",
}
_BASES = {"din84", "din85", "din963", "din966", "iso7045", "iso7046", "iso7047"}
_HEADS = ("cheese", "pan", "countersunk", "raised")
_DRIVES = ("slot", "cross")


def test_every_slotted_screw_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) == 13                                     # 7 bases + 6 aliases
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_bases_and_family_head_drive():
    entries = json.loads(DATA.read_text())
    bases = {sid for sid, e in entries.items() if "alias_of" not in e}
    assert bases == _BASES
    for sid in bases:
        entry = entries[sid]
        assert entry["family"] == "slotted_screw", f"{sid}: unexpected family {entry['family']}"
        assert entry["hardwareType"] == "screw"
        assert entry["shape"]["head"] in _HEADS
        assert entry["shape"]["drive"] in _DRIVES


def test_aliases_point_at_their_bases_and_iso7047_has_none():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _ALIASES.items():
        assert base_id in entries and "family" in entries[base_id], f"{base_id} base missing"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert "alias_of" not in entries[base_id], f"{base_id} must be a base, not an alias"
    assert "alias_of" not in entries["iso7047"], "iso7047 must be a base"
    assert not any(e.get("alias_of") == "iso7047" for e in entries.values()), \
        "iso7047 must have no alias"


def test_every_entry_is_sourced_and_verified():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        assert len(entry["source"]) >= 3, f"{sid}: missing source"
        assert entry.get("verified") is True, f"{sid}: must be verified against >=2 tables"


def test_sources_state_m10_and_name_no_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        assert "m10" in low, f"{sid}: source must state the M10 representative size"
        for tok in _FORBIDDEN:
            assert tok not in low, f"{sid}: source names forbidden token '{tok}'"
