import math

import pytest

from catalog.models.castle_nut import castle_nut

S = 18.0                                   # M12 across-flats
M = 15.0                                   # total height (DIN 935-like fixture)
BORE = 10.1
DK = 16.0
M1 = 10.0                                  # un-slotted height / slot floor
N = 6
E = 3.5
CIRCUMRADIUS = S / math.sqrt(3.0)
ACROSS_CORNERS = 2.0 * CIRCUMRADIUS


def test_castle_nut_is_vertex_up_with_correct_extents():
    part = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=E)
    bb = part.bounding_box()
    assert round(bb.size.X, 2) == round(ACROSS_CORNERS, 2)   # hex corners widest (vertex-up)
    assert round(bb.size.Y, 2) == round(S, 2)                # flats on Y
    assert round(bb.size.Z, 2) == round(M, 2)                # total height along Z
    assert part.volume > 0


def test_castle_nut_crown_is_narrower_than_the_hex():
    # Above the slot floor only the crown (dk) exists — no vertex reaches past dk/2.
    part = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=E)
    upper = [math.hypot(v.X, v.Y) for v in part.vertices() if v.Z > M1 + 0.1]
    assert upper, "expected vertices in the crown region"
    assert max(upper) <= DK / 2.0 + 0.01                     # crown, not the wider hex


def test_castle_nut_slots_remove_material():
    # More slots remove more crown material (same envelope otherwise).
    six = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=6, e=E)
    two = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=2, e=E)
    assert six.volume < two.volume


def test_castle_nut_has_an_open_bore():
    holed = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=E)
    solid = castle_nut(s=S, m=M, bore=0.001, dk=DK, m1=M1, n_slots=N, e=E)
    assert holed.volume < solid.volume                       # the bore removes material


def test_castle_nut_hex_body_is_intact_below_the_slot_floor():
    # Below m1 the part is the full chamfered hex (wider than the crown) — the slots,
    # whose floor is pinned at z=m1, never reach it.
    part = castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=E)
    lower = [math.hypot(v.X, v.Y) for v in part.vertices() if v.Z < M1 - 0.1]
    assert lower, "expected hex-body vertices below the slot floor"
    # material reaches out past the crown (dk/2) toward the hex corners, and no further.
    assert DK / 2.0 + 0.5 < max(lower) <= CIRCUMRADIUS + 0.01


def test_castle_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=0.0, dk=DK, m1=M1, n_slots=N, e=E)      # non-positive bore
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=S, dk=DK, m1=M1, n_slots=N, e=E)        # bore too big
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M, n_slots=N, e=E)      # m1 == m: no crown
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=S + 1.0, m1=M1, n_slots=N, e=E)  # crown wider than hex
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=E, chamfer=DK - 1.0)  # crown overhangs chamfer
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=DK - 0.05, dk=DK, m1=M1, n_slots=N, e=E)  # crown wall too thin (subsumes dk<=bore)
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=0.0)   # non-positive slot width
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=DK)    # slot as wide as crown
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=2.5, e=E)   # non-integer slot count
    with pytest.raises(ValueError):
        castle_nut(s=S, m=M, bore=BORE, dk=DK, m1=M1, n_slots=100, e=E)   # towers can't survive
    with pytest.raises(ValueError):
        castle_nut(s=0.0, m=M, bore=BORE, dk=DK, m1=M1, n_slots=N, e=E)   # zero across-flats (helper)
