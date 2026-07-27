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


# Family 3 (socket low-head + Torx cheese). Three new bases: din6912 low-head cap (dk=18,k=7,hex
# socket 10); din7984 low-head cap (dk=18,k=7,hex socket 8) — same external head, the socket size is
# the drawn difference. iso14580 Torx cheese (dk=16,k=6,lobular) drawn at M10 (ISO 14580 has no M12).
# din912i/iso4762p are the standard cap -> iso4762 (the real base, not the din912 alias).
_SOCKET_LOWHEAD_ALIASES = {
    "din7984i": "din7984", "din912i": "iso4762", "iso4762p": "iso4762",
}


def test_din6912_and_din7984_are_lowhead_bases_differing_by_socket():
    entries = json.loads(DATA.read_text())
    for sid in ("din6912", "din7984"):
        assert sid in entries and "alias_of" not in entries[sid]          # real drawing, not alias
        assert entries[sid]["family"] == "socket_screw"
        assert entries[sid]["hardwareType"] == "screw"
        assert entries[sid]["shape"]["dk"] == 18.0                        # same external head...
        assert entries[sid]["shape"]["k"] == 7.0                          # ...low head (std cap is 12)
        assert entries[sid]["shape"]["drive"] == "hex"
        build_part(entries[sid]["family"], entries[sid]["shape"])         # builds without raising
    assert entries["din6912"]["shape"]["socket_af"] == 10.0               # the drawn difference
    assert entries["din7984"]["shape"]["socket_af"] == 8.0


def test_din6912_and_din7984_produce_different_drawings():
    # The external envelope (dk=18, k=7) is identical; the ONLY drawn difference is the hex socket
    # size (socket_af 10 vs 8). Proving the built solids differ is what justifies two separate bases
    # rather than an alias — a larger socket removes more head metal, so the volumes must differ.
    entries = json.loads(DATA.read_text())
    part_6912 = build_part(entries["din6912"]["family"], entries["din6912"]["shape"])
    part_7984 = build_part(entries["din7984"]["family"], entries["din7984"]["shape"])
    assert part_6912.volume != part_7984.volume


def test_iso14580_is_a_lobular_cheese_base():
    entries = json.loads(DATA.read_text())
    assert "iso14580" in entries and "alias_of" not in entries["iso14580"]
    assert entries["iso14580"]["family"] == "socket_screw"
    assert entries["iso14580"]["hardwareType"] == "screw"
    assert entries["iso14580"]["shape"]["drive"] == "lobular"
    assert entries["iso14580"]["shape"]["dk"] == 16.0                     # M10 cheese head (no M12)
    assert entries["iso14580"]["shape"]["k"] == 6.0
    build_part(entries["iso14580"]["family"], entries["iso14580"]["shape"])


def test_socket_lowhead_aliases_resolve_to_a_real_base_without_chaining():
    entries = json.loads(DATA.read_text())
    for alias_id, base_id in _SOCKET_LOWHEAD_ALIASES.items():
        assert alias_id in entries, f"{alias_id} missing from socket_screws.json"
        assert entries[alias_id]["alias_of"] == base_id, f"{alias_id} must alias {base_id}"
        assert base_id in entries and "alias_of" not in entries[base_id], \
            f"{base_id} must be a real non-alias base (no chaining)"
        assert entries[alias_id]["hardwareType"] == "screw"
