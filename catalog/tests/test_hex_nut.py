import math

import pytest

from catalog.models.hex_nut import hex_nut

S = 18.0   # M12 ISO 4032 across-flats (illustrative fixture, not shipped data)
M = 10.8
BORE = 10.2
CIRCUMRADIUS = S / math.sqrt(3.0)          # corner radius
ACROSS_CORNERS = 2.0 * CIRCUMRADIUS


def test_hex_nut_is_vertex_up_with_correct_extents():
    part = hex_nut(s=S, m=M, bore=BORE)
    bb = part.bounding_box()
    assert round(bb.size.X, 2) == round(ACROSS_CORNERS, 2)  # corners top/bottom -> across-corners on X
    assert round(bb.size.Y, 2) == round(S, 2)               # flats left/right -> across-flats on Y
    assert round(bb.size.Z, 2) == round(M, 2)               # height along Z
    assert part.volume > 0


def test_hex_nut_has_an_open_bore():
    part = hex_nut(s=S, m=M, bore=BORE)
    # A ring of material only: volume is far below a solid hex prism of the same envelope.
    hex_area = (math.sqrt(3.0) / 2.0) * S * S                # regular hexagon, across-flats S
    solid_prism = hex_area * M
    bore_col = math.pi * (BORE / 2.0) ** 2 * M
    assert part.volume < solid_prism - bore_col * 0.9        # the bore removed roughly a full column


def test_hex_nut_top_face_is_chamfered():
    # The chamfer bevels the corners at the top and bottom faces: vertices near the end
    # faces sit at the chamfer radius (~s/2), well inside the full corner radius at mid-height.
    part = hex_nut(s=S, m=M, bore=BORE)
    verts = list(part.vertices())
    top = [v for v in verts if v.Z > M - 0.2]
    assert top, "expected vertices on the top face"
    top_max_r = max(math.hypot(v.X, v.Y) for v in top)
    # a plain (unchamfered) prism would have top corners out at the circumradius;
    # the chamfer pulls them in to ~s/2, so the top radius is clearly smaller.
    assert top_max_r < CIRCUMRADIUS - 0.3


def test_hex_nut_chamfer_removes_material_vs_a_plain_prism():
    from build123d import BuildPart, BuildSketch, RegularPolygon, Cylinder, extrude, Mode

    def plain_prism(s, m, bore):
        with BuildPart() as bp:
            with BuildSketch():
                RegularPolygon(radius=s / math.sqrt(3.0), side_count=6)
            extrude(amount=m)
            Cylinder(radius=bore / 2, height=m * 3, mode=Mode.SUBTRACT)
        return bp.part

    chamfered = hex_nut(s=S, m=M, bore=BORE)
    prism = plain_prism(S, M, BORE)
    assert chamfered.volume < prism.volume       # chamfer shaves the eight corners


def test_hex_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        hex_nut(s=0.0, m=M, bore=BORE)           # zero across-flats
    with pytest.raises(ValueError):
        hex_nut(s=S, m=0.0, bore=BORE)           # zero height
    with pytest.raises(ValueError):
        hex_nut(s=S, m=M, bore=S)                # bore >= across-flats: no wall left
    with pytest.raises(ValueError):
        hex_nut(s=S, m=M, bore=BORE, chamfer=S * 3)   # chamfer circle wider than the corners


def test_chamfered_hex_solid_is_a_solid_hex_with_no_bore():
    import math
    from catalog.models.hex_nut import _chamfered_hex_solid, hex_nut

    solid = _chamfered_hex_solid(s=S, m=M)
    bb = solid.bounding_box()
    assert round(bb.size.X, 2) == round(ACROSS_CORNERS, 2)   # vertex-up: corners on X
    assert round(bb.size.Y, 2) == round(S, 2)                # flats on Y
    assert round(bb.size.Z, 2) == round(M, 2)
    # No bore: the solid body holds more material than the same nut with a hole.
    assert solid.volume > hex_nut(s=S, m=M, bore=BORE).volume
