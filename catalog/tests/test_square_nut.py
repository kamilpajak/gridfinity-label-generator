import math

import pytest

from catalog.models.square_nut import square_nut

S = 18.0                                   # DIN 557 fixture (chamfered)
M = 10.0
BORE = 10.1
CIRCUMRADIUS = S / math.sqrt(2.0)          # half-diagonal (across-corners / 2)
DIAGONAL = 2.0 * CIRCUMRADIUS              # s * sqrt(2)


def test_square_nut_is_vertex_up_with_across_corners_extents():
    part = square_nut(s=S, m=M, bore=BORE, chamfer=S)
    bb = part.bounding_box()
    # vertex-up (a corner points up, like the hex nuts): the diagonal runs along the view
    # axes, so both plan extents equal the across-corners (s * sqrt(2)), not the flats.
    assert round(bb.size.X, 2) == round(DIAGONAL, 2)
    assert round(bb.size.Y, 2) == round(DIAGONAL, 2)
    assert round(bb.size.Z, 2) == round(M, 2)
    assert part.volume > 0


def test_square_nut_plain_prism_keeps_full_square_corners():
    part = square_nut(s=S, m=M, bore=BORE)         # chamfer=None
    radii = [math.hypot(v.X, v.Y) for v in part.vertices()]
    assert max(radii) > CIRCUMRADIUS - 0.01        # corners reach the full half-diagonal
    assert round(part.bounding_box().size.X, 2) == round(DIAGONAL, 2)   # vertex-up: diagonal on the axes


def test_square_nut_top_chamfer_bevels_the_top_corners_only():
    part = square_nut(s=S, m=M, bore=BORE, chamfer=S)
    verts = list(part.vertices())
    bottom = [math.hypot(v.X, v.Y) for v in verts if v.Z < 0.2]
    top = [math.hypot(v.X, v.Y) for v in verts if v.Z > M - 0.2]
    assert bottom and top
    assert max(bottom) > CIRCUMRADIUS - 0.01       # bearing face keeps sharp full-square corners
    assert max(top) < CIRCUMRADIUS - 0.5           # top corners beveled inward


def test_square_nut_chamfer_removes_material_vs_plain_prism():
    plain = square_nut(s=S, m=M, bore=BORE)
    chamfered = square_nut(s=S, m=M, bore=BORE, chamfer=S)
    assert chamfered.volume < plain.volume         # the top bevel shaves the four corners


def test_square_nut_has_an_open_bore():
    holed = square_nut(s=S, m=M, bore=BORE)
    solid = square_nut(s=S, m=M, bore=0.001)
    assert holed.volume < solid.volume             # the bore removes material


def test_square_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        square_nut(s=0.0, m=M, bore=BORE)                       # zero across-flats
    with pytest.raises(ValueError):
        square_nut(s=S, m=M, bore=0.0)                          # non-positive bore
    with pytest.raises(ValueError):
        square_nut(s=S, m=M, bore=S)                            # bore >= across-flats
    with pytest.raises(ValueError):
        square_nut(s=S, m=M, bore=BORE, chamfer=DIAGONAL + 1.0)  # chamfer circle past the corners
    with pytest.raises(ValueError):
        square_nut(s=S, m=1.0, bore=BORE, chamfer=S)            # chamfer rise doesn't fit in the height
