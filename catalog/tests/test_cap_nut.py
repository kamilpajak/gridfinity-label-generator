import math

import pytest

from catalog.models.cap_nut import cap_nut

S = 18.0                                   # M12 across-flats
R_FLAT = S / 2.0                           # dome base circle == top chamfer circle
CIRCUMRADIUS = S / math.sqrt(3.0)          # hex corner radius
ACROSS_CORNERS = 2.0 * CIRCUMRADIUS

# Hemisphere fixture (dome height == base radius): the dome never exceeds the flats.
M_HEMI = 18.0
DOME_HEMI = 9.0
# Tall acorn fixture (DIN 1587-like): dome taller than a hemisphere.
M_TALL = 22.0
DOME_TALL = 12.0


def _cap_volume(r_flat, h):
    r = (r_flat ** 2 + h ** 2) / (2.0 * h)          # sphere radius R
    return math.pi * h ** 2 * (3.0 * r - h) / 3.0   # spherical-cap volume


def test_cap_nut_is_vertex_up_with_a_hemisphere_within_the_flats():
    part = cap_nut(s=S, m=M_HEMI, dome_height=DOME_HEMI)
    bb = part.bounding_box()
    assert round(bb.size.X, 2) == round(ACROSS_CORNERS, 2)   # hex corners widest (vertex-up)
    assert round(bb.size.Y, 2) == round(S, 2)                # a hemisphere stays within the flats
    assert round(bb.size.Z, 2) == round(M_HEMI, 2)           # total height along Z
    assert part.volume > 0


def test_cap_nut_dome_reaches_the_total_height():
    part = cap_nut(s=S, m=M_TALL, dome_height=DOME_TALL)
    bb = part.bounding_box()
    assert round(bb.max.Z, 1) == round(M_TALL, 1)            # apex at the total height m
    # The dome adds material above the bare hex body.
    from catalog.models.hex_nut import _chamfered_hex_solid
    hex_body = _chamfered_hex_solid(S, M_TALL - DOME_TALL)
    assert part.volume > hex_body.volume


def test_cap_nut_is_a_closed_solid_hex_body_plus_spherical_cap():
    part = cap_nut(s=S, m=M_TALL, dome_height=DOME_TALL)
    from catalog.models.hex_nut import _chamfered_hex_solid
    hex_body = _chamfered_hex_solid(S, M_TALL - DOME_TALL)
    expected = hex_body.volume + _cap_volume(R_FLAT, DOME_TALL)   # no bore removed
    assert abs(part.volume - expected) / expected < 0.02


def test_cap_nut_bottom_face_is_chamfered():
    part = cap_nut(s=S, m=M_HEMI, dome_height=DOME_HEMI)
    bottom = [v for v in part.vertices() if v.Z < 0.2]
    assert bottom, "expected vertices on the bottom bearing face"
    # The bottom chamfer pulls the corners in from the full corner radius to ~s/2.
    assert max(math.hypot(v.X, v.Y) for v in bottom) < CIRCUMRADIUS - 0.3


def test_cap_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        cap_nut(s=S, m=M_HEMI, dome_height=0.0)              # no dome
    with pytest.raises(ValueError):
        cap_nut(s=S, m=M_HEMI, dome_height=M_HEMI)           # dome eats the whole height
    with pytest.raises(ValueError):
        cap_nut(s=S, m=30.0, dome_height=28.0)               # dome > 3x base radius: likely bad data
    with pytest.raises(ValueError):
        cap_nut(s=0.0, m=M_HEMI, dome_height=DOME_HEMI)      # zero across-flats (delegated to helper)
