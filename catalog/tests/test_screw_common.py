import pytest
from build123d import Box, Pos

from catalog.models.screw_common import _screw_shank

# Synthetic fixture (NOT a real standard): a 12-dia shank, 30 long, 2mm lead chamfer.
CFG = dict(d=12.0, length=30.0, tip_chamfer=2.0)


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_shank_extents():
    part = _screw_shank(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["length"], 1)     # axial length along Z
    assert round(bb.size.X, 1) == round(CFG["d"], 1)          # diameter across
    assert round(bb.max.Z, 1) == 0.0                          # top face on z=0
    assert round(bb.min.Z, 1) == round(-CFG["length"], 1)     # extends down to -length
    assert part.volume > 0


def test_shank_is_round_solid_core():
    part = _screw_shank(**CFG)
    r = CFG["d"] / 2.0
    z = -CFG["length"] / 2.0                                  # mid-shank
    assert _solid_at(part, 0.0, 0.0, z, probe=0.6)            # solid on the axis
    assert _solid_at(part, r - 0.5, 0.0, z, probe=0.4)        # solid to near the wall
    assert not _solid_at(part, r + 0.5, 0.0, z, probe=0.4)    # void just beyond the wall


def test_tip_chamfer_is_cut():
    part = _screw_shank(**CFG)
    r = CFG["d"] / 2.0
    # With a 2mm 45-deg lead chamfer, the extreme free-end outer corner is bevelled away:
    # the chamfer runs (r, -(length-c)) -> (r-c, -length); at z=-29.7 material reaches r=4.3.
    assert not _solid_at(part, r - 0.3, 0.0, -CFG["length"] + 0.3, probe=0.3)
    # Same shank without a chamfer: that corner is solid.
    square = _screw_shank(CFG["d"], CFG["length"], tip_chamfer=None)
    assert _solid_at(square, r - 0.3, 0.0, -CFG["length"] + 0.3, probe=0.3)


def test_shank_guards():
    with pytest.raises(ValueError):
        _screw_shank(0.0, 30.0)                               # non-positive diameter
    with pytest.raises(ValueError):
        _screw_shank(12.0, 0.0)                               # non-positive length
    with pytest.raises(ValueError):
        _screw_shank(12.0, 30.0, tip_chamfer=0.0)             # non-positive chamfer
    with pytest.raises(ValueError):
        _screw_shank(12.0, 30.0, tip_chamfer=6.0)             # chamfer >= radius
    with pytest.raises(ValueError):
        _screw_shank(12.0, 1.0, tip_chamfer=2.0)              # chamfer >= length
