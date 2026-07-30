import pytest
from build123d import Box, Pos

from catalog.models.shoulder_screw import shoulder_screw

# ISO 7379 fixture: shoulder 12 (the designating diameter) with its M10 thread envelope
DK = 18.0
K = 8.9
D_SHOULDER = 12.0
SHOULDER_LEN = 30.0
D_THREAD = 10.0
THREAD_LEN = 16.0
SOCKET_AF = 6.0
SOCKET_DEPTH = 4.9
TIP_CHAMFER = 1.2
TIP_Z = -(SHOULDER_LEN + THREAD_LEN)             # -46.0, the free end of the thread envelope


def _part(**over):
    cfg = dict(dk=DK, k=K, d_shoulder=D_SHOULDER, shoulder_len=SHOULDER_LEN,
               d_thread=D_THREAD, thread_len=THREAD_LEN, socket_af=SOCKET_AF,
               socket_depth=SOCKET_DEPTH, tip_chamfer=TIP_CHAMFER)
    cfg.update(over)
    return shoulder_screw(**cfg)


def _solid_at(part, x, y, z, probe=0.4):
    """Part ∩ a small box at (x, y, z). build123d returns None when the overlap is empty."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_head_above_bearing_plane_body_below():
    part = _part()
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(DK, 1)         # head is the widest diameter (X)
    assert round(bb.size.Y, 1) == round(DK, 1)         # ... and axisymmetric (Y)
    assert round(bb.max.Z, 1) == round(K, 1)           # head top at z=k
    assert round(bb.min.Z, 1) == round(TIP_Z, 1)       # thread free end at -(shoulder+thread)


def test_blind_hex_socket_in_head_top():
    part = _part()
    assert not _solid_at(part, 0.0, 0.0, K - 0.3)                  # inside the socket: void
    assert _solid_at(part, 0.0, 0.0, K - SOCKET_DEPTH - 0.5)       # below the socket floor: solid
    # radial wall beyond the hex circumradius (6/sqrt(3)=3.46) but inside the head (r=9)
    assert _solid_at(part, 4.2, 0.0, K - 0.3)


def test_head_overhangs_the_shoulder():
    part = _part()
    x = (D_SHOULDER + DK) / 4.0                        # 7.5: between shoulder r=6 and head r=9
    assert _solid_at(part, x, 0.0, K / 2.0)            # inside the head band
    assert not _solid_at(part, x, 0.0, -1.0)           # below the bearing plane: overhang is air


def test_shoulder_cylinder_reads_d_shoulder():
    part = _part()
    r = D_SHOULDER / 2.0
    z = -SHOULDER_LEN / 2.0
    assert _solid_at(part, r - 0.6, 0.0, z)            # solid up to the shoulder wall
    assert not _solid_at(part, r + 0.6, 0.0, z)        # void beyond it


def test_thread_envelope_is_reduced_below_the_shoulder():
    # the defining ISO 7379 step: shoulder d=12 -> M10 thread envelope d=10
    part = _part()
    z = -SHOULDER_LEN - 1.0
    assert _solid_at(part, D_THREAD / 2.0 - 0.6, 0.0, z)       # inside the thread envelope
    assert not _solid_at(part, D_THREAD / 2.0 + 0.6, 0.0, z)   # between thread r=5 and shoulder r=6


def test_thread_tip_lead_chamfer():
    part = _part()
    r = D_THREAD / 2.0
    assert not _solid_at(part, r - 0.2, 0.0, TIP_Z + 0.2)      # 45-deg lead trims the corner
    assert not _solid_at(part, 0.0, 0.0, TIP_Z - 0.6)          # nothing below the tip


def test_thread_without_chamfer_is_flat_bottomed():
    part = _part(tip_chamfer=None)
    assert _solid_at(part, D_THREAD / 2.0 - 0.2, 0.0, TIP_Z + 0.2)   # corner intact
    assert round(part.bounding_box().min.Z, 1) == round(TIP_Z, 1)


def test_single_fused_solid():
    part = _part()
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        _part(dk=0.0)                        # non-positive dim
    with pytest.raises(ValueError):
        _part(thread_len=-1.0)               # non-positive dim
    with pytest.raises(ValueError):
        _part(d_thread=D_SHOULDER)           # thread not reduced below the shoulder
    with pytest.raises(ValueError):
        _part(d_shoulder=DK)                 # head does not overhang the shoulder
    with pytest.raises(ValueError):
        _part(socket_depth=K)                # socket not blind (no floor left)
    with pytest.raises(ValueError):
        _part(socket_af=16.0)                # socket reaches r=9.24 >= dk/2 - wall
    with pytest.raises(ValueError):
        _part(tip_chamfer=D_THREAD)          # rejected by _screw_shank (chamfer >= radius)
