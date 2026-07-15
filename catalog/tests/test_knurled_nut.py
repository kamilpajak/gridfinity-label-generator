import pytest
from build123d import Box, Pos

from catalog.models.knurled_nut import knurled_nut

BORE = 10.1
# Synthetic geometric fixtures (NOT any real standard) — geometry-only checks.
DISC = dict(d=20.0, h=6.0, bore=BORE)                                # DIN 467-like: no collar
HIGH = dict(d=20.0, h=10.0, bore=BORE, collar_d=16.0, collar_h=4.0)  # DIN 466-like: head + boss


def _has_material(part, x, z, probe=1.0):
    """True if the part has material in a small cube centered at (x, 0, z).

    build123d ``intersect`` returns None on empty overlap (do NOT use Box(mode=INTERSECT)
    inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, 0.0, z) * Box(probe, probe, probe)) is not None


def test_disc_envelope_extents():
    part = knurled_nut(**DISC)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(DISC["d"], 1)   # round body: OD on X and Y
    assert round(bb.size.Y, 1) == round(DISC["d"], 1)
    assert round(bb.size.Z, 1) == round(DISC["h"], 1)   # disc height
    assert part.volume > 0


def test_high_envelope_extents():
    part = knurled_nut(**HIGH)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(HIGH["d"], 1)                     # head OD is the widest
    assert round(bb.size.Z, 1) == round(HIGH["collar_h"] + HIGH["h"], 1)  # collar + head stacked


def test_high_collar_is_narrower_than_the_head():
    part = knurled_nut(**HIGH)
    # low z (inside the collar, z=2 < collar_h=4): material inside collar_d/2=8, none beyond it
    assert _has_material(part, x=7.0, z=2.0)          # collar wall (bore 5.05 < 7 < 8)
    assert not _has_material(part, x=9.0, z=2.0)      # beyond the collar OD
    # head height (z=8, inside head 4..14): material out to near d/2=10 — the head oversails
    assert _has_material(part, x=9.0, z=8.0)


def test_disc_is_a_full_cylinder_no_step():
    part = knurled_nut(**DISC)
    assert _has_material(part, x=9.0, z=1.0)          # full d/2=10 radius near the bottom
    assert _has_material(part, x=9.0, z=5.0)          # and near the top — no step


def test_open_bore_through_the_nut():
    part = knurled_nut(**HIGH)
    assert not _has_material(part, x=0.0, z=2.0, probe=0.6)   # inside the through bore
    assert _has_material(part, x=7.0, z=8.0, probe=0.6)       # head wall between bore and OD
    solid = knurled_nut(**{**HIGH, "bore": 0.4})
    assert part.volume < solid.volume                        # the M12 bore removes real material


@pytest.mark.parametrize("cfg", [DISC, HIGH])
def test_builds_at_valid_configs(cfg):
    assert knurled_nut(**cfg).volume > 0


def test_knurled_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        knurled_nut(**{**DISC, "d": 0.0})                    # non-positive dim
    with pytest.raises(ValueError):
        knurled_nut(**{**DISC, "bore": DISC["d"]})           # bore wall vs head OD too thin
    with pytest.raises(ValueError):
        knurled_nut(**{**DISC, "collar_d": 16.0})            # collar_d without collar_h
    with pytest.raises(ValueError):
        knurled_nut(**{**DISC, "collar_h": 4.0})             # collar_h without collar_d
    with pytest.raises(ValueError):
        knurled_nut(**{**HIGH, "collar_d": 20.0})            # collar_d >= head d (no step)
    with pytest.raises(ValueError):
        knurled_nut(**{**HIGH, "collar_d": BORE})            # collar wall around bore too thin
    with pytest.raises(ValueError):
        knurled_nut(**{**HIGH, "collar_h": -1.0})            # non-positive collar dim
