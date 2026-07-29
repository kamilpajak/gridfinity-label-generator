import pytest
from build123d import Box, Pos, Compound

from catalog.models.wing_screw import wing_screw

# DIN 316 M12 fixture (German form, rounded wings); head envelope == DIN 315 M12
D_SHANK = 12.0
LENGTH = 30.0
BOSS_D = 23.0
COLLAR_D = 19.5
BOSS_H = 14.0
SPAN = 65.0
HEIGHT = 33.5
WING_T = 4.9
TIP_CHAMFER = 1.2


def _part(**over):
    cfg = dict(d_shank=D_SHANK, length=LENGTH, boss_d=BOSS_D, collar_d=COLLAR_D,
               boss_h=BOSS_H, span=SPAN, height=HEIGHT, wing_t=WING_T,
               tip_chamfer=TIP_CHAMFER)
    cfg.update(over)
    return wing_screw(**cfg)


def _intersect(part, x, z, sx, sy, sz):
    """Part ∩ a box centered at (x, 0, z). build123d returns None when the overlap is empty."""
    return part.intersect(Pos(x, 0.0, z) * Box(sx, sy, sz))


def _has_material(part, x, z, probe=1.0):
    return _intersect(part, x, z, probe, probe, probe) is not None


def _solid_at(part, x, y, z, probe=0.4):
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_head_above_bearing_plane_shank_below():
    part = _part()
    bb = part.bounding_box()
    assert SPAN - 1.0 <= bb.size.X <= SPAN + 0.05      # wing tips ~ span (ear fillet trims a hair)
    assert round(bb.size.Y, 1) == round(BOSS_D, 1)     # hub base diameter is widest along Y
    assert HEIGHT - 0.5 <= bb.max.Z <= HEIGHT + 0.05   # wing top ~ height above z=0
    assert round(bb.min.Z, 1) == round(-LENGTH, 1)     # shank free end at -length


def test_hub_tapers_from_boss_d_to_collar_d():
    # probe at radius ~10.4 (between collar_d/2=9.75 and boss_d/2=11.5), offset in Y clear of
    # the wing blades: solid at the hub base, empty near the hub top (same probe as wing_nut).
    part = _part()
    x, y = 10.0, 3.0
    assert _solid_at(part, x, y, 0.5)
    assert not _solid_at(part, x, y, BOSS_H - 0.5)


def test_no_bore_hub_center_is_solid():
    # the single structural difference from wing_nut: the screw hub has no through bore
    part = _part()
    assert _solid_at(part, 0.0, 0.0, 0.5)
    assert _solid_at(part, 0.0, 0.0, BOSS_H - 0.5)


def test_wing_blade_thickness_reads_wing_t():
    col = _intersect(_part(), x=0.60 * SPAN / 2.0, z=0.72 * HEIGHT, sx=0.4, sy=50.0, sz=0.4)
    assert col is not None
    assert round(Compound(col).bounding_box().size.Y, 2) == round(WING_T, 2)


def test_two_wings_spread_into_a_v_notch():
    part = _part()
    assert _has_material(part, x=0.60 * SPAN / 2.0, z=0.72 * HEIGHT)   # over an ear: material
    assert not _has_material(part, x=0.0, z=0.85 * HEIGHT)            # V opening at the top center


def test_shank_below_bearing_plane_with_lead_chamfer():
    part = _part()
    r = D_SHANK / 2.0
    assert _solid_at(part, r - 0.6, 0.0, -LENGTH / 2.0)        # solid to the shank wall
    assert not _solid_at(part, r + 0.6, 0.0, -LENGTH / 2.0)    # void beyond the shank
    assert not _solid_at(part, r - 0.2, 0.0, -LENGTH + 0.2)    # 45-deg lead chamfer trims the corner
    assert not _solid_at(part, 0.0, 0.0, -LENGTH - 0.6)        # nothing below the tip


def test_single_fused_solid():
    part = _part()
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        _part(wing_t=0.0)                    # non-positive dim
    with pytest.raises(ValueError):
        _part(length=-1.0)                   # non-positive dim (shank param)
    with pytest.raises(ValueError):
        _part(collar_d=BOSS_D + 1.0)         # hub top wider than its base
    with pytest.raises(ValueError):
        _part(d_shank=BOSS_D)                # shank not narrower than the hub
    with pytest.raises(ValueError):
        _part(span=BOSS_D)                   # wings don't reach past the hub
    with pytest.raises(ValueError):
        _part(height=BOSS_H)                 # wings don't rise above the hub
    with pytest.raises(ValueError):
        _part(tip_chamfer=D_SHANK)           # rejected by _screw_shank (chamfer >= radius)
