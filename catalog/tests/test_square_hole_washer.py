import math
import pytest
from build123d import Box, Pos

from catalog.models.square_hole_washer import square_hole_washer

# Synthetic fixture (NOT a real standard): 30 mm disc, 3 mm thick, 13 mm square hole.
SQ = dict(d_outer=30.0, thickness=3.0, hole_side=13.0)


def _solid_at(part, x, y, z, probe=0.5):
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = square_hole_washer(**SQ)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(SQ["d_outer"], 1)     # disc diameter on X
    assert round(bb.size.Z, 1) == round(SQ["thickness"], 1)   # centred, so |z| <= t/2
    assert part.volume > 0


def test_hole_is_square_not_round():
    # hole_side=13 -> square spans |x|,|y| < 6.5. A point near the square's CORNER (6.0, 6.0) is
    # inside the square (void), but its radius 8.49 exceeds hole_side/2=6.5, so a ROUND hole of the
    # same width would leave it solid. Void there proves the hole reaches the corners (square).
    part = square_hole_washer(**SQ)
    assert not _solid_at(part, 0.0, 0.0, 0.0, probe=0.3)      # void on the axis (inside the hole)
    assert not _solid_at(part, 6.0, 6.0, 0.0, probe=0.3)      # void at the square corner region
    assert _solid_at(part, 10.0, 0.0, 0.0, probe=0.3)         # solid disc body (r 6.5..15)


def test_single_solid():
    part = square_hole_washer(**SQ)
    assert len(part.solids()) == 1


def test_square_hole_washer_guards():
    with pytest.raises(ValueError):
        square_hole_washer(**{**SQ, "d_outer": 0.0})          # non-positive dim
    with pytest.raises(ValueError):
        square_hole_washer(**{**SQ, "hole_side": 25.0})       # 25*sqrt2=35.4 >= 30: corners pierce edge
    with pytest.raises(ValueError):
        square_hole_washer(**{**SQ, "hole_corner_r": 7.0})    # corner_r >= hole_side/2
