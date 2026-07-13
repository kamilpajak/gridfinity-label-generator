import math

import pytest

from catalog.models.flange_nut import flange_nut

S = 18.0            # M12 across-flats
M = 15.0            # total height (illustrative fixture, not shipped data)
BORE = 10.1
D_FLANGE = 26.0
FLANGE_T = 2.6
CIRCUMRADIUS = S / math.sqrt(3.0)


def _radii(part):
    return [math.hypot(v.X, v.Y) for v in part.vertices()]


def test_flange_nut_flange_is_wider_than_the_hex():
    part = flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    bb = part.bounding_box()
    # The circular flange is the widest feature: both plan extents equal d_flange.
    assert round(bb.size.X, 1) == round(D_FLANGE, 1)
    assert round(bb.size.Y, 1) == round(D_FLANGE, 1)
    # and it reaches past the hex corners.
    assert max(_radii(part)) > CIRCUMRADIUS + 0.5
    assert round(bb.size.Z, 1) == round(M, 1)
    assert part.volume > 0


def test_flange_nut_flange_sits_at_the_base():
    # The widest ring of vertices is near the bearing face (z ~ 0), not the top.
    part = flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    rim = [v for v in part.vertices() if math.hypot(v.X, v.Y) > CIRCUMRADIUS + 0.5]
    assert rim, "expected flange-rim vertices beyond the hex corners"
    assert min(v.Z for v in rim) < FLANGE_T + 0.5      # rim lives at the bottom


def test_flange_nut_has_an_open_bore():
    solid = flange_nut(s=S, m=M, bore=0.001, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    holed = flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    assert holed.volume < solid.volume                 # the bore removes material


def test_flange_nut_top_is_a_chamfered_hex():
    # Near the top face the section is the hex (bounded by the corner circle), not the flange.
    part = flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    top = [math.hypot(v.X, v.Y) for v in part.vertices() if v.Z > M - 0.2]
    assert top and max(top) <= CIRCUMRADIUS + 0.01     # top is within the hex, not the flange


def test_flange_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        flange_nut(s=0.0, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=FLANGE_T)
    with pytest.raises(ValueError):
        flange_nut(s=S, m=M, bore=S, d_flange=D_FLANGE, flange_thickness=FLANGE_T)       # bore too big
    with pytest.raises(ValueError):
        flange_nut(s=S, m=M, bore=BORE, d_flange=CIRCUMRADIUS, flange_thickness=FLANGE_T)  # flange not past corners
    with pytest.raises(ValueError):
        flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=0.0)         # no flange
    with pytest.raises(ValueError):
        flange_nut(s=S, m=M, bore=BORE, d_flange=D_FLANGE, flange_thickness=M)           # flange eats whole height
