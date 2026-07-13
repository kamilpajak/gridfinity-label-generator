import math

import pytest

from catalog.models.collar_nut import collar_nut

S = 18.0                                   # M12 across-flats
M = 18.0                                   # total height (incl. collar), DIN 6331 fixture
BORE = 10.1
DC = 25.0                                  # collar diameter
COLLAR_H = 4.0
CIRCUMRADIUS = S / math.sqrt(3.0)          # hex corner radius


def _radii(part):
    return [math.hypot(v.X, v.Y) for v in part.vertices()]


def test_collar_nut_collar_is_the_widest_feature():
    part = collar_nut(s=S, m=M, bore=BORE, dc=DC, collar_height=COLLAR_H)
    bb = part.bounding_box()
    # The circular collar is wider than the hex corners: both plan extents equal dc.
    assert round(bb.size.X, 1) == round(DC, 1)
    assert round(bb.size.Y, 1) == round(DC, 1)
    assert max(_radii(part)) > CIRCUMRADIUS + 0.5          # reaches past the hex corners
    assert round(bb.size.Z, 1) == round(M, 1)              # height along Z
    assert part.volume > 0


def test_collar_nut_collar_sits_at_the_bearing_face():
    # The widest ring of vertices is near the bearing face (z ~ 0), not the top.
    part = collar_nut(s=S, m=M, bore=BORE, dc=DC, collar_height=COLLAR_H)
    rim = [v for v in part.vertices() if math.hypot(v.X, v.Y) > CIRCUMRADIUS + 0.5]
    assert rim, "expected collar-rim vertices beyond the hex corners"
    assert min(v.Z for v in rim) < COLLAR_H + 0.5          # rim lives at the bottom


def test_collar_nut_top_is_a_chamfered_hex():
    # Near the top face the section is the hex (bounded by the corner circle), not the collar.
    part = collar_nut(s=S, m=M, bore=BORE, dc=DC, collar_height=COLLAR_H)
    top = [math.hypot(v.X, v.Y) for v in part.vertices() if v.Z > M - 0.2]
    assert top and max(top) <= CIRCUMRADIUS + 0.01         # top is within the hex, not the collar


def test_collar_nut_has_an_open_bore():
    holed = collar_nut(s=S, m=M, bore=BORE, dc=DC, collar_height=COLLAR_H)
    solid = collar_nut(s=S, m=M, bore=0.001, dc=DC, collar_height=COLLAR_H)
    assert holed.volume < solid.volume                     # the bore removes material


def test_collar_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        collar_nut(s=S, m=M, bore=0.0, dc=DC, collar_height=COLLAR_H)       # non-positive bore
    with pytest.raises(ValueError):
        collar_nut(s=S, m=M, bore=S, dc=DC, collar_height=COLLAR_H)         # bore too big
    with pytest.raises(ValueError):
        collar_nut(s=S, m=M, bore=BORE, dc=DC, collar_height=M)             # collar eats whole height
    with pytest.raises(ValueError):
        collar_nut(s=S, m=M, bore=BORE, dc=CIRCUMRADIUS, collar_height=COLLAR_H)  # collar not past corners
    with pytest.raises(ValueError):
        collar_nut(s=0.0, m=M, bore=BORE, dc=DC, collar_height=COLLAR_H)    # zero across-flats (helper)
