import math

import pytest
from build123d import Box, Pos

from catalog.models.cross_hole_nut import cross_hole_nut

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
# 4 radial holes at mid-height (z=0), drilled hole_depth into the OD wall.
CFG = dict(d=30.0, h=12.0, bore=13.0, n_holes=4, hole_d=4.0, hole_depth=5.0)


def _solid_at(part, x, y, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def _polar(radius, deg):
    return radius * math.cos(math.radians(deg)), radius * math.sin(math.radians(deg))


def test_envelope_extents():
    part = cross_hole_nut(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["h"], 1)      # full height
    assert round(bb.size.X, 1) == round(CFG["d"], 1)      # full OD (holes subtract, don't grow bbox)
    assert round(bb.size.Y, 1) == round(CFG["d"], 1)
    assert part.volume > 0


def test_holes_notch_the_wall_at_mid_height():
    part = cross_hole_nut(**CFG)
    r = CFG["d"] / 2 - CFG["hole_depth"] / 2              # inside the drilled band, radially
    for k in range(CFG["n_holes"]):                       # holes at 0, 90, 180, 270 deg
        x, y = _polar(r, 360.0 / CFG["n_holes"] * k)
        assert not _solid_at(part, x, y, 0.0, probe=0.6)  # void: a hole is drilled here
    x, y = _polar(r, 45.0)                                # between two holes
    assert _solid_at(part, x, y, 0.0, probe=0.6)          # solid: a tower


def test_holes_leave_a_wall_band_above_and_below():
    # The radial hole sits at mid-height; near the top and bottom faces the wall is solid.
    part = cross_hole_nut(**CFG)
    r = CFG["d"] / 2 - 0.5                                # just inside the OD
    for z in (CFG["h"] / 2 - 0.5, -CFG["h"] / 2 + 0.5):   # top and bottom bands
        x, y = _polar(r, 0.0)                             # the +X hole axis
        assert _solid_at(part, x, y, z, probe=0.6)        # solid: hole does not reach the faces


def test_hole_floor_leaves_a_wall_to_the_bore():
    part = cross_hole_nut(**CFG)
    # +X hole axis, radius 8: inside the hole floor (r = d/2 - hole_depth = 10) and above the
    # bore wall (bore/2 = 6.5) -> solid.
    assert _solid_at(part, 8.0, 0.0, 0.0)


def test_open_bore_through_the_nut():
    part = cross_hole_nut(**CFG)
    assert not _solid_at(part, 0.0, 0.0, 0.0, probe=0.6)  # bore void on the axis
    x, y = _polar(8.0, 45.0)                              # a between-hole wall
    assert _solid_at(part, x, y, 0.0, probe=0.6)
    solid = cross_hole_nut(**{**CFG, "bore": 0.4})
    assert part.volume < solid.volume                     # the bore removes real material


def test_builds_at_a_valid_config():
    assert cross_hole_nut(**CFG).volume > 0


def test_cross_hole_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "d": 0.0})                # non-positive dim
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "hole_d": 0.0})           # non-positive hole_d
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "hole_depth": 0.0})       # non-positive hole_depth
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "hole_d": CFG["h"]})      # hole taller than the height band
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "hole_depth": 9.0})       # hole floor reaches the bore wall
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "bore": CFG["d"]})        # bore wall vs OD too thin
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "n_holes": 200})          # holes exceed the circumference
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "n_holes": 4.5})          # non-integer hole count
    with pytest.raises(ValueError):
        cross_hole_nut(**{**CFG, "n_holes": 0})            # non-positive hole count
