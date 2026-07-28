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


def test_hex_wall_guard_accounts_for_socket_corners():
    # socket_af=16 with dk=18: hex corners reach 16/sqrt(3)=9.24 > head radius 9.0 -> must raise
    # for hex, but the lobular tips only reach 8.0 < 9.0 -> lobular still builds. This is the
    # drive-aware wall guard (the old across-flats-only guard wrongly passed hex here).
    with pytest.raises(ValueError):
        socket_screw(**{**HEX, "socket_af": 16.0})
    assert socket_screw(**{**LOB, "socket_af": 16.0}).volume > 0


# Synthetic fixtures (NOT real standards) for the two new head shapes. Same shank/socket as HEX;
# head dia 20 x 8 tall so the cone/dome geometry is clearly non-cylindrical.
CSK = dict(dk=20.0, k=8.0, length=30.0, d_shank=10.0, drive="hex",
           socket_af=8.0, socket_depth=4.0, tip_chamfer=1.5, head="countersunk")
BTN = {**CSK, "head": "button"}


def test_countersunk_head_widens_upward_to_a_flat_top():
    # A countersunk cone is widest at its flat top face (z=k) and narrows downward toward the
    # shank. Probe near the rim: solid high up, void just beyond the rim, void low down.
    part = socket_screw(**CSK)
    r_near_rim = CSK["dk"] / 2.0 - 0.6          # 9.4, just inside the top rim
    top_z = CSK["k"]                            # 8
    assert _solid_at(part, r_near_rim, 0.0, top_z - 0.3, probe=0.3)      # solid at the wide top
    assert not _solid_at(part, CSK["dk"] / 2.0 + 0.6, 0.0, top_z - 0.3, probe=0.3)  # void past rim
    assert not _solid_at(part, r_near_rim, 0.0, 0.3, probe=0.3)          # cone narrow near the base


def test_button_head_domes_over_the_axis():
    # A button head is a spherical dome: tall near the axis, sloping down to the rim. Near the rim
    # the dome surface is low, so material does NOT reach the top; and the socket is blind (a floor
    # of head metal remains below it on the axis).
    part = socket_screw(**BTN)
    r_near_rim = BTN["dk"] / 2.0 - 0.6          # 9.4
    top_z = BTN["k"]                            # 8
    assert not _solid_at(part, r_near_rim, 0.0, top_z - 0.5, probe=0.3)  # dome sloped down at rim
    assert _solid_at(part, r_near_rim, 0.0, 0.3, probe=0.3)             # but solid low down there
    floor = BTN["k"] - BTN["socket_depth"]      # 4
    assert _solid_at(part, 0.0, 0.0, floor - 0.4, probe=0.3)            # blind socket floor on axis


def test_new_heads_have_a_blind_hex_socket_from_the_top():
    # Both new heads carry the hex drive socket: void on the axis just below the top face.
    for fx in (CSK, BTN):
        part = socket_screw(**fx)
        assert not _solid_at(part, 0.0, 0.0, fx["k"] - 0.4, probe=0.3)   # socket void at the top


def test_new_heads_fuse_into_one_solid():
    assert len(socket_screw(**CSK).solids()) == 1
    assert len(socket_screw(**BTN).solids()) == 1
    assert socket_screw(**CSK).volume > 0
    assert socket_screw(**BTN).volume > 0


def test_default_head_is_cylindrical_and_unchanged():
    # Omitting head must reproduce the existing cylindrical head exactly (regression guard for the
    # byte-identical invariant): same volume as an explicit head="cylindrical".
    implicit = socket_screw(**HEX)
    explicit = socket_screw(**{**HEX, "head": "cylindrical"})
    assert implicit.volume == explicit.volume


def test_guard_bad_head():
    with pytest.raises(ValueError):
        socket_screw(**{**CSK, "head": "flat"})


def test_wall_guard_uses_the_tapered_head_radius_at_the_socket_floor():
    # A socket that fits within the flat TOP circle (dk/2) but is too wide for the narrower head
    # radius at the socket floor must be rejected for the tapered heads (it would pierce the wall).
    # socket_af=15 -> hex outer radius 15/sqrt(3)=8.66: below dk/2-0.1=9.9 (clears the top circle) but
    # the countersunk cone radius at floor_z=4 is 7.5 and the button dome radius there is ~8.12, so
    # 8.66 breaches both tapered walls.
    with pytest.raises(ValueError):
        socket_screw(**{**CSK, "socket_af": 15.0})
    with pytest.raises(ValueError):
        socket_screw(**{**BTN, "socket_af": 15.0})
    # The SAME socket on a cylindrical head of the same dk (constant radius dk/2=10) still builds —
    # the guard must be head-shape-aware, not over-rejecting the untapered head.
    assert socket_screw(**{**CSK, "head": "cylindrical", "socket_af": 15.0}).volume > 0
