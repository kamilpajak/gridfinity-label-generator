import pytest
from build123d import Box, Pos

from catalog.models.lock_nut import lock_nut

# Synthetic geometric fixtures (NOT any real standard) — geometry-only checks.
S = 18.0
BORE = 10.1
CYL = dict(s=S, m=15.0, bore=BORE, top_style="cylinder", top_h=5.0, top_d=15.0)
CONE = dict(s=S, m=15.0, bore=BORE, top_style="cone", top_h=5.0, top_d=15.0, top_d2=11.0)

CIRCUMR = S / (3.0 ** 0.5)            # hex corner radius = across-corners / 2 ≈ 10.39


def _has_material(part, x, z, probe=1.0):
    """True if the part has any material in a small cube centered at (x, 0, z).

    build123d ``intersect`` returns None when the overlap is empty (do NOT use
    Box(mode=INTERSECT) inside a BuildPart — it raises on empty overlap)."""
    return part.intersect(Pos(x, 0.0, z) * Box(probe, probe, probe)) is not None


def test_cylinder_envelope_extents():
    part = lock_nut(**CYL)
    bb = part.bounding_box()
    assert round(bb.size.X, 2) == round(2.0 * CIRCUMR, 2)   # across-corners, vertical (vertex-up)
    assert round(bb.size.Y, 1) == round(S, 1)               # across-flats
    assert round(bb.size.Z, 1) == round(CYL["m"], 1)        # total height m
    assert part.volume > 0


def test_hex_body_present_below_top_feature():
    # Low z (inside the hex portion, hex_h = m - top_h = 10): material out near the hex
    # corner radius, beyond the collar radius (top_d/2 = 7.5) — proves a real hex body.
    part = lock_nut(**CYL)
    assert _has_material(part, x=9.0, z=2.0)


def test_top_feature_is_narrower_than_the_hex():
    # Near the top (z=13, inside the collar region z=10..15): material within top_d/2=7.5,
    # none beyond it — the collar sits inside the flats (a circle inside the hexagon).
    part = lock_nut(**CYL)
    assert _has_material(part, x=6.0, z=13.0)         # inside the collar wall (bore_r=5.05 < 6.0 < collar_r=7.5)
    assert not _has_material(part, x=9.0, z=13.0)     # beyond the collar, above the hex


def test_cone_crown_tapers_inward():
    # Cone top: base radius top_d/2 = 7.5 at the join (z≈10.5), narrowing to top_d2/2 = 5.5
    # near the top (z≈14.5).
    part = lock_nut(**CONE)
    assert _has_material(part, x=7.0, z=10.5)         # material at the wide base
    assert not _has_material(part, x=7.0, z=14.5)     # narrowed away near the top


def test_open_bore_through_the_nut():
    part = lock_nut(**CYL)
    assert not _has_material(part, x=0.0, z=2.0, probe=0.6)   # inside the through bore
    assert _has_material(part, x=8.0, z=2.0, probe=0.6)       # hub wall between bore and flats
    solid = lock_nut(**{**CYL, "bore": 0.4})
    assert part.volume < solid.volume                        # the M12 bore removes real material


@pytest.mark.parametrize("cfg", [CYL, CONE])
def test_builds_at_valid_configs(cfg):
    part = lock_nut(**cfg)
    assert part.volume > 0


def test_lock_nut_guards_bad_geometry():
    with pytest.raises(ValueError):
        lock_nut(**{**CYL, "bore": 0.0})                     # non-positive dim
    with pytest.raises(ValueError):
        lock_nut(**{**CYL, "top_h": 0.0})                    # non-positive dim
    with pytest.raises(ValueError):
        lock_nut(**{**CYL, "top_style": "wedge"})            # unknown top_style
    with pytest.raises(ValueError):
        lock_nut(**{**CYL, "top_h": 15.0})                   # top_h >= m (no hex body left)
    with pytest.raises(ValueError):
        lock_nut(**{**CYL, "bore": S})                       # bore >= across-flats wall
    with pytest.raises(ValueError):
        lock_nut(**{**CYL, "top_d": S + 1.0})                # top_d > across-flats
    with pytest.raises(ValueError):
        lock_nut(**{**CYL, "top_d": BORE})                   # bore wall through the collar too thin
    with pytest.raises(ValueError):
        lock_nut(**{**CONE, "top_d2": None})                 # cone needs top_d2
    with pytest.raises(ValueError):
        lock_nut(**{**CONE, "top_d2": 16.0})                 # top_d2 >= top_d (not tapering in)
