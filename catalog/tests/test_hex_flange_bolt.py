import math

import pytest
from build123d import Box, Pos

from catalog.models.hex_flange_bolt import hex_flange_bolt

# Synthetic fixture (NOT a real standard). Hex s=18 (across-corners ~20.78), flange dc=26 (wider),
# rim c=2, total head height k=13, shank 12 x 40. flange_top = c + (dc/2 - s/sqrt3)*tan(20deg) ~= 2.95.
HFB = dict(s=18.0, k=13.0, dc=26.0, c=2.0, d_shank=12.0, length=40.0, tip_chamfer=1.0)

_CIRCUMRADIUS = 18.0 / math.sqrt(3.0)                       # ~10.392 (hex across-corners / 2)
_FLANGE_TOP = 2.0 + (26.0 / 2.0 - _CIRCUMRADIUS) * math.tan(math.radians(20.0))   # ~2.95


def _solid_at(part, x, y, z, probe=0.4):
    """True if the part has material in a small cube centered at (x, y, z). build123d ``intersect``
    returns None on empty overlap (do NOT use Box(mode=INTERSECT) inside a BuildPart)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_bounding_box_flange_is_widest_and_height_spans_shank_to_head():
    part = hex_flange_bolt(**HFB)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(HFB["dc"], 1)       # round flange (dc) is the widest feature
    assert round(bb.size.Y, 1) == round(HFB["dc"], 1)
    assert round(bb.max.Z, 1) == round(HFB["k"], 1)         # hex top at total head height k
    assert round(bb.min.Z, 1) == round(-HFB["length"], 1)   # shank free end
    assert round(bb.size.Z, 1) == round(HFB["length"] + HFB["k"], 1)


def test_flange_is_wider_than_the_hex_at_the_bearing_plane():
    part = hex_flange_bolt(**HFB)
    z = 0.5                                                  # just above the bearing face, inside the rim (c=2)
    r_flange = HFB["dc"] / 2.0                               # 13
    assert _solid_at(part, r_flange - 0.6, 0.0, z)          # solid out to the flange rim...
    assert not _solid_at(part, r_flange + 0.6, 0.0, z)      # ...void just beyond it
    # radius 12 is outside the hex corner circle (~10.39) but inside the flange -> flange-only material
    assert _solid_at(part, 12.0, 0.0, z)


def test_hex_flats_and_corners_above_the_flange():
    part = hex_flange_bolt(**HFB)
    z = (_FLANGE_TOP + HFB["k"]) / 2.0                       # ~8, pure-hex region (above the flange)
    # vertex-up: a corner points along +X at the circumradius; the flats are on +/-Y at radius s/2.
    assert _solid_at(part, _CIRCUMRADIUS - 0.6, 0.0, z)     # solid to the corner on +X
    assert not _solid_at(part, _CIRCUMRADIUS + 0.6, 0.0, z) # void just past the corner
    half_flat = HFB["s"] / 2.0                              # 9
    assert _solid_at(part, 0.0, half_flat - 0.6, z)         # solid to the flat on +Y
    assert not _solid_at(part, 0.0, half_flat + 0.6, z)     # void past the flat (hexagon, not a disc)


def test_shank_below_the_bearing_plane_and_nothing_above_the_head():
    part = hex_flange_bolt(**HFB)
    z = -5.0                                                # inside the shank
    r_shank = HFB["d_shank"] / 2.0                          # 6
    assert _solid_at(part, r_shank - 0.6, 0.0, z)          # solid to the shank wall
    assert not _solid_at(part, r_shank + 0.6, 0.0, z)      # void beyond the shank
    assert not _solid_at(part, 0.0, 0.0, HFB["k"] + 0.6)   # nothing above the hex top


def test_single_fused_solid():
    part = hex_flange_bolt(**HFB)
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        hex_flange_bolt(**{**HFB, "d_shank": HFB["s"]})        # shank not narrower than the hex (d_shank == s)
    with pytest.raises(ValueError):
        hex_flange_bolt(**{**HFB, "dc": 20.0})                 # dc <= hex across-corners (~20.78) -> no flange
    with pytest.raises(ValueError):
        hex_flange_bolt(**{**HFB, "k": 2.0})                   # k below flange_top (~2.95) -> no hex left
    with pytest.raises(ValueError):
        hex_flange_bolt(**{**HFB, "c": 0.0})                   # non-positive dimension
