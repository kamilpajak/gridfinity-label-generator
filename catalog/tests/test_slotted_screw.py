import pytest
from build123d import Box, Pos

from catalog.models.slotted_screw import slotted_screw

# Synthetic fixtures (NOT real standards). Head z in [0, k] (raised -> k+raised_f); shank z in
# [-length, 0]. Slot: width drive_w in Y, spans X edge-to-edge, depth drive_t from the crown.
CHEESE = dict(head="cheese", drive="slot", dk=16.0, k=6.0, length=30.0, d_shank=10.0,
              drive_w=2.5, drive_t=2.0)
PAN = {**CHEESE, "head": "pan"}
CSK = {**CHEESE, "head": "countersunk"}
RAISED = {**CHEESE, "head": "raised", "k": 5.0, "raised_f": 1.5}       # cone k=5, lens to z=6.5
CROSS = {**CHEESE, "drive": "cross", "drive_m": 8.0, "drive_w": 2.0, "drive_t": 2.0}


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart -- it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = slotted_screw(**CHEESE)
    bb = part.bounding_box()
    assert round(bb.max.Z, 1) == round(CHEESE["k"], 1)                  # cheese flat top at z=k
    assert round(bb.min.Z, 1) == round(-CHEESE["length"], 1)           # shank free end
    assert round(bb.size.X, 1) == round(CHEESE["dk"], 1)              # head diameter on X
    assert part.volume > 0


def test_shank_hangs_below_the_bearing_plane():
    part = slotted_screw(**CHEESE)
    assert _solid_at(part, 0.0, 0.0, -15.0, probe=0.6)                # solid mid-shank
    assert _solid_at(part, 0.0, 0.0, 3.0, probe=0.6)                  # solid mid-head
    assert not _solid_at(part, 7.0, 0.0, -1.0, probe=0.3)            # outside the shank (r=5) below z=0


def test_countersunk_cone_removes_outer_head_material_cheese_keeps():
    # cheese: cylinder r=8 for all z in [0,6]. csk: cone r=5 at z=0 -> r=8 at z=6, so at z=3 the
    # cone radius is 6.5. Probe (7.5,0,3): cheese solid (7.5<8), csk void (7.5>6.5).
    cheese = slotted_screw(**CHEESE)
    csk = slotted_screw(**CSK)
    assert _solid_at(cheese, 7.5, 0.0, 3.0, probe=0.3)               # cheese: solid outer wall
    assert not _solid_at(csk, 7.5, 0.0, 3.0, probe=0.3)            # csk: cone cut away there


def test_pan_dome_falls_away_from_the_rim_cheese_keeps():
    # pan: spherical cap, base r=8 at z=0, apex at z=6. Near the rim at z=5.5 the dome radius is
    # well under 8, so radius 7 is void where the cheese cylinder is solid. Probe OFF the slot band
    # (y=7, |y| > drive_w/2) so the inherited center slot does not confound the head-shape check.
    cheese = slotted_screw(**CHEESE)
    pan = slotted_screw(**PAN)
    assert _solid_at(cheese, 0.0, 7.0, 5.5, probe=0.3)              # cheese: solid near top rim
    assert not _solid_at(pan, 0.0, 7.0, 5.5, probe=0.3)           # pan: domed away there


def test_raised_lens_adds_material_above_the_cone_top():
    # raised: cone top flat at z=k=5; a lens rises to z=6.5. csk (no lens) is empty above z=5.
    # Probe OFF the slot band (y=3, |y| > drive_w/2) so the inherited center slot does not cut the
    # probed point; the lens radius at z=5.8 is ~5.5, so radius 3 sits inside the lens.
    raised = slotted_screw(**RAISED)
    csk = slotted_screw(**{**CSK, "k": 5.0})
    assert _solid_at(raised, 0.0, 3.0, 5.8, probe=0.3)             # raised: lens off-axis, above the cone
    assert not _solid_at(csk, 0.0, 3.0, 5.8, probe=0.3)          # csk: nothing above the flat top


def test_slot_is_blind_and_spans_edge_to_edge():
    part = slotted_screw(**CHEESE)
    floor = CHEESE["k"] - CHEESE["drive_t"]                        # 4.0
    assert not _solid_at(part, 0.0, 0.0, 5.0, probe=0.3)          # void inside the slot on the axis
    assert not _solid_at(part, 7.5, 0.0, 5.0, probe=0.3)         # slot reaches near the head edge
    assert _solid_at(part, 0.0, 3.0, 5.0, probe=0.3)            # solid off the slot in Y
    assert _solid_at(part, 0.0, 0.0, floor - 0.5, probe=0.3)    # solid below the slot floor (blind)


def test_cross_is_a_four_arm_recess_and_blind():
    part = slotted_screw(**CROSS)
    floor = CROSS["k"] - CROSS["drive_t"]                         # 4.0
    assert not _solid_at(part, 3.0, 0.0, 5.7, probe=0.2)         # void on the +X arm
    assert not _solid_at(part, 0.0, 3.0, 5.7, probe=0.2)        # void on the +Y arm
    assert _solid_at(part, 2.1, 2.1, 5.7, probe=0.2)           # solid on the 45-degree diagonal
    assert _solid_at(part, 0.0, 0.0, floor - 0.5, probe=0.3)   # solid below the recess floor (blind)


@pytest.mark.parametrize("head", ["cheese", "pan", "countersunk", "raised"])
@pytest.mark.parametrize("drive", ["slot", "cross"])
def test_every_head_and_drive_builds_one_solid(head, drive):
    cfg = {**CHEESE, "head": head, "drive": drive}
    if head == "raised":
        cfg = {**cfg, "k": 5.0, "raised_f": 1.5}
    if drive == "cross":
        cfg = {**cfg, "drive_m": 8.0, "drive_w": 2.0, "drive_t": 2.0}
    part = slotted_screw(**cfg)
    assert part.volume > 0
    assert len(part.solids()) == 1                                # head + shank fused


def test_slotted_screw_guards():
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "dk": 0.0})                    # non-positive dim
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "head": "button"})            # unknown head
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "drive": "torx"})             # unknown drive
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "d_shank": 16.0})             # shank not narrower than the head
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "head": "raised", "raised_f": None})   # raised needs raised_f
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "crown_r": 10.0})             # crown_r not < min(dk/2, k)
    with pytest.raises(ValueError):
        slotted_screw(**{**CROSS, "drive_m": None})              # cross needs drive_m
    with pytest.raises(ValueError):
        slotted_screw(**{**CROSS, "drive_w": 8.0})               # cross drive_w not < drive_m
    with pytest.raises(ValueError):
        slotted_screw(**{**CHEESE, "drive_t": 6.0})              # recess not blind (drive_t >= k)
