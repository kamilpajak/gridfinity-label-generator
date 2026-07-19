import math

import pytest
from build123d import Box, Pos

from catalog.models.socket_screw import socket_screw

# Synthetic fixtures (NOT real standards): head dia 18 x 12 tall, shank dia 12 x 30 long,
# hex socket across-flats 10, socket depth 6, 1.5mm lead chamfer. Head z in [0,12]; shank z in
# [-30,0]; socket cut from the top face z=12 down to z=6.
HEX = dict(dk=18.0, k=12.0, length=30.0, d_shank=12.0, drive="hex",
           socket_af=10.0, socket_depth=6.0, tip_chamfer=1.5)
LOB = {**HEX, "drive": "lobular"}


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = socket_screw(**HEX)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(HEX["k"] + HEX["length"], 1)   # head + shank along Z
    assert round(bb.size.X, 1) == round(HEX["dk"], 1)                  # head diameter on X
    assert round(bb.max.Z, 1) == round(HEX["k"], 1)                    # head top face
    assert round(bb.min.Z, 1) == round(-HEX["length"], 1)             # shank free end
    assert part.volume > 0


def test_cylindrical_head_present():
    # The head is a plain cylinder of radius dk/2 = 9: solid just inside the rim, void just
    # outside it, at a z below the socket floor (z=3, inside the solid head band).
    part = socket_screw(**HEX)
    r = HEX["dk"] / 2.0
    assert _solid_at(part, r - 0.5, 0.0, 3.0, probe=0.3)              # solid to the head rim
    assert not _solid_at(part, r + 0.5, 0.0, 3.0, probe=0.3)          # void beyond the rim


def test_shank_narrower_than_head():
    part = socket_screw(**HEX)
    r = HEX["d_shank"] / 2.0                                          # 6
    z_shank = -HEX["length"] / 2.0
    assert _solid_at(part, r - 0.5, 0.0, z_shank, probe=0.4)          # shank solid to its wall
    assert not _solid_at(part, r + 0.5, 0.0, z_shank, probe=0.4)      # void just beyond the shank
    # A head-band radius (8, inside the head rim) is solid in the head but void in the shank.
    assert _solid_at(part, 8.0, 0.0, 3.0, probe=0.4)
    assert not _solid_at(part, 8.0, 0.0, z_shank, probe=0.4)


def test_socket_is_blind_and_opens_from_the_top():
    # Void on the axis just below the top face (inside the socket); solid on the axis just below
    # the socket floor (the socket does NOT go through — a floor of head metal remains).
    part = socket_screw(**HEX)
    top = HEX["k"]                                                    # 12
    floor = HEX["k"] - HEX["socket_depth"]                            # 6
    assert not _solid_at(part, 0.0, 0.0, top - 0.4, probe=0.3)        # void inside the socket
    assert _solid_at(part, 0.0, 0.0, floor - 0.4, probe=0.3)          # solid floor below it
    assert _solid_at(part, 0.0, 0.0, -HEX["length"] / 2.0, probe=0.6) # solid core in the shank


def test_hex_and_lobular_recesses_differ():
    # Same head/shank/socket size, different drive -> the two sockets remove different amounts of
    # metal, so the finished screws have different volumes (rotation-independent discriminator).
    vh = socket_screw(**HEX).volume
    vl = socket_screw(**LOB).volume
    assert abs(vh - vl) > 0.5
    # And the lobular build is a single fused solid too.
    assert socket_screw(**LOB).volume > 0


def test_head_and_shank_fuse_into_one_solid():
    # Head (z in [0,k]) and shank (z in [-length,0]) share only the z=0 plane; they must FUSE
    # into a single solid, not leave a compound.
    assert len(socket_screw(**HEX).solids()) == 1
    assert len(socket_screw(**LOB).solids()) == 1
    assert len(socket_screw(**{**HEX, "tip_chamfer": None}).solids()) == 1


def test_tip_chamfer_is_cut():
    part = socket_screw(**HEX)
    r = HEX["d_shank"] / 2.0
    assert not _solid_at(part, r - 0.3, 0.0, -HEX["length"] + 0.3, probe=0.3)   # corner bevelled
    square = socket_screw(**{**HEX, "tip_chamfer": None})
    assert _solid_at(square, r - 0.3, 0.0, -HEX["length"] + 0.3, probe=0.3)     # corner solid


def test_builds_at_valid_configs():
    assert socket_screw(**HEX).volume > 0
    assert socket_screw(**LOB).volume > 0
    assert socket_screw(**{**HEX, "tip_chamfer": None}).volume > 0    # plain end also builds


def test_socket_screw_guards():
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "dk": 0.0})                           # non-positive dim
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "socket_depth": 0.0})                 # non-positive dim
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "drive": "torx"})                     # unknown drive
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "d_shank": HEX["dk"]})                # shank not narrower than head
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "socket_af": HEX["dk"]})              # socket wider than the head face
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "socket_depth": HEX["k"]})            # socket not blind (>= head height)
    with pytest.raises(ValueError):
        socket_screw(**{**LOB, "socket_af": HEX["dk"]})              # lobular socket too wide too
