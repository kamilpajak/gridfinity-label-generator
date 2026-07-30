import math

import pytest
from build123d import Box, Pos

from catalog.models.turnbuckle_nut import turnbuckle_nut

# DIN 1479 M12 fixture: across-flats s=18, sleeve length l=55 (fasteners.eu / WDS / Maedler);
# bore = M12 minor diameter (family drawn-bore convention); sight hole REPRESENTATIVE.
S = 18.0
LENGTH = 55.0
BORE = 10.1
SIGHT_HOLE_D = 3.0

MID = LENGTH / 2.0                      # 27.5 — sight-hole centre
CORNER_R = S / math.sqrt(3.0)           # 10.392 — hex across-corners / 2
RISE = (CORNER_R - S / 2.0) * math.tan(math.radians(30.0))   # 0.804 — end-chamfer height


def _part(**over):
    cfg = dict(s=S, length=LENGTH, bore=BORE, sight_hole_d=SIGHT_HOLE_D)
    cfg.update(over)
    return turnbuckle_nut(**cfg)


def _solid_at(part, x, y, z, probe=0.4):
    """build123d returns None when the intersection with the probe box is empty."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_hex_sleeve():
    part = _part()
    bb = part.bounding_box()
    assert round(bb.size.Y, 1) == round(S, 1)              # flats face +/-Y, across-flats = s
    assert round(bb.size.X, 1) == round(2.0 * CORNER_R, 1)  # corners along X (vertex-up), 20.8
    assert round(bb.min.Z, 1) == 0.0                       # sleeve sits on z=0
    assert round(bb.max.Z, 1) == round(LENGTH, 1)          # overall length 55


def test_axial_bore_is_through():
    part = _part()
    z_lo, z_hi = 10.0, LENGTH - 10.0                       # clear of ends AND the mid sight hole
    assert not _solid_at(part, 0.0, 0.0, z_lo)             # bore void on the axis, lower half
    assert not _solid_at(part, 0.0, 0.0, z_hi)             # ... and upper half (through)
    assert _solid_at(part, 0.0, 7.0, z_lo)                 # wall between bore r=5.05 and flat 9
    assert not _solid_at(part, 0.0, 9.6, z_lo)             # void beyond the +Y flat


def test_sight_hole_pierces_both_flats_at_mid_length():
    part = _part()
    # inside the wall (y=8, between bore and flat): void ONLY where the sight hole passes
    assert not _solid_at(part, 0.0, 8.0, MID)              # hole through the +Y flat
    assert not _solid_at(part, 0.0, -8.0, MID)             # ... and through the -Y flat
    assert _solid_at(part, 0.0, 8.0, MID + 3.0)            # wall solid just above the hole
    assert _solid_at(part, 0.0, 8.0, MID - 3.0)            # ... and just below


def test_sight_hole_runs_along_y_not_x():
    part = _part()
    # same radial distance but on the X (corner) side: solid — the drilling is along Y only
    assert _solid_at(part, 8.0, 0.0, MID)


def test_end_corner_chamfers():
    part = _part()
    x = CORNER_R - 0.2                                     # 10.19, just inside the corner tip
    assert not _solid_at(part, x, 0.0, 0.15, probe=0.25)         # bottom corner beveled away
    assert not _solid_at(part, x, 0.0, LENGTH - 0.15, probe=0.25)  # top corner beveled away
    assert _solid_at(part, x, 0.0, 10.0, probe=0.25)             # full corner at mid-heights


def test_custom_chamfer_circle_builds():
    part = _part(chamfer=14.0)                             # r_flat=7 < corner radius: valid
    bb = part.bounding_box()
    assert round(bb.max.Z, 1) == round(LENGTH, 1)
    assert len(part.solids()) == 1


def test_single_fused_solid():
    part = _part()
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        _part(s=0.0)                         # non-positive dim
    with pytest.raises(ValueError):
        _part(length=-1.0)                   # non-positive dim
    with pytest.raises(ValueError):
        _part(bore=0.0)                      # non-positive dim
    with pytest.raises(ValueError):
        _part(sight_hole_d=0.0)              # non-positive dim
    with pytest.raises(ValueError):
        _part(length=S)                      # sleeve not longer than across-flats
    with pytest.raises(ValueError):
        _part(bore=S)                        # bore leaves too thin a wall
    with pytest.raises(ValueError):
        _part(sight_hole_d=10.4)             # >= flat face width s/sqrt(3) = 10.392
    with pytest.raises(ValueError):
        _part(chamfer=2.0 * S)               # chamfer circle beyond the hex corners
    with pytest.raises(ValueError):
        _part(chamfer=-1.0)                  # rejected by _chamfered_hex_solid
