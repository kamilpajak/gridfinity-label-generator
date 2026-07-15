import math

import pytest
from build123d import Box, Pos

from catalog.models.slotted_round_nut import slotted_round_nut

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
# Slots open from the top face (z=+h/2) down slot_h, so the slot band is z in [1, 4].
CFG = dict(d=30.0, h=8.0, bore=13.0, n_slots=4, slot_w=4.0, slot_depth=3.0, slot_h=3.0)


def _solid_at(part, x, y, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def _polar(radius, deg):
    return radius * math.cos(math.radians(deg)), radius * math.sin(math.radians(deg))


def test_envelope_extents():
    part = slotted_round_nut(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["h"], 1)      # full height on the axis
    assert round(bb.size.X, 1) == round(CFG["d"], 1)      # full OD (partial slots don't shrink bbox)
    assert round(bb.size.Y, 1) == round(CFG["d"], 1)
    assert part.volume > 0


def test_slots_notch_the_od_near_the_top_face():
    part = slotted_round_nut(**CFG)
    z = CFG["h"] / 2 - CFG["slot_h"] / 2         # mid of the top-open slot band
    r = CFG["d"] / 2 - CFG["slot_depth"] / 2     # inside the slot depth band radially
    for k in range(CFG["n_slots"]):              # slots at 0, 90, 180, 270 deg
        x, y = _polar(r, 360.0 / CFG["n_slots"] * k)
        assert not _solid_at(part, x, y, z, probe=0.6)   # void: a slot is cut here
    x, y = _polar(r, 45.0)                        # between two slots
    assert _solid_at(part, x, y, z, probe=0.6)   # solid: a tower


def test_slots_are_partial_depth_solid_below():
    # The defining feature: the slots open from the top face only; below slot_h the OD is solid.
    part = slotted_round_nut(**CFG)
    z = -CFG["h"] / 2 + 0.5                       # near the bottom face, below the slot band
    r = CFG["d"] / 2 - CFG["slot_depth"] / 2
    x, y = _polar(r, 0.0)                         # on the +X slot axis
    assert _solid_at(part, x, y, z, probe=0.6)   # solid: the slot does not reach the bottom face


def test_slot_floor_leaves_a_wall_to_the_bore():
    part = slotted_round_nut(**CFG)
    z = CFG["h"] / 2 - CFG["slot_h"] / 2
    # +X slot axis, radius 9: below the slot floor (r=12) and above the bore (r=6.5) -> solid
    assert _solid_at(part, 9.0, 0.0, z)


def test_open_bore_through_the_nut():
    part = slotted_round_nut(**CFG)
    assert not _solid_at(part, 0.0, 0.0, 0.0, probe=0.6)   # bore void on the axis
    x, y = _polar(9.0, 45.0)                               # a between-slot wall
    assert _solid_at(part, x, y, 0.0, probe=0.6)
    solid = slotted_round_nut(**{**CFG, "bore": 0.4})
    assert part.volume < solid.volume                     # the bore removes real material


def test_builds_at_a_valid_config():
    assert slotted_round_nut(**CFG).volume > 0


def test_slotted_round_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "d": 0.0})              # non-positive dim
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "slot_w": 0.0})         # non-positive slot_w
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "slot_h": 0.0})         # non-positive slot_h
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "slot_h": CFG["h"] + 1.0})   # slot deeper than the nut
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "bore": CFG["d"]})      # bore wall vs OD too thin
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "slot_depth": 9.0})     # slot floor reaches the bore wall
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "n_slots": 200})        # slots exceed the circumference
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "n_slots": 4.5})        # non-integer slot count
    with pytest.raises(ValueError):
        slotted_round_nut(**{**CFG, "n_slots": 0})          # non-positive slot count
