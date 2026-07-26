import json
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part

DATA = Path("catalog/dimensions/washers.json")


def test_every_washer_entry_validates_and_builds():
    entries = json.loads(DATA.read_text())
    assert len(entries) >= 6  # pilot: at least the seed set below
    problems = []
    for sid, entry in entries.items():
        problems += validate_entry(sid, entry)
        if "alias_of" in entry:
            continue  # aliases carry no geometry; they reuse a base's drawing
        # It must actually build a part without raising.
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_aliases_point_at_real_non_alias_bases():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        if "alias_of" not in entry:
            continue
        target = entry["alias_of"]
        assert target in entries, f"{sid}: alias_of '{target}' is not a known entry"
        assert "alias_of" not in entries[target], (
            f"{sid}: alias_of '{target}' is itself an alias (chains are not resolved)")


def test_all_entries_have_a_source_citation():
    entries = json.loads(DATA.read_text())
    assert all(len(e["source"]) >= 3 for e in entries.values())


def test_coverage_gap_washers_present_and_typed():
    entries = json.loads(DATA.read_text())
    expected = {
        "din137b": "wave_washer",
        "din440v": "square_hole_washer",
        "din74361c": "curved_washer",
        "din25201": "wedge_lock_washer",
    }
    for sid, fam in expected.items():
        assert sid in entries, f"{sid} missing from washers.json"
        assert entries[sid]["family"] == fam, f"{sid}: expected family {fam}"
        assert entries[sid]["hardwareType"] == "washer"
    # din440r is the round-hole form, identical envelope to din440 -> alias.
    assert entries["din440r"]["alias_of"] == "din440"


def test_no_washer_source_names_a_private_catalogue():
    entries = json.loads(DATA.read_text())
    for sid, entry in entries.items():
        low = entry["source"].lower()
        assert "reyher" not in low and "stalmut" not in low, f"{sid}: forbidden source token"
