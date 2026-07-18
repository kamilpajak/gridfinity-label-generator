import math

import pytest
from build123d import Box, Pos

from catalog.models.retaining_ring import retaining_ring

# Synthetic geometric fixture (NOT any real standard) — geometry-only checks.
# Seated circle d=12 (r_seat=6). Section tapers from w_back=2 at the back (theta=180) to
# w_lug=3 at the free ends. 38 deg gap centred on +X (wide enough that the two ears clear).
# Round lug ear = boss of wall lug_project=0.6 around a plier hole d=1.5, so ear diameter =
# 1.5 + 2*0.6 = 2.7, ear radius r_ear = 1.35. Flat, 1.2 thick. External by default.
CFG = dict(d_seat=12.0, thickness=1.2, w_lug=3.0, w_back=2.0, gap_deg=38.0,
           lug_hole_d=1.5, lug_project=0.6, internal=False)
R_SEAT = CFG["d_seat"] / 2.0                              # 6.0
R_EAR = CFG["lug_hole_d"] / 2.0 + CFG["lug_project"]      # 1.35 (ear boss radius)


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
    # constant-width one. theta=60 is far from the lug ears (at +/-19).
    part = retaining_ring(**CFG)
    assert _solid_at(part, *_xy(R_SEAT + 2.5, 60), 0.0, probe=0.4)        # wide section: solid
    assert not _solid_at(part, *_xy(R_SEAT + 2.5, 180), 0.0, probe=0.4)  # narrow back: void


def test_gap_is_open_across_full_radial_band():
    # The split must be OPEN: scan the whole radial band at the gap centre (theta=0) — bore
    # side, seated circle, body, and out past the ear tips — and assert NO material anywhere.
    # A section-wide ear (the earlier bug) bridged the gap here while the seated-circle-only
    # probe still passed; this scan fails on that geometry.
    part = retaining_ring(**CFG)
    outer = R_SEAT + CFG["w_lug"] + 2.0 * R_EAR + 1.0
    r = R_SEAT - 1.0
    while r <= outer:
        assert not _solid_at(part, *_xy(r, 0), 0.0, probe=0.3), f"material bridges the gap at r={r}"
        r += 0.5


def test_lug_ear_present_with_open_hole():
    part = retaining_ring(**CFG)
    ang = CFG["gap_deg"] / 2.0                            # ear sits at the free end (+half_gap)
    ear_c = R_SEAT + R_EAR                                # ear-boss centre radius (external)
    # Ear material present: a point offset outward from the hole but still inside the boss.
    assert _solid_at(part, *_xy(ear_c + R_EAR - 0.3, ang), 0.0, probe=0.3)
    # Plier hole at the ear centre is open right through the thickness.
    assert not _solid_at(part, *_xy(ear_c, ang), 0.0, probe=0.3)
    assert not _solid_at(part, *_xy(ear_c, ang), CFG["thickness"] / 2 - 0.1, probe=0.3)


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
        # Ear wall thinner than _MIN_WALL_MM around the plier hole.
        retaining_ring(**{**CFG, "lug_project": 0.05})
    with pytest.raises(ValueError):
        # Internal ring growing inward past the axis (w_lug = 6 > r_seat).
        retaining_ring(**{**CFG, "internal": True, "w_lug": 6.0})
    with pytest.raises(ValueError):
        # Gap too small for the ear size: the two ears meet and close the split.
        retaining_ring(**{**CFG, "gap_deg": 5.0})
    with pytest.raises(ValueError):
        # Taper inverted: wider at the back than at the lugs (not this family's form).
        retaining_ring(**{**CFG, "w_back": 3.5, "w_lug": 2.0})


def test_equal_section_width_is_allowed():
    # A constant-section ring (w_back == w_lug) is not an inversion — it must still build.
    assert retaining_ring(**{**CFG, "w_back": 3.0, "w_lug": 3.0}).volume > 0
