import pytest
from build123d import Box, Pos

from catalog.models.knurled_screw_high import knurled_screw_high

# DIN 464 M6 fixture (fasteners.eu DIN 464 + Aspen Fasteners DIN 464 PDF, identical M6 column):
# knurled head dk=24 x k=5 raised on a ds=12 collar; total head height h=15 -> collar_h=10.
# Head radius r=12, collar radius rc=6, head spans z in [10, 15]; chamfer wall top at z=14.5.
D = 24.0
K = 5.0
COLLAR_D = 12.0
COLLAR_H = 10.0
D_SHANK = 6.0
LENGTH = 20.0
HEAD_CHAMFER = 0.5
TIP_CHAMFER = 1.0
TOP = COLLAR_H + K                                       # 15.0, head top above the bearing plane


def _part(**over):
    cfg = dict(d=D, k=K, collar_d=COLLAR_D, collar_h=COLLAR_H, d_shank=D_SHANK,
               length=LENGTH, head_chamfer=HEAD_CHAMFER, tip_chamfer=TIP_CHAMFER)
    cfg.update(over)
    return knurled_screw_high(**cfg)


def _solid_at(part, x, y, z, probe=0.4):
    """True if the part has material in a small cube centered at (x, y, z). build123d
    ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT) in a BuildPart)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_bounding_box_head_is_widest_and_height_spans_shank_to_head():
    part = _part()
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(D, 1)            # round head (d) is the widest feature
    assert round(bb.size.Y, 1) == round(D, 1)
    assert round(bb.max.Z, 1) == round(TOP, 1)           # head top at collar_h + k
    assert round(bb.min.Z, 1) == round(-LENGTH, 1)       # shank free end
    assert round(bb.size.Z, 1) == round(LENGTH + TOP, 1)


def test_head_is_raised_and_wider_than_the_collar():
    part = _part()
    z = COLLAR_H + K / 2.0                               # mid-head (12.5), below the rim chamfer
    r_head = D / 2.0                                     # 12
    assert _solid_at(part, r_head - 0.6, 0.0, z)         # solid out to the head wall...
    assert not _solid_at(part, r_head + 0.6, 0.0, z)     # ...void just beyond it
    # radius 9 is outside the collar (rc=6) but inside the head -> head-only material
    assert _solid_at(part, 9.0, 0.0, z)


def test_collar_is_the_reduced_step_the_low_form_lacks():
    # THE high-form feature: between bearing plane and head bottom the envelope necks down
    # to collar_d — DIN 653 (knurled_screw) is full head diameter all the way down instead.
    part = _part()
    z = COLLAR_H / 2.0                                   # mid-collar (5.0)
    rc = COLLAR_D / 2.0                                  # 6
    assert _solid_at(part, rc - 0.6, 0.0, z)             # solid out to the collar wall...
    assert not _solid_at(part, rc + 0.6, 0.0, z)         # ...void just beyond it
    assert not _solid_at(part, 9.0, 0.0, z)              # void under the head overhang


def test_under_head_step_sits_at_collar_h():
    part = _part()
    x = 9.0                                              # between collar radius 6 and head radius 12
    assert _solid_at(part, x, 0.0, COLLAR_H + 0.5)       # just above the step: head material
    assert not _solid_at(part, x, 0.0, COLLAR_H - 0.5)   # just below the step: collar void


def test_top_rim_is_chamfered_away():
    part = _part()
    r_head = D / 2.0                                     # 12
    # Chamfer removes the corner beyond x + z = r + TOP - hc = 26.5; probe (11.9, 14.9) with a
    # small cube stays 0.15 clear of that plane -> void there...
    assert not _solid_at(part, r_head - 0.1, 0.0, TOP - 0.1, probe=0.15)
    # ...but the wall is full-width below the chamfer start (z=14.5), and the top face is solid.
    assert _solid_at(part, r_head - 0.3, 0.0, TOP - 1.0)   # z=14 < 14.5: full wall
    assert _solid_at(part, 0.0, 0.0, TOP - 0.2)            # centre of the top face


def test_head_without_chamfer_keeps_the_top_corner():
    part = _part(head_chamfer=None)
    r_head = D / 2.0
    assert _solid_at(part, r_head - 0.2, 0.0, TOP - 0.2)   # top rim corner intact
    assert round(part.bounding_box().max.Z, 1) == round(TOP, 1)


def test_shank_below_the_bearing_plane_with_lead_chamfer():
    part = _part()
    r = D_SHANK / 2.0                                    # 3
    assert _solid_at(part, r - 0.6, 0.0, -LENGTH / 2.0)      # solid to the shank wall
    assert not _solid_at(part, r + 0.6, 0.0, -LENGTH / 2.0)  # void beyond the shank
    assert not _solid_at(part, r - 0.2, 0.0, -LENGTH + 0.2)  # 45-deg lead chamfer trims the corner
    assert not _solid_at(part, 0.0, 0.0, -LENGTH - 0.6)      # nothing below the tip
    assert not _solid_at(part, 0.0, 0.0, TOP + 0.6)          # nothing above the head top


def test_shank_without_chamfer_is_flat_bottomed():
    part = _part(tip_chamfer=None)
    r = D_SHANK / 2.0
    assert _solid_at(part, r - 0.2, 0.0, -LENGTH + 0.2)      # corner intact (no lead chamfer)
    assert round(part.bounding_box().min.Z, 1) == round(-LENGTH, 1)


def test_single_fused_solid():
    part = _part()
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        _part(k=0.0)                         # non-positive dim
    with pytest.raises(ValueError):
        _part(length=-1.0)                   # non-positive dim (shank param)
    with pytest.raises(ValueError):
        _part(collar_d=D)                    # collar not narrower than the head
    with pytest.raises(ValueError):
        _part(d_shank=COLLAR_D)              # shank not narrower than the collar
    with pytest.raises(ValueError):
        _part(head_chamfer=0.0)              # head_chamfer must be > 0 (None disables it)
    with pytest.raises(ValueError):
        _part(head_chamfer=D / 2.0)          # head_chamfer >= head radius
    with pytest.raises(ValueError):
        _part(head_chamfer=K)                # head_chamfer >= knurled head height
    with pytest.raises(ValueError):
        _part(tip_chamfer=D_SHANK)           # rejected by _screw_shank (chamfer >= radius)
