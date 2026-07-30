import pytest
from build123d import Box, Pos

from catalog.models.t_head_bolt import t_head_bolt

# DIN 186 M12 fixture (T-head bolt with square neck): head m=26 x n=12 x k=8,
# square neck 12 x 12 (flush with the head width), neck height 8 (representative).
DIN186 = dict(d_shank=12.0, length=60.0, head_l=26.0, head_w=12.0, head_h=8.0,
              neck_w=12.0, neck_h=8.0, tip_chamfer=1.0)
# DIN 787 M12 fixture (T-slot bolt for the 14 mm slot): head e=22 x a=13.7 x k=8, no neck.
DIN787 = dict(d_shank=12.0, length=80.0, head_l=22.0, head_w=13.7, head_h=8.0,
              tip_chamfer=1.0)


def _solid_at(part, x, y, z, probe=0.4):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_with_square_neck():
    part = t_head_bolt(**DIN186)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(DIN186["head_l"], 1)     # head long axis is widest in X
    assert round(bb.size.Y, 1) == round(DIN186["head_w"], 1)     # head width (= square = shank dia)
    top = DIN186["neck_h"] + DIN186["head_h"]
    assert round(bb.max.Z, 1) == round(top, 1)                   # neck + head above the bearing plane
    assert round(bb.min.Z, 1) == round(-DIN186["length"], 1)     # shank free end at -length


def test_envelope_without_neck():
    part = t_head_bolt(**DIN787)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(DIN787["head_l"], 1)     # e spans the slot undercut
    assert round(bb.size.Y, 1) == round(DIN787["head_w"], 1)     # a = drop-in width (13.7 > d 12)
    assert round(bb.max.Z, 1) == round(DIN787["head_h"], 1)      # head sits straight on z=0
    assert round(bb.min.Z, 1) == round(-DIN787["length"], 1)


def test_head_overhangs_along_the_long_axis_only():
    part = t_head_bolt(**DIN186)
    z_head = DIN186["neck_h"] + DIN186["head_h"] / 2.0           # mid-head band, z=12
    x_edge = DIN186["head_l"] / 2.0                              # 13.0
    y_edge = DIN186["head_w"] / 2.0                              # 6.0
    assert _solid_at(part, x_edge - 0.8, 0.0, z_head)            # solid out to the T ear
    assert not _solid_at(part, x_edge + 0.8, 0.0, z_head)        # void beyond the T ear
    assert _solid_at(part, 0.0, y_edge - 0.8, z_head)            # solid inside the head width
    assert not _solid_at(part, 0.0, y_edge + 0.8, z_head)        # void beyond the head width


def test_square_neck_band_between_head_and_shank():
    # The square's corner region (5.5, 5.5) lies inside the 12x12 square (|x|,|y| <= 6) but at
    # radius ~7.78, outside the round shank (r=6): material there exists ONLY in the neck band.
    part = t_head_bolt(**DIN186)
    z_neck = DIN186["neck_h"] / 2.0                              # mid-neck, z=4
    assert _solid_at(part, 5.5, 5.5, z_neck)                     # square corner: solid in the neck
    assert not _solid_at(part, 5.5, 5.5, -5.0)                   # same (x, y) on the round shank: void
    assert not _solid_at(part, 8.0, 0.0, z_neck)                 # beyond the square flat: void
    assert _solid_at(part, 8.0, 0.0, DIN186["neck_h"] + 1.0)     # head overhangs the neck along X


def test_no_neck_head_seats_on_the_bearing_plane():
    part = t_head_bolt(**DIN787)
    assert _solid_at(part, 9.0, 0.0, 0.5)                        # head material just above z=0
    assert not _solid_at(part, 9.0, 0.0, -0.5)                   # no neck: void below the head ear
    assert _solid_at(part, 0.0, 6.3, 0.5)                        # head wider than the shank (6.3 > r=6)
    assert not _solid_at(part, 0.0, 6.3, -5.0)                   # ... but the shank band is round


def test_shank_below_bearing_plane_with_lead_chamfer():
    part = t_head_bolt(**DIN186)
    r = DIN186["d_shank"] / 2.0
    L = DIN186["length"]
    assert _solid_at(part, r - 0.6, 0.0, -L / 2.0)               # solid to the shank wall
    assert not _solid_at(part, r + 0.6, 0.0, -L / 2.0)           # void beyond the shank
    assert not _solid_at(part, r - 0.2, 0.0, -L + 0.2)           # 45-deg lead chamfer trims the corner
    assert not _solid_at(part, 0.0, 0.0, -L - 0.6)               # nothing below the tip


def test_shank_without_chamfer_is_flat_bottomed():
    part = t_head_bolt(**{**DIN186, "tip_chamfer": None})
    r = DIN186["d_shank"] / 2.0
    L = DIN186["length"]
    assert _solid_at(part, r - 0.2, 0.0, -L + 0.2)               # corner intact (no lead chamfer)
    assert round(part.bounding_box().min.Z, 1) == round(-L, 1)


def test_single_fused_solid_both_forms():
    for cfg in (DIN186, DIN787):
        part = t_head_bolt(**cfg)
        assert len(part.solids()) == 1
        assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        t_head_bolt(**{**DIN186, "head_h": 0.0})                 # non-positive dim
    with pytest.raises(ValueError):
        t_head_bolt(**{**DIN186, "length": -1.0})                # non-positive dim (shank param)
    with pytest.raises(ValueError):
        t_head_bolt(**{**DIN186, "head_l": 10.0})                # head_l < head_w: T axis flipped
    with pytest.raises(ValueError):
        t_head_bolt(**{**DIN787, "head_w": 11.0})                # head narrower than the shank
    with pytest.raises(ValueError):
        t_head_bolt(**{**DIN186, "neck_h": None})                # neck_w without neck_h
    with pytest.raises(ValueError):
        t_head_bolt(**{**DIN186, "neck_w": 0.0})                 # non-positive neck dim
    with pytest.raises(ValueError):
        t_head_bolt(**{**DIN186, "neck_w": 11.0})                # neck narrower than the shank
    with pytest.raises(ValueError):
        t_head_bolt(**{**DIN186, "neck_w": 13.0})                # neck sticks out past the head width
    with pytest.raises(ValueError):
        t_head_bolt(**{**DIN186, "tip_chamfer": 12.0})           # rejected by _screw_shank (>= radius)
