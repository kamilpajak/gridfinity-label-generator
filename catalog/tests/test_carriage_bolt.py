import pytest
from build123d import Box, Pos

from catalog.models.carriage_bolt import carriage_bolt

# Synthetic fixtures (NOT real standards): cup and countersunk M12-ish carriage bolts.
CUP = dict(d=12.0, length=60.0, dk=30.0, k=7.0, head="cup",
           square_w=13.0, square_depth=5.0, tip_chamfer=1.0)
CSK = {**CUP, "head": "countersunk", "dk": 26.0, "square_depth": 8.0}


def _solid_at(part, x, y, z, probe=0.3):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT) inside a
    BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_cup_envelope_extents():
    part = carriage_bolt(**CUP)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(CUP["dk"], 1)            # head is widest -> X extent = dk
    assert round(bb.min.Z, 1) == round(-CUP["length"], 1)        # shank free end at -length
    total = CUP["length"] + CUP["square_depth"] + CUP["k"]
    assert round(bb.size.Z, 1) == round(total, 1)               # shank + neck + head
    assert part.volume > 0


def test_single_solid_both_heads():
    assert len(carriage_bolt(**CUP).solids()) == 1
    assert len(carriage_bolt(**CSK).solids()) == 1


def test_square_neck_has_corners_beyond_a_round_neck():
    # The vertex-up square neck reaches its across-corners radius (square_w/sqrt2 ~ 9.19), beyond a
    # round neck of diameter square_w (radius 6.5). Probe the +X corner at mid-neck:
    part = carriage_bolt(**CUP)
    corner_r = CUP["square_w"] / (2 ** 0.5)     # ~9.19
    z_neck = CUP["square_depth"] / 2.0          # mid-neck
    assert _solid_at(part, corner_r - 0.6, 0.0, z_neck)          # solid out at the square corner
    assert not _solid_at(part, corner_r + 0.6, 0.0, z_neck)      # void beyond the corner


def test_cup_head_is_domed_over_the_axis():
    part = carriage_bolt(**CUP)
    apex_z = CUP["square_depth"] + CUP["k"]
    assert _solid_at(part, 0.0, 0.0, apex_z - 0.5)             # solid just below the dome apex
    assert not _solid_at(part, 0.0, 0.0, apex_z + 0.6)         # void above the apex


def test_countersunk_head_widens_to_the_top():
    # A countersunk cone is widest at its top face and narrows downward.
    part = carriage_bolt(**CSK)
    top_z = CSK["square_depth"] + CSK["k"]
    rim_r = CSK["dk"] / 2.0
    assert _solid_at(part, rim_r - 0.8, 0.0, top_z - 0.5)       # solid at the wide top rim
    assert not _solid_at(part, rim_r - 0.8, 0.0, CSK["square_depth"] + 0.5)  # narrowed lower down


def test_guard_bad_head():
    with pytest.raises(ValueError):
        carriage_bolt(**{**CUP, "head": "flat"})


def test_guard_dk_not_exceeding_square():
    with pytest.raises(ValueError):
        carriage_bolt(**{**CUP, "dk": 13.0})       # dk == square_w, must strictly exceed


def test_guard_non_positive_dims():
    with pytest.raises(ValueError):
        carriage_bolt(**{**CUP, "square_depth": 0.0})
    with pytest.raises(ValueError):
        carriage_bolt(**{**CUP, "dk": 0.0})
