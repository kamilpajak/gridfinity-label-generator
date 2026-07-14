import pytest
from build123d import Box, Pos, Compound

from catalog.models.wing_nut import wing_nut

BORE = 10.1        # DIN 315 M12 fixture (German Form D)
BOSS_D = 23.0
COLLAR_D = 19.5
BOSS_H = 14.0
SPAN = 65.0
HEIGHT = 33.5
WING_T = 4.9


def _part():
    return wing_nut(bore=BORE, boss_d=BOSS_D, collar_d=COLLAR_D, boss_h=BOSS_H,
                    span=SPAN, height=HEIGHT, wing_t=WING_T)


def _intersect(part, x, z, sx, sy, sz):
    """Part ∩ a box centered at (x, 0, z). build123d returns None when the overlap is empty."""
    return part.intersect(Pos(x, 0.0, z) * Box(sx, sy, sz))


def _has_material(part, x, z, probe=1.0):
    """True if the part has any material in a small cube centered at (x, 0, z)."""
    return _intersect(part, x, z, probe, probe, probe) is not None


def _solid_at(part, x, y, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, y, z)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_wing_nut_envelope_extents():
    part = _part()
    bb = part.bounding_box()
    assert SPAN - 1.0 <= bb.size.X <= SPAN + 0.05      # wing tips ~ span (ear fillet trims a hair)
    assert round(bb.size.Y, 1) == round(BOSS_D, 1)     # hub base diameter is widest along Y
    assert HEIGHT - 0.5 <= bb.size.Z <= HEIGHT + 0.05  # wing top ~ height
    assert part.volume > 0


def test_hub_tapers_from_boss_d_to_collar_d():
    # the hub is a truncated cone: wide (boss_d) at the bearing face, narrowed (collar_d) near
    # the top. Probe at a radius between collar_d/2 and boss_d/2, offset in Y clear of the wing
    # blades (|y| > wing_t/2), so only the hub is sampled: solid at the base, empty near the top.
    part = _part()
    x, y = 10.0, 3.0          # sqrt(x^2 + y^2) ~= 10.4, between collar_d/2 (9.75) and boss_d/2 (11.5)
    assert _solid_at(part, x, y, 0.5, probe=0.4)                 # wide at the base
    assert not _solid_at(part, x, y, BOSS_H - 0.5, probe=0.4)    # narrowed near the top


def test_wing_blade_thickness_reads_wing_t():
    # a thin column tall in Y through a wing (above the hub, so it hits only the blade)
    col = _intersect(_part(), x=0.60 * SPAN / 2.0, z=0.72 * HEIGHT, sx=0.4, sy=50.0, sz=0.4)
    assert col is not None
    assert round(Compound(col).bounding_box().size.Y, 2) == round(WING_T, 2)


def test_two_wings_spread_into_a_v_notch():
    part = _part()
    assert _has_material(part, x=0.60 * SPAN / 2.0, z=0.72 * HEIGHT)   # over an ear: material
    assert not _has_material(part, x=0.0, z=0.85 * HEIGHT)            # V opening at the top center


def test_wings_rise_from_the_hub():
    # just above the hub the wing blade is present, i.e. the wings are attached to the hub below
    assert _has_material(_part(), x=0.45 * SPAN / 2.0, z=0.48 * HEIGHT)


def test_boss_wall_and_open_bore():
    part = _part()
    assert _has_material(part, x=8.0, z=0.5, probe=0.5)      # hub wall (between bore and OD)
    assert not _has_material(part, x=0.0, z=0.5, probe=0.5)  # inside the through bore
    solid = wing_nut(bore=0.4, boss_d=BOSS_D, collar_d=COLLAR_D, boss_h=BOSS_H,
                     span=SPAN, height=HEIGHT, wing_t=WING_T)
    assert part.volume < solid.volume            # the M12 bore removes more than a pinhole


@pytest.mark.parametrize("cfg", [
    dict(bore=10.1, boss_d=23.0, collar_d=19.5, boss_h=14.0, span=44.0, height=24.0, wing_t=4.9),
    dict(bore=10.1, boss_d=23.0, collar_d=23.0, boss_h=8.0, span=65.0, height=20.0, wing_t=4.9),
    dict(bore=10.1, boss_d=23.0, collar_d=12.0, boss_h=14.0, span=65.0, height=33.5, wing_t=1.0),
])
def test_wing_nut_builds_at_valid_boundary_configs(cfg):
    part = wing_nut(**cfg)
    assert part.volume > 0
    assert not _has_material(part, x=0.0, z=0.92 * cfg["height"], probe=0.4)   # V notch survives
    assert _has_material(part, x=0.60 * cfg["span"] / 2.0, z=0.72 * cfg["height"])  # ear present


def test_wing_nut_guards_bad_geometry():
    base = dict(bore=BORE, boss_d=BOSS_D, collar_d=COLLAR_D, boss_h=BOSS_H,
                span=SPAN, height=HEIGHT, wing_t=WING_T)
    with pytest.raises(ValueError):
        wing_nut(**{**base, "bore": 0.0})                       # non-positive dim (zero)
    with pytest.raises(ValueError):
        wing_nut(**{**base, "bore": -1.0})                      # non-positive dim (negative)
    with pytest.raises(ValueError):
        wing_nut(**{**base, "wing_t": 0.0})                     # non-positive dim (other param)
    with pytest.raises(ValueError):
        wing_nut(**{**base, "collar_d": BOSS_D + 1.0})          # hub top wider than its base
    with pytest.raises(ValueError):
        wing_nut(**{**base, "collar_d": BORE})                  # wall too thin around bore
    with pytest.raises(ValueError):
        wing_nut(**{**base, "span": BOSS_D})                    # wings don't reach past the hub
    with pytest.raises(ValueError):
        wing_nut(**{**base, "height": BOSS_H})                  # wings don't rise above the hub
