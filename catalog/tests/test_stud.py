import pytest
from build123d import Box, Pos

from catalog.models.stud import stud

# Synthetic fixture (NOT a real standard): plain rod dia 12 x 60 long, 1 mm chamfer at both ends.
BASE = dict(d=12.0, length=60.0, tip_chamfer=1.0)


def _solid_at(part, x, y, z, probe=0.2):
    """True if the part has material in a small cube centered at (x, y, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT) inside a
    BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_extents():
    part = stud(**BASE)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == round(BASE["length"], 1)     # rod length along Z
    assert round(bb.size.X, 1) == round(BASE["d"], 1)          # body diameter on X
    assert round(bb.min.Z, 1) == 0.0                           # bottom free end
    assert round(bb.max.Z, 1) == round(BASE["length"], 1)      # top free end
    assert part.volume > 0


def test_single_solid():
    assert len(stud(**BASE).solids()) == 1


def test_both_ends_chamfered():
    # The chamfer removes material at the full outer radius near each face: at z just off a face
    # the outer radius is < r, but the reduced-radius core is still present; mid-body is full r.
    part = stud(**BASE)
    r = BASE["d"] / 2.0                 # 6.0
    length = BASE["length"]            # 60
    c = BASE["tip_chamfer"]            # 1
    assert _solid_at(part, r - 0.2, 0.0, length / 2.0)          # mid-body: full radius is solid
    assert not _solid_at(part, r - 0.2, 0.0, 0.1)              # bottom face: chamfered away at r
    assert not _solid_at(part, r - 0.2, 0.0, length - 0.1)     # top face: chamfered away at r
    assert _solid_at(part, r - c - 0.5, 0.0, 0.1)             # bottom core present
    assert _solid_at(part, r - c - 0.5, 0.0, length - 0.1)    # top core present


def test_plain_cylinder_has_full_radius_at_both_faces():
    part = stud(d=12.0, length=60.0)                            # no chamfer
    assert _solid_at(part, 5.8, 0.0, 0.1)                       # full radius solid at bottom face
    assert _solid_at(part, 5.8, 0.0, 59.9)                      # full radius solid at top face


def test_guard_chamfer_not_smaller_than_radius():
    with pytest.raises(ValueError):
        stud(d=12.0, length=60.0, tip_chamfer=6.0)             # == r, must be < r


def test_guard_two_chamfers_exceed_length():
    with pytest.raises(ValueError):
        stud(d=12.0, length=1.5, tip_chamfer=1.0)             # 2*1 >= 1.5


def test_guard_non_positive_dims():
    with pytest.raises(ValueError):
        stud(d=0.0, length=60.0)
    with pytest.raises(ValueError):
        stud(d=12.0, length=0.0)
