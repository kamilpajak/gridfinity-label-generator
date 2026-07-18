import math

import pytest
from build123d import Box, Pos

from catalog.models.retaining_ring import retaining_ring

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
# Seated circle d=12 (r_seat=6). Section tapers from w_back=2 at the back (theta=180) to
# w_lug=3 at the free ends. 30 deg gap centred on +X. Round lug ear of diameter
# w_lug+lug_project = 4.5, plier hole d=2. Flat, 1.2 thick. External by default.
CFG = dict(d_seat=12.0, thickness=1.2, w_lug=3.0, w_back=2.0, gap_deg=30.0,
           lug_hole_d=2.0, lug_project=1.5, internal=False)
R_SEAT = CFG["d_seat"] / 2.0   # 6.0


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def _xy(r, deg):
    a = math.radians(deg)
    return (r * math.cos(a), r * math.sin(a))


def test_flat_thin_part_and_nonempty():
    part = retaining_ring(**CFG)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(CFG["thickness"], 1)   # flat: Z extent == thickness
    assert part.volume > 0


def test_section_tapers_between_lugs_and_back():
    # CFG has w_lug (3) > w_back (2). Probe a radius (r_seat + 2.5) that the body reaches at a
    # wide mid-arc angle but not at the narrow back — discriminates a tapered ring from a
    # constant-width one. theta=60 is far from the lug ears (at +/-15).
    part = retaining_ring(**CFG)
    assert _solid_at(part, *_xy(R_SEAT + 2.5, 60), 0.0, probe=0.4)        # wide section: solid
    assert not _solid_at(part, *_xy(R_SEAT + 2.5, 180), 0.0, probe=0.4)  # narrow back: void


def test_gap_is_void():
    # The gap is centred on +X (theta=0); no material sits on the seated circle there.
    part = retaining_ring(**CFG)
    assert not _solid_at(part, *_xy(R_SEAT, 0), 0.0, probe=0.4)


def test_lug_ear_present_with_open_hole():
    part = retaining_ring(**CFG)
    r_ear = (CFG["w_lug"] + CFG["lug_project"]) / 2.0     # 2.25
    ear_c = R_SEAT + r_ear                                # ear-disc centre radius 8.25, at theta=15
    ear_outer = R_SEAT + CFG["w_lug"] + CFG["lug_project"]  # 10.5
    assert _solid_at(part, *_xy(ear_outer - 0.3, 15), 0.0, probe=0.4)    # ear material present
    # Plier hole (d=2) at the ear centre is open right through the thickness.
    assert not _solid_at(part, *_xy(ear_c, 15), 0.0, probe=0.4)
    assert not _solid_at(part, *_xy(ear_c, 15), CFG["thickness"] / 2 - 0.1, probe=0.3)


def test_external_vs_internal_flip():
    # External: material grows OUTWARD from the seated edge; nothing inside it.
    ext = retaining_ring(**CFG)
    assert _solid_at(ext, *_xy(R_SEAT + 1.0, 180), 0.0, probe=0.4)       # outside seat: solid
    assert not _solid_at(ext, *_xy(R_SEAT - 1.0, 180), 0.0, probe=0.4)  # inside seat: void
    # Internal: mirror — material grows INWARD; nothing outside the seated edge.
    intl = retaining_ring(**{**CFG, "internal": True})
    assert _solid_at(intl, *_xy(R_SEAT - 1.0, 180), 0.0, probe=0.4)      # inside seat: solid
    assert not _solid_at(intl, *_xy(R_SEAT + 1.0, 180), 0.0, probe=0.4) # outside seat: void


def test_builds_at_valid_configs():
    assert retaining_ring(**CFG).volume > 0                              # external
    assert retaining_ring(**{**CFG, "internal": True}).volume > 0        # internal


def test_retaining_ring_guards_bad_geometry():
    with pytest.raises(ValueError):
        retaining_ring(**{**CFG, "d_seat": 0.0})                         # non-positive dim
    with pytest.raises(ValueError):
        retaining_ring(**{**CFG, "gap_deg": 0.0})                        # gap not > 0
    with pytest.raises(ValueError):
        retaining_ring(**{**CFG, "gap_deg": 180.0})                      # gap not < 180
    with pytest.raises(ValueError):
        # Internal ring growing inward past the axis (w_lug+lug_project = 7.5 > r_seat).
        retaining_ring(**{**CFG, "internal": True, "w_lug": 6.0})
    with pytest.raises(ValueError):
        # Plier hole as wide as the whole ear leaves no wall.
        retaining_ring(**{**CFG, "lug_hole_d": CFG["w_lug"] + CFG["lug_project"]})
