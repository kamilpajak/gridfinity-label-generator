import math

import pytest
from build123d import Box, Pos

from catalog.models.hex_bolt import hex_bolt

# Synthetic fixture (NOT a real standard): across-flats 18, head 8 tall, shank dia 12 x 30 long,
# 2mm lead chamfer, no head chamfer. Head z in [0,8] vertex-up; shank z in [-30,0].
CFG = dict(s=18.0, k=8.0, length=30.0, d_shank=12.0, head_chamfer=None, tip_chamfer=2.0)
CIRCUMR = CFG["s"] / math.sqrt(3.0)        # 10.39: hex corner radius (across-corners / 2)


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = hex_bolt(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["k"] + CFG["length"], 1)   # head + shank along Z
    assert round(bb.size.X, 1) == round(2 * CIRCUMR, 1)                # head across-corners on X
    assert round(bb.max.Z, 1) == round(CFG["k"], 1)                    # head top
    assert round(bb.min.Z, 1) == round(-CFG["length"], 1)             # shank free end
    assert part.volume > 0


def test_hex_head_present():
    # Vertex-up head reaches the corner radius on +X in the head band; a plain cylinder head
    # (radius s/2 = 9) would not — discriminates the hexagon.
    part = hex_bolt(**CFG)
    z = CFG["k"] / 2.0
    assert _solid_at(part, CIRCUMR - 0.4, 0.0, z, probe=0.3)          # solid out to the corner
    assert not _solid_at(part, CIRCUMR + 0.4, 0.0, z, probe=0.3)      # void beyond the corner


def test_shank_narrower_than_head():
    part = hex_bolt(**CFG)
    r = CFG["d_shank"] / 2.0                                          # 6
    z_shank = -CFG["length"] / 2.0
    assert _solid_at(part, r - 0.5, 0.0, z_shank, probe=0.4)          # shank solid to its wall
    assert not _solid_at(part, r + 0.5, 0.0, z_shank, probe=0.4)      # void just beyond the shank
    # A head-band radius (8, inside the head corners) is solid in the head but void in the shank.
    assert _solid_at(part, 8.0, 0.0, CFG["k"] / 2.0, probe=0.4)
    assert not _solid_at(part, 8.0, 0.0, z_shank, probe=0.4)


def test_solid_core_no_bore():
    part = hex_bolt(**CFG)
    assert _solid_at(part, 0.0, 0.0, CFG["k"] / 2.0, probe=0.6)       # solid on axis in the head
    assert _solid_at(part, 0.0, 0.0, -CFG["length"] / 2.0, probe=0.6) # solid on axis in the shank


def test_tip_chamfer_is_cut():
    part = hex_bolt(**CFG)
    r = CFG["d_shank"] / 2.0
    assert not _solid_at(part, r - 0.3, 0.0, -CFG["length"] + 0.3, probe=0.3)   # corner bevelled
    square = hex_bolt(**{**CFG, "tip_chamfer": None})
    assert _solid_at(square, r - 0.3, 0.0, -CFG["length"] + 0.3, probe=0.3)     # corner solid


def test_builds_at_valid_config():
    assert hex_bolt(**CFG).volume > 0
    assert hex_bolt(**{**CFG, "tip_chamfer": None}).volume > 0        # plain end also builds


def test_hex_bolt_guards():
    with pytest.raises(ValueError):
        hex_bolt(**{**CFG, "s": 0.0})                                 # non-positive dim
    with pytest.raises(ValueError):
        hex_bolt(**{**CFG, "length": 0.0})                           # non-positive dim
    with pytest.raises(ValueError):
        hex_bolt(**{**CFG, "d_shank": CFG["s"]})                     # shank not narrower than head
    with pytest.raises(ValueError):
        hex_bolt(**{**CFG, "tip_chamfer": CFG["d_shank"] / 2})       # lead chamfer >= shank radius
