import pytest
from build123d import Box, Pos

from catalog.models.wedge_lock_washer import wedge_lock_washer

# Synthetic fixture (NOT a real standard). Ring 13..30 mm, 3 mm thick; 20 radial teeth on top,
# 12 cam notches on the bottom; feature depths exaggerated for legibility (representative).
WL = dict(d_inner=13.0, d_outer=30.0, thickness=3.0, teeth=20, cam_count=12,
          cam_height=0.8, tooth_depth=0.6)


def _solid_at(part, x, y, z, probe=0.4):
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def _ring_no_features(d_inner, d_outer, thickness):
    # A plain ring of the same envelope, to prove the features remove material.
    from build123d import BuildPart, Cylinder, Mode
    with BuildPart() as bp:
        Cylinder(radius=d_outer / 2.0, height=thickness)
        Cylinder(radius=d_inner / 2.0, height=thickness, mode=Mode.SUBTRACT)
    return bp.part


def test_envelope_extents():
    part = wedge_lock_washer(**WL)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == round(WL["d_outer"], 1)     # ring diameter on X
    assert round(bb.size.Z, 1) == round(WL["thickness"], 1)   # centred, features cut inward
    assert part.volume > 0


def test_bore_open_ring_solid():
    part = wedge_lock_washer(**WL)
    assert not _solid_at(part, 0.0, 0.0, 0.0, probe=0.3)      # void inside the bore (r < 6.5)
    assert _solid_at(part, 10.0, 0.0, 0.0, probe=0.3)         # solid ring body at mid-height


def test_features_remove_material():
    part = wedge_lock_washer(**WL)
    plain = _ring_no_features(WL["d_inner"], WL["d_outer"], WL["thickness"])
    assert part.volume < plain.volume                         # teeth + cam notches removed metal


def _void_runs(flags):
    # Count maximal runs of False (void) around a CIRCULAR boolean scan (a solid->void transition
    # starts each run). This is how many discrete cut features the scan crossed.
    n = len(flags)
    return sum(1 for i in range(n) if not flags[i] and flags[(i - 1) % n])


def test_top_face_is_serrated_and_bottom_is_cammed():
    # Scan a full turn at the mean radius. Just under the TOP face the radial grooves make void runs
    # that repeat `teeth` times; just above the BOTTOM face the cam notches repeat `cam_count` times.
    # Counting the void RUNS (not merely "some void exists") proves the pattern is PERIODIC: a single
    # wide cut would give one run, not ~teeth/~cam_count. Robust to the pattern's start angle.
    import math
    part = wedge_lock_washer(**WL)
    r = (WL["d_inner"] + WL["d_outer"]) / 4.0                 # mean radius 10.75
    top_z = WL["thickness"] / 2.0 - 0.15                      # inside the 0.6-deep grooves
    bot_z = -WL["thickness"] / 2.0 + 0.15                     # inside the 0.8-deep notches
    top = [ _solid_at(part, r*math.cos(math.radians(a)), r*math.sin(math.radians(a)), top_z, 0.1)
            for a in range(0, 360) ]
    bot = [ _solid_at(part, r*math.cos(math.radians(a)), r*math.sin(math.radians(a)), bot_z, 0.1)
            for a in range(0, 360) ]
    assert abs(_void_runs(top) - WL["teeth"]) <= 1            # ~20 discrete radial grooves on top
    assert abs(_void_runs(bot) - WL["cam_count"]) <= 1        # ~12 discrete cam notches on the bottom


def test_single_solid():
    part = wedge_lock_washer(**WL)
    assert len(part.solids()) == 1                            # ring stays one fused solid


def test_wedge_lock_washer_guards():
    with pytest.raises(ValueError):
        wedge_lock_washer(**{**WL, "d_inner": 30.0})          # d_inner not < d_outer
    with pytest.raises(ValueError):
        wedge_lock_washer(**{**WL, "teeth": 2})               # need teeth >= 3
    with pytest.raises(ValueError):
        wedge_lock_washer(**{**WL, "cam_count": 2})           # need cam_count >= 3
    with pytest.raises(ValueError):
        wedge_lock_washer(**{**WL, "cam_height": 3.0})        # cam_height >= thickness
    with pytest.raises(ValueError):
        wedge_lock_washer(**{**WL, "cam_height": 2.0, "tooth_depth": 1.5})  # sum >= thickness
