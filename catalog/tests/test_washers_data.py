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
        # It must actually build a part without raising.
        build_part(entry["family"], entry["shape"])
    assert problems == []


def test_all_entries_have_a_source_citation():
    entries = json.loads(DATA.read_text())
    assert all(len(e["source"]) >= 3 for e in entries.values())
