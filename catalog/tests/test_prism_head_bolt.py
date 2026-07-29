import pytest
from build123d import Box, Pos

from catalog.models.prism_head_bolt import prism_head_bolt

# Synthetic fixtures (NOT real standards). Shank dia 10 x 40 long; head 30(len) x 18(width) x 8 tall.
RECT = dict(d=10.0, length=40.0, head_len=30.0, head_width=18.0, head_height=8.0,
            under="none", tip_chamfer=1.0)
NECK = {**RECT, "under": "square_neck", "under_size": 14.0, "under_height": 5.0}
# Square head (len==width) + a round collar wider than the head.
COLLAR = dict(d=10.0, length=40.0, head_len=18.0, head_width=18.0, head_height=8.0,
              under="collar", under_size=22.0, under_height=4.0, tip_chamfer=1.0)


def _solid_at(part, x, y, z, probe=0.4):
    """True if the part has material in a small cube centered at (x, y, z). build123d ``intersect``
    returns None on empty overlap (do NOT use Box(mode=INTERSECT) inside a BuildPart)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_rectangular_head_end_view_extents():
    part = prism_head_bolt(**RECT)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(RECT["head_len"], 1)              # length on X
    assert round(bb.size.Y, 1) == round(RECT["head_width"], 1)            # width on Y
    assert round(bb.size.Z, 1) == round(RECT["length"] + RECT["head_height"], 1)
    assert round(bb.max.Z, 1) == round(RECT["head_height"], 1)            # head top (under="none")
    assert round(bb.min.Z, 1) == round(-RECT["length"], 1)               # shank free end
    z = RECT["head_height"] / 2.0                                         # mid-head
    assert _solid_at(part, RECT["head_len"] / 2.0 - 0.6, 0.0, z)          # solid to the length edge
    assert not _solid_at(part, RECT["head_len"] / 2.0 + 0.6, 0.0, z)     # void beyond it
    assert _solid_at(part, 0.0, RECT["head_width"] / 2.0 - 0.6, z)        # solid to the width edge
    assert not _solid_at(part, 0.0, RECT["head_width"] / 2.0 + 0.6, z)   # void beyond it


def test_square_head_end_view_is_square():
    part = prism_head_bolt(**COLLAR)
    z = COLLAR["under_height"] + COLLAR["head_height"] / 2.0              # mid-head, above the collar
    half = COLLAR["head_len"] / 2.0                                       # == head_width/2 (square)
    assert _solid_at(part, half - 0.6, 0.0, z)                           # solid to the head edge X
    assert _solid_at(part, 0.0, half - 0.6, z)                           # solid to the head edge Y
    assert not _solid_at(part, half + 0.6, 0.0, z)                       # void beyond in X
    assert not _solid_at(part, 0.0, half + 0.6, z)                       # void beyond in Y


def test_square_neck_has_square_corners_a_collar_would_not():
    neck = prism_head_bolt(**NECK)
    collar_same = prism_head_bolt(**{**NECK, "under": "collar"})          # same under_size, round
    z = NECK["under_height"] / 2.0                                        # mid-under
    corner = NECK["under_size"] / 2.0 - 0.6                               # ~6.4, inside a 14mm square
    assert _solid_at(neck, corner, corner, z)                            # square fills its corner
    assert not _solid_at(collar_same, corner, corner, z)                 # round does not (r=7 < 9.05)


def test_collar_is_round_and_wider_than_a_square_of_the_same_size():
    part = prism_head_bolt(**COLLAR)
    z = COLLAR["under_height"] / 2.0                                      # mid-collar
    r = COLLAR["under_size"] / 2.0                                        # 11
    assert _solid_at(part, r - 0.6, 0.0, z)                              # solid to the collar rim
    assert not _solid_at(part, r + 0.6, 0.0, z)                          # void beyond the rim
    assert not _solid_at(part, r * 0.75, r * 0.75, z)                    # corner void (round, not square)


def test_under_none_seats_the_head_on_the_bearing_plane():
    # With under="none" the head bottom is at z=0; with a square neck the head is lifted by
    # under_height. Probe a head-width point at a low z: present for "none", absent for the neck
    # (where only the narrower neck occupies that z).
    rect = prism_head_bolt(**RECT)
    neck = prism_head_bolt(**NECK)
    x = RECT["head_len"] / 2.0 - 1.0                                      # 14, inside the head, outside the 14mm neck half (7)
    z = 2.0                                                               # below the neck top (5), inside the "none" head
    assert _solid_at(rect, x, 0.0, z)                                     # head reaches here (seated at z=0)
    assert not _solid_at(neck, x, 0.0, z)                                # only the narrow neck here; head is lifted


def test_single_fused_solid_for_each_under():
    assert len(prism_head_bolt(**RECT).solids()) == 1
    assert len(prism_head_bolt(**NECK).solids()) == 1
    assert len(prism_head_bolt(**COLLAR).solids()) == 1
    assert prism_head_bolt(**RECT).volume > 0


def test_guards():
    with pytest.raises(ValueError):
        prism_head_bolt(**{**RECT, "under": "hex"})                      # unknown under
    with pytest.raises(ValueError):
        prism_head_bolt(**{**RECT, "d": RECT["head_width"] + 1.0})       # shank wider than the short head side
    with pytest.raises(ValueError):
        prism_head_bolt(**{**RECT, "head_height": 0.0})                  # non-positive dim
    with pytest.raises(ValueError):
        prism_head_bolt(**{**RECT, "under": "collar"})                   # under set but no under_size/height


def test_shank_equal_to_short_head_side_builds_one_solid():
    # DIN 261 M12: the head short side (n=12) equals the shank d (12) — the shank inscribes in the
    # head. This must build a single fused solid, not be rejected by the guard.
    part = prism_head_bolt(d=12.0, length=60.0, head_len=26.0, head_width=12.0,
                           head_height=8.0, under="none", tip_chamfer=1.0)
    assert len(part.solids()) == 1
    assert part.volume > 0
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == 26.0        # head length on X
    assert round(bb.size.Y, 1) == 12.0        # head width on Y == shank dia
