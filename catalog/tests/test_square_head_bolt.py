import math

import pytest
from build123d import Box, Pos

from catalog.models.square_head_bolt import square_head_bolt

# DIN 478 M12 fixture: square head s=13 across flats, total head height k=15 INCLUDING the
# c=3 collar (dc=19.5), M12 shank. length/tip_chamfer representative.
S = 13.0
K = 15.0
DC = 19.5
C = 3.0
D_SHANK = 12.0
LENGTH = 40.0
TIP_CHAMFER = 1.2

HALF_DIAG = S / math.sqrt(2.0)             # 9.19: square corner radius (across-corners / 2)
INSCRIBED = S / 2.0                        # 6.5: flat-face radius (at the 45-degree azimuth)


def _part(**over):
    cfg = dict(s=S, k=K, dc=DC, c=C, d_shank=D_SHANK, length=LENGTH,
               tip_chamfer=TIP_CHAMFER)
    cfg.update(over)
    return square_head_bolt(**cfg)


def _solid_at(part, x, y, z, probe=0.4):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_collar_is_widest_head_top_at_k_shank_end_at_minus_length():
    part = _part()
    bb = part.bounding_box()
    # The collar (dc=19.5) overhangs the sharp square diagonal (2*HALF_DIAG=18.38), so it
    # sets both plan extents; head z in [0, K], shank z in [-LENGTH, 0].
    assert round(bb.size.X, 1) == round(DC, 1)
    assert round(bb.size.Y, 1) == round(DC, 1)
    assert round(bb.max.Z, 1) == round(K, 1)
    assert round(bb.min.Z, 1) == round(-LENGTH, 1)
    assert part.volume > 0


def test_collar_washer_face_only_in_the_bottom_c_band():
    # Probe on the 45-degree azimuth (between the square flats) at radius 8.0 — between the
    # square's flat-face radius (6.5) and the collar radius (9.75): solid inside the collar
    # band, void just above it (only the narrower square continues upward).
    part = _part()
    x = y = 8.0 / math.sqrt(2.0)
    assert _solid_at(part, x, y, C / 2.0)
    assert not _solid_at(part, x, y, C + 0.5)


def test_square_head_band_is_vertex_up():
    # Mid square band (z=9, above the collar): solid out to the corner on +X, void beyond it;
    # on the 45-degree azimuth the flat cuts material off past the inscribed radius 6.5 — a
    # round head of the corner radius would still be solid there.
    part = _part()
    z = (C + K) / 2.0
    assert _solid_at(part, HALF_DIAG - 0.5, 0.0, z)                # solid out to the corner
    assert not _solid_at(part, HALF_DIAG + 0.6, 0.0, z)            # void beyond the corner
    f = 1.0 / math.sqrt(2.0)
    assert _solid_at(part, (INSCRIBED - 0.6) * f, (INSCRIBED - 0.6) * f, z)      # inside the flat
    assert not _solid_at(part, (INSCRIBED + 0.6) * f, (INSCRIBED + 0.6) * f, z)  # beyond the flat


def test_solid_core_no_bore():
    part = _part()
    assert _solid_at(part, 0.0, 0.0, C / 2.0, probe=0.6)           # on axis in the collar
    assert _solid_at(part, 0.0, 0.0, (C + K) / 2.0, probe=0.6)     # on axis in the square band
    assert _solid_at(part, 0.0, 0.0, -LENGTH / 2.0, probe=0.6)     # on axis in the shank


def test_shank_below_bearing_plane_narrower_than_collar():
    part = _part()
    r = D_SHANK / 2.0
    z_shank = -LENGTH / 2.0
    assert _solid_at(part, r - 0.5, 0.0, z_shank)                  # solid to the shank wall
    assert not _solid_at(part, r + 0.6, 0.0, z_shank)              # void beyond the shank
    # A collar-band radius (8.0, inside dc/2=9.75) is solid in the collar but void in the shank.
    assert _solid_at(part, 8.0, 0.0, C / 2.0)
    assert not _solid_at(part, 8.0, 0.0, z_shank)


def test_tip_chamfer_is_cut():
    part = _part()
    r = D_SHANK / 2.0
    assert not _solid_at(part, r - 0.2, 0.0, -LENGTH + 0.2)        # 45-deg lead trims the corner
    assert not _solid_at(part, 0.0, 0.0, -LENGTH - 0.6)            # nothing below the tip


def test_shank_without_chamfer_is_flat_bottomed():
    part = _part(tip_chamfer=None)
    r = D_SHANK / 2.0
    assert _solid_at(part, r - 0.2, 0.0, -LENGTH + 0.2)            # corner intact (no lead chamfer)
    assert round(part.bounding_box().min.Z, 1) == round(-LENGTH, 1)


def test_single_fused_solid():
    part = _part()
    assert len(part.solids()) == 1
    assert part.volume > 0
    assert len(_part(tip_chamfer=None).solids()) == 1


def test_guards():
    with pytest.raises(ValueError):
        _part(s=0.0)                       # non-positive dim
    with pytest.raises(ValueError):
        _part(length=-1.0)                 # non-positive dim (shank param)
    with pytest.raises(ValueError):
        _part(c=K)                         # collar as thick as the whole head (k includes c)
    with pytest.raises(ValueError):
        _part(dc=S)                        # collar not past the square corners (13 < 18.38)
    with pytest.raises(ValueError):
        _part(d_shank=DC)                  # shank not narrower than the collar
    with pytest.raises(ValueError):
        _part(tip_chamfer=D_SHANK)         # rejected by _screw_shank (chamfer >= radius)
