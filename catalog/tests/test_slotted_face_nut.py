import pytest
from build123d import Box, Pos

from catalog.models.slotted_face_nut import slotted_face_nut

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
# One diametral slot along X, opening from the top face (z=+h/2) down slot_depth,
# so the slot band is z in [2, 5]; slot half-width in Y is 2.5.
CFG = dict(d=30.0, h=10.0, bore=13.0, slot_w=5.0, slot_depth=3.0)


def _solid_at(part, x, y, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = slotted_face_nut(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["h"], 1)     # full height on the axis
    assert round(bb.size.X, 1) == round(CFG["d"], 1)     # full OD
    assert round(bb.size.Y, 1) == round(CFG["d"], 1)
    assert part.volume > 0


def test_slot_notches_the_top_face_along_x():
    part = slotted_face_nut(**CFG)
    z = CFG["h"] / 2 - CFG["slot_depth"] / 2             # mid of the top-open slot band
    # On the slot centreline (y=0), out toward the rim: void where the slot is cut.
    assert not _solid_at(part, CFG["d"] / 2 - 2.0, 0.0, z, probe=0.6)
    # Off the slot in Y (beyond slot_w/2): solid.
    assert _solid_at(part, CFG["d"] / 2 - 2.0, CFG["slot_w"] / 2 + 1.5, z, probe=0.6)


def test_slot_is_partial_depth_solid_below():
    # The defining feature: the slot opens from the top face only; below slot_depth it is solid.
    part = slotted_face_nut(**CFG)
    z = -CFG["h"] / 2 + 0.5                               # near the bottom face, below the slot band
    assert _solid_at(part, CFG["d"] / 2 - 2.0, 0.0, z, probe=0.6)   # solid: slot does not reach the bottom


def test_open_bore_through_the_nut():
    part = slotted_face_nut(**CFG)
    assert not _solid_at(part, 0.0, 0.0, -CFG["h"] / 2 + 0.5, probe=0.6)   # bore void on the axis
    assert _solid_at(part, 0.0, 8.0, 0.0, probe=0.6)      # off-slot wall between bore and OD is solid
    solid = slotted_face_nut(**{**CFG, "bore": 0.4})
    assert part.volume < solid.volume                     # the bore removes real material


def test_builds_at_a_valid_config():
    assert slotted_face_nut(**CFG).volume > 0


def test_slotted_face_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "d": 0.0})              # non-positive dim
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "slot_w": 0.0})         # non-positive slot_w
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "slot_depth": 0.0})     # non-positive slot_depth
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "slot_depth": CFG["h"]})   # slot as deep as the nut (no floor)
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "slot_w": CFG["d"]})    # slot as wide as the OD (no rim)
    with pytest.raises(ValueError):
        slotted_face_nut(**{**CFG, "bore": CFG["d"]})      # bore wall vs OD too thin
