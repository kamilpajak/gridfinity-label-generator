import pytest
from build123d import Box, Pos, Compound

from catalog.models.eye_bolt import eye_bolt

# DIN 444 Type B M12 fixture (fasteners.eu + boltingspecialist.com tables)
D_SHANK = 12.0
LENGTH = 70.0
EYE_OD = 25.0      # d3, eye outer diameter
EYE_HOLE = 12.0    # d2, eye bore
EYE_T = 14.0       # s, eye width (extruded thickness along Y)
TIP_CHAMFER = 1.2

ZC = EYE_OD / 2.0  # ring center height: 12.5


def _part(**over):
    cfg = dict(d_shank=D_SHANK, length=LENGTH, eye_od=EYE_OD, eye_hole=EYE_HOLE,
               eye_t=EYE_T, tip_chamfer=TIP_CHAMFER)
    cfg.update(over)
    return eye_bolt(**cfg)


def _intersect(part, x, z, sx, sy, sz):
    """Part ∩ a box centered at (x, 0, z). build123d returns None when the overlap is empty."""
    return part.intersect(Pos(x, 0.0, z) * Box(sx, sy, sz))


def _has_material(part, x, z, probe=1.0):
    return _intersect(part, x, z, probe, probe, probe) is not None


def _solid_at(part, x, y, z, probe=0.4):
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_eye_above_bearing_plane_shank_below():
    part = _part()
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(EYE_OD, 1)     # ring width across X
    assert round(bb.size.Y, 1) == round(EYE_T, 1)      # eye width is widest along Y
    assert round(bb.max.Z, 1) == round(EYE_OD, 1)      # ring top at zc + eye_od/2 = eye_od
    assert round(bb.min.Z, 1) == round(-LENGTH, 1)     # shank free end at -length


def test_eye_hole_is_a_through_void_on_the_y_axis():
    part = _part()
    assert not _has_material(part, x=0.0, z=ZC)        # hole center (bore radius 6 >> probe)
    assert not _solid_at(part, 0.0, EYE_T / 2.0 - 0.4, ZC)   # void persists through the width


def test_ring_band_is_solid_around_the_hole():
    part = _part()
    band_mid = (EYE_OD / 2.0 + EYE_HOLE / 2.0) / 2.0   # 9.25: mid-wall of the annulus
    assert _solid_at(part, 0.0, 0.0, ZC + band_mid)    # band above the hole
    assert _solid_at(part, 0.0, 0.0, ZC - band_mid)    # band below the hole (over the neck)
    assert _solid_at(part, band_mid, 0.0, ZC)          # band beside the hole
    assert not _has_material(part, x=0.0, z=EYE_OD + 0.6)          # nothing above the ring
    assert not _has_material(part, x=EYE_OD / 2.0 + 0.7, z=ZC)     # nothing beyond the ring


def test_eye_width_reads_eye_t():
    col = _intersect(_part(), x=0.0, z=ZC + 9.25, sx=0.4, sy=50.0, sz=0.4)
    assert col is not None
    assert round(Compound(col).bounding_box().size.Y, 2) == round(EYE_T, 2)


def test_neck_bridges_ring_to_shank_at_d_shank_width():
    # just above the bearing plane the head is the d_shank-wide neck, not the full ring
    part = _part()
    assert _solid_at(part, D_SHANK / 2.0 - 0.5, 0.0, 0.5)          # inside the neck
    assert not _solid_at(part, D_SHANK / 2.0 + 0.6, 0.0, 0.5)      # void beyond the neck


def test_shank_below_bearing_plane_with_lead_chamfer():
    part = _part()
    r = D_SHANK / 2.0
    assert _solid_at(part, r - 0.6, 0.0, -LENGTH / 2.0)        # solid to the shank wall
    assert not _solid_at(part, r + 0.6, 0.0, -LENGTH / 2.0)    # void beyond the shank
    assert not _solid_at(part, r - 0.2, 0.0, -LENGTH + 0.2)    # 45-deg lead chamfer trims the corner
    assert not _solid_at(part, 0.0, 0.0, -LENGTH - 0.6)        # nothing below the tip


def test_shank_without_chamfer_is_flat_bottomed():
    part = _part(tip_chamfer=None)
    r = D_SHANK / 2.0
    assert _solid_at(part, r - 0.2, 0.0, -LENGTH + 0.2)        # corner intact (no lead chamfer)
    assert round(part.bounding_box().min.Z, 1) == round(-LENGTH, 1)


def test_single_fused_solid():
    part = _part()
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        _part(eye_t=0.0)                     # non-positive dim
    with pytest.raises(ValueError):
        _part(length=-1.0)                   # non-positive dim (shank param)
    with pytest.raises(ValueError):
        _part(eye_hole=EYE_OD)               # bore not smaller than the ring
    with pytest.raises(ValueError):
        _part(eye_od=D_SHANK)                # eye not wider than the shank
    with pytest.raises(ValueError):
        _part(tip_chamfer=D_SHANK)           # rejected by _screw_shank (chamfer >= radius)
