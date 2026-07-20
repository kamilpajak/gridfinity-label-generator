import pytest
from build123d import Box, Pos

from catalog.models.set_screw import set_screw

# Synthetic fixtures (NOT real standards): body dia 12 x 30 long, hex socket across-flats 6 x
# 4.5 deep in the top (z=30) end; point at the bottom (z=0) end. Body z in [0, 30].
BASE = dict(d=12.0, length=30.0, socket_af=6.0, socket_depth=4.5)
FLAT = {**BASE, "point": "flat"}
CONE = {**BASE, "point": "cone", "point_h": 5.0, "point_d": 3.0}
DOG = {**BASE, "point": "dog", "point_h": 4.0, "point_d": 8.0}
CUP = {**BASE, "point": "cup", "point_h": 3.0, "point_d": 8.0}


def _solid_at(part, x, y, z, probe=0.5):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = set_screw(**FLAT)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(FLAT["length"], 1)      # cylinder length along Z
    assert round(bb.size.X, 1) == round(FLAT["d"], 1)           # body diameter on X
    assert round(bb.max.Z, 1) == round(FLAT["length"], 1)       # top (socket) face
    assert round(bb.min.Z, 1) == 0.0                            # bottom (point) end
    assert part.volume > 0


def test_socket_is_blind_and_opens_from_the_top():
    part = set_screw(**FLAT)
    top = FLAT["length"]                                        # 30
    floor = FLAT["length"] - FLAT["socket_depth"]              # 25.5
    assert not _solid_at(part, 0.0, 0.0, top - 0.4, probe=0.3)  # void inside the socket
    assert _solid_at(part, 0.0, 0.0, floor - 0.5, probe=0.3)    # solid below the socket floor
    assert _solid_at(part, 0.0, 0.0, 15.0, probe=0.6)          # solid core mid-body


def test_flat_point_is_a_full_flat_end():
    # A flat point is solid across the whole bottom face: solid near the rim and on the axis.
    part = set_screw(**FLAT)
    assert _solid_at(part, 4.5, 0.0, 0.5, probe=0.3)           # solid near the outer bottom
    assert _solid_at(part, 0.0, 0.0, 0.5, probe=0.3)           # solid on the axis at the bottom


def test_cone_point_removes_the_bottom_outer_corner():
    # Cone tapers from r=6 at z=point_h=5 to a small flat tip (point_d/2=1.5) at z=0. At z=0.5
    # the cone radius is ~1.95, so the outer bottom is void where the flat point is solid.
    cone = set_screw(**CONE)
    flat = set_screw(**FLAT)
    assert not _solid_at(cone, 4.5, 0.0, 0.5, probe=0.3)       # cone: outer bottom cut away
    assert _solid_at(flat, 4.5, 0.0, 0.5, probe=0.3)          # flat: solid there


def test_dog_point_is_a_narrow_pilot():
    # Dog: a point_d/2=4 radius cylinder for z in [0, point_h=4]. On the axis it is solid; the
    # outer ring (r=5, beyond the dog) is void below the shoulder, where the flat point is solid.
    dog = set_screw(**DOG)
    flat = set_screw(**FLAT)
    assert _solid_at(dog, 0.0, 0.0, 2.0, probe=0.4)           # dog present on the axis
    assert not _solid_at(dog, 5.0, 0.0, 2.0, probe=0.3)       # outer ring cut to the dog dia
    assert _solid_at(flat, 5.0, 0.0, 2.0, probe=0.3)         # flat: solid there


def test_cup_point_is_a_concave_recess_with_a_rim():
    # Cup: a conical recess (apex at z=point_h=3 on the axis, mouth point_d/2=4 at z=0). On the
    # axis the bottom is void (inside the recess); the outer rim is solid.
    cup = set_screw(**CUP)
    flat = set_screw(**FLAT)
    assert not _solid_at(cup, 0.0, 0.0, 0.5, probe=0.3)       # recess void on the axis
    assert _solid_at(cup, 5.0, 0.0, 0.5, probe=0.3)          # solid rim near the outer edge
    assert _solid_at(flat, 0.0, 0.0, 0.5, probe=0.3)        # flat: solid on the axis there


@pytest.mark.parametrize("cfg", [FLAT, CONE, DOG, CUP])
def test_each_point_builds_one_solid(cfg):
    part = set_screw(**cfg)
    assert part.volume > 0
    assert len(part.solids()) == 1                            # one fused solid


def test_set_screw_guards():
    with pytest.raises(ValueError):
        set_screw(**{**FLAT, "d": 0.0})                       # non-positive dim
    with pytest.raises(ValueError):
        set_screw(**{**FLAT, "point": "ball"})               # unknown point
    with pytest.raises(ValueError):
        set_screw(**{**FLAT, "socket_af": 11.0})             # socket corner pierces the body wall
    with pytest.raises(ValueError):
        set_screw(**{**CONE, "point_d": 12.0})               # point_d not narrower than the body
    with pytest.raises(ValueError):
        set_screw(**{**CONE, "point_h": None})               # shaped point needs point_h
    with pytest.raises(ValueError):
        set_screw(**{**CONE, "socket_depth": 28.0})          # socket collides with the point
    with pytest.raises(ValueError):
        set_screw(**{**CONE, "tip_chamfer": 1.0})            # tip_chamfer is flat-only
