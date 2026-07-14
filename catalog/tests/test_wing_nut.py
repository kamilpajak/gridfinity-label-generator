import pytest
from build123d import Box, Pos, Compound

from catalog.models.wing_nut import wing_nut

BORE = 10.1        # DIN 315 M12 fixture (German Form D)
BOSS_D = 23.0
BOSS_H = 14.0
SPAN = 65.0
HEIGHT = 33.5
WING_T = 4.9
TIP_R = 10.0


def _part():
    return wing_nut(bore=BORE, boss_d=BOSS_D, boss_h=BOSS_H, span=SPAN,
                    height=HEIGHT, wing_t=WING_T, tip_r=TIP_R)


def _intersect(part, x, z, sx, sy, sz):
    """Part ∩ a box centered at (x, 0, z). build123d returns None when the overlap is empty."""
    return part.intersect(Pos(x, 0.0, z) * Box(sx, sy, sz))


def _has_material(part, x, z, probe=1.0):
    """True if the part has any material in a small cube centered at (x, 0, z)."""
    return _intersect(part, x, z, probe, probe, probe) is not None


def test_wing_nut_envelope_extents():
    bb = _part().bounding_box()
    assert round(bb.size.X, 2) == round(SPAN, 2)       # wing tips define the width (X)
    assert round(bb.size.Z, 2) == round(HEIGHT, 2)     # boss axis height (Z)
    assert round(bb.size.Y, 2) == round(BOSS_D, 2)     # hub diameter is widest along Y
    assert _part().volume > 0


def test_wing_blade_thickness_reads_wing_t():
    # a thin column tall in Y through a wing lobe measures the blade thickness (arc tips
    # carry no vertices, so probe the solid rather than sampling vertices)
    col = _intersect(_part(), x=SPAN / 2.0 - TIP_R, z=HEIGHT - TIP_R, sx=0.4, sy=50.0, sz=0.4)
    assert col is not None
    assert round(Compound(col).bounding_box().size.Y, 2) == round(WING_T, 2)


def test_two_wings_leave_a_central_dip():
    part = _part()
    top = HEIGHT - 1.0
    assert _has_material(part, x=SPAN / 2.0 - TIP_R, z=top)     # over a lobe: material
    assert not _has_material(part, x=0.0, z=top)                # center near top: dip, empty


def test_wing_lobe_is_rounded_not_square():
    # the square envelope corner (tip, top) is cut away by the rounded lobe arc
    assert not _has_material(_part(), x=SPAN / 2.0 - 0.5, z=HEIGHT - 0.5, probe=0.6)


def test_boss_wall_and_open_bore():
    part = _part()
    assert _has_material(part, x=BOSS_D / 2.0 - 0.6, z=1.0, probe=0.5)      # inside the hub wall
    assert not _has_material(part, x=BOSS_D / 2.0 + 0.6, z=1.0, probe=0.5)  # just outside the hub
    solid = wing_nut(bore=0.4, boss_d=BOSS_D, boss_h=BOSS_H, span=SPAN,
                     height=HEIGHT, wing_t=WING_T, tip_r=TIP_R)
    assert part.volume < solid.volume            # the M12 bore removes more than a pinhole


def test_wing_nut_guards_bad_geometry():
    base = dict(bore=BORE, boss_d=BOSS_D, boss_h=BOSS_H, span=SPAN,
                height=HEIGHT, wing_t=WING_T, tip_r=TIP_R)
    with pytest.raises(ValueError):
        wing_nut(**{**base, "bore": 0.0})                       # non-positive dim
    with pytest.raises(ValueError):
        wing_nut(**{**base, "boss_d": BORE})                    # wall too thin around bore
    with pytest.raises(ValueError):
        wing_nut(**{**base, "span": BOSS_D})                    # wings don't reach past the hub
    with pytest.raises(ValueError):
        wing_nut(**{**base, "height": BOSS_H})                  # wings don't rise above the hub
    with pytest.raises(ValueError):
        wing_nut(**{**base, "tip_r": HEIGHT})                   # lobe taller than half the height
    with pytest.raises(ValueError):
        wing_nut(**{**base, "span": BOSS_D + 2.0 * TIP_R})      # lobe center == hub radius -> no dip
