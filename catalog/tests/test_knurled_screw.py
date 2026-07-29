import pytest
from build123d import Box, Pos

from catalog.models.knurled_screw import knurled_screw

# Synthetic fixture (NOT a real standard). Head d=20 (widest), tall head k=14, shank 8 x 30,
# top-rim chamfer 1.5. Head radius r=10; chamfer wall top at z=k-1.5=12.5, top face radius r-1.5=8.5.
KS = dict(d=20.0, k=14.0, d_shank=8.0, length=30.0, head_chamfer=1.5, tip_chamfer=1.0)


def _solid_at(part, x, y, z, probe=0.4):
    """True if the part has material in a small cube centered at (x, y, z). build123d ``intersect``
    returns None on empty overlap (do NOT use Box(mode=INTERSECT) inside a BuildPart)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_bounding_box_head_is_widest_and_height_spans_shank_to_head():
    part = knurled_screw(**KS)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(KS["d"], 1)         # round head (d) is the widest feature
    assert round(bb.size.Y, 1) == round(KS["d"], 1)
    assert round(bb.max.Z, 1) == round(KS["k"], 1)          # head top at head height k
    assert round(bb.min.Z, 1) == round(-KS["length"], 1)    # shank free end
    assert round(bb.size.Z, 1) == round(KS["length"] + KS["k"], 1)


def test_head_is_wider_than_the_shank_at_mid_head():
    part = knurled_screw(**KS)
    z = KS["k"] / 2.0                                        # mid-head, below the chamfer -> full radius
    r_head = KS["d"] / 2.0                                   # 10
    assert _solid_at(part, r_head - 0.6, 0.0, z)            # solid out to the head wall...
    assert not _solid_at(part, r_head + 0.6, 0.0, z)        # ...void just beyond it
    # radius 9 is well outside the shank (r_shank=4) but inside the head -> head-only material
    assert _solid_at(part, 9.0, 0.0, z)


def test_top_rim_is_chamfered_away():
    part = knurled_screw(**KS)
    r_head = KS["d"] / 2.0                                   # 10
    # The top outer corner (r_head, 0, k) is removed by the chamfer -> void there...
    assert not _solid_at(part, r_head - 0.2, 0.0, KS["k"] - 0.2)
    # ...but the wall is full-width just below the chamfer, and the top face is solid at the centre.
    assert _solid_at(part, r_head - 0.6, 0.0, KS["k"] - 2.0)   # z=12 < chamfer start (12.5): full wall
    assert _solid_at(part, 0.0, 0.0, KS["k"] - 0.2)           # centre of the top face


def test_shank_below_the_bearing_plane_and_nothing_above_the_head():
    part = knurled_screw(**KS)
    z = -5.0                                                # inside the shank
    r_shank = KS["d_shank"] / 2.0                           # 4
    assert _solid_at(part, r_shank - 0.6, 0.0, z)          # solid to the shank wall
    assert not _solid_at(part, r_shank + 0.6, 0.0, z)      # void beyond the shank
    assert not _solid_at(part, 0.0, 0.0, KS["k"] + 0.6)    # nothing above the head top


def test_single_fused_solid():
    part = knurled_screw(**KS)
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        knurled_screw(**{**KS, "d_shank": KS["d"]})           # shank not narrower than the head (d_shank == d)
    with pytest.raises(ValueError):
        knurled_screw(**{**KS, "head_chamfer": KS["d"]})      # head_chamfer >= head radius (d/2)
    with pytest.raises(ValueError):
        knurled_screw(**{**KS, "k": 3.0, "head_chamfer": 4.0})  # head_chamfer (4) >= head height (3)
    with pytest.raises(ValueError):
        knurled_screw(**{**KS, "k": 0.0})                     # non-positive dimension
