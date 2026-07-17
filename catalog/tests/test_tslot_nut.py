import pytest
from build123d import Box, Pos

from catalog.models.tslot_nut import tslot_nut

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
# Foot 22 wide x 8 tall at the bottom; neck 14 wide x 8 tall on top; 2mm top-corner chamfer.
# Length runs along Y. Foot band z in [0,8], neck band z in [8,16]. Bore radius 5 on the axis.
CFG = dict(length=20.0, foot_w=22.0, neck_w=14.0, foot_h=8.0, height=16.0, bore=10.0, chamfer=2.0)


def _solid_at(part, x, y, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = tslot_nut(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(CFG["foot_w"], 1)   # widest at the foot
    assert round(bb.size.Y, 1) == round(CFG["length"], 1)   # length along Y
    assert round(bb.size.Z, 1) == round(CFG["height"], 1)   # total height on Z
    assert part.volume > 0


def test_stepped_t_narrow_neck_over_wide_foot():
    # The defining feature: wide foot at the bottom, narrow neck above it.
    part = tslot_nut(**CFG)
    x_foot = CFG["foot_w"] / 2 - 0.6          # inside the foot corner (x ~10.4)
    z_foot = CFG["foot_h"] / 2                # mid foot band (z=4)
    assert _solid_at(part, x_foot, 0.0, z_foot, probe=0.6)   # solid: the wide foot
    z_neck = CFG["foot_h"] + (CFG["height"] - CFG["foot_h"]) / 2   # mid neck band (z=12)
    assert not _solid_at(part, x_foot, 0.0, z_neck, probe=0.6)     # void: neck is narrower than the foot


def test_neck_is_present():
    part = tslot_nut(**CFG)
    x_neck = CFG["neck_w"] / 2 - 1.0         # inside the neck (x=6), outside the bore (r=5)
    z_neck = CFG["foot_h"] + 2.0             # in the neck band (z=10)
    assert _solid_at(part, x_neck, 0.0, z_neck, probe=0.6)


def test_open_bore_through_the_block():
    part = tslot_nut(**CFG)
    assert not _solid_at(part, 0.0, 0.0, 1.0, probe=0.6)          # bore void near the bottom
    assert not _solid_at(part, 0.0, 0.0, CFG["height"] - 1.0, probe=0.6)   # and near the top
    assert _solid_at(part, CFG["neck_w"] / 2 - 1.0, 0.0, 10.0, probe=0.6)  # wall beside the bore
    solid = tslot_nut(**{**CFG, "bore": 0.4})
    assert part.volume < solid.volume                            # the bore removes real material


def test_top_corner_chamfer_is_cut():
    part = tslot_nut(**CFG)
    # Extreme top outer neck corner: with a 2mm 45-deg chamfer, x=6.5 at z=15.5 is cut away
    # (chamfer edge at z=15.5 is x = neck_w/2 - (chamfer - (height - z)) = 7 - 1.5 = 5.5).
    assert not _solid_at(part, CFG["neck_w"] / 2 - 0.5, 0.0, CFG["height"] - 0.5, probe=0.4)
    # Same nut without a chamfer: that corner is solid.
    square = tslot_nut(**{**CFG, "chamfer": None})
    assert _solid_at(square, CFG["neck_w"] / 2 - 0.5, 0.0, CFG["height"] - 0.5, probe=0.4)


def test_builds_at_a_valid_config():
    assert tslot_nut(**CFG).volume > 0
    assert tslot_nut(**{**CFG, "chamfer": None}).volume > 0     # plain (unchamfered) also builds


def test_tslot_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "foot_w": 0.0})                     # non-positive dim
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "neck_w": CFG["foot_w"]})           # neck not narrower than foot
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "foot_h": CFG["height"]})           # no neck remains
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "bore": CFG["neck_w"]})             # bore wall vs neck too thin
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "chamfer": 0.0})                    # non-positive chamfer
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "chamfer": CFG["neck_w"] / 2})      # chamfer exceeds half the neck width
    with pytest.raises(ValueError):
        tslot_nut(**{**CFG, "foot_h": 15.0, "chamfer": 1.5})    # chamfer (1.5) exceeds neck height (16-15=1)
