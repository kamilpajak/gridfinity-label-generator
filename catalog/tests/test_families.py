def test_registry_dispatches_flat_washer():
    from catalog.models._registry import build_part

    part = build_part("flat_washer", {"d_inner": 13.0, "d_outer": 24.0, "thickness": 2.5})
    assert round(part.bounding_box().size.X, 1) == 24.0


def test_spring_washer_has_a_split_reducing_volume_vs_full_ring():
    from catalog.models.washer import spring_washer, flat_washer

    ring = flat_washer(d_inner=10.2, d_outer=18.1, thickness=3.5)  # comparable full ring
    split = spring_washer(d_inner=10.2, d_outer=18.1, section=3.5, gap=2.0)
    assert split.volume < ring.volume  # the split removes material
    assert round(split.bounding_box().size.Z, 1) == 3.5


def test_invariant_inner_less_than_outer_enforced_by_generator():
    from catalog.models.washer import flat_washer
    import pytest

    with pytest.raises(ValueError):
        flat_washer(d_inner=24.0, d_outer=13.0, thickness=2.5)


def test_helical_spring_washer_is_a_partial_coil():
    from catalog.models.washer import helical_spring_washer, flat_washer

    coil = helical_spring_washer(d_inner=12.2, d_outer=20.2, section=3.5)
    full = flat_washer(d_inner=12.2, d_outer=20.2, thickness=3.5)
    assert coil.volume > 0
    assert coil.volume < full.volume            # gap + coil < solid ring
    # rises by ~one section over the turn -> taller than a flat ring of the same section
    assert coil.bounding_box().size.Z > 3.5 * 1.5


def test_curved_washer_is_domed_and_split():
    from catalog.models.washer import curved_washer, flat_washer

    dome = curved_washer(d_inner=12.2, d_outer=21.0, thickness=1.5)
    full = flat_washer(d_inner=12.2, d_outer=21.0, thickness=1.5)
    assert dome.volume > 0
    assert dome.volume < full.volume            # gap + tilt < flat full ring
    # tilted cross-section -> taller than a flat ring of the same thickness
    assert dome.bounding_box().size.Z > 1.5


def _max_radius(part):
    return max((v.X ** 2 + v.Y ** 2) ** 0.5 for v in part.vertices())


def test_toothed_lock_washer_is_a_toothed_ring():
    from catalog.models.washer import toothed_lock_washer, flat_washer

    toothed = toothed_lock_washer(d_inner=12.5, d_outer=20.5, thickness=1.0, teeth=10)
    full = flat_washer(d_inner=12.5, d_outer=20.5, thickness=1.0)
    assert toothed.volume > 0
    assert toothed.volume < full.volume                 # tooth valleys remove material
    assert round(_max_radius(toothed), 2) == 10.25      # tooth tips reach d_outer / 2
    assert round(toothed.bounding_box().size.Z, 1) == 1.0    # flat, one thickness


def test_toothed_tooth_count_changes_geometry_within_same_envelope():
    from catalog.models.washer import toothed_lock_washer, flat_washer

    coarse = toothed_lock_washer(d_inner=8.4, d_outer=15.0, thickness=0.8, teeth=8)   # DIN 6797
    fine = toothed_lock_washer(d_inner=8.4, d_outer=15.0, thickness=0.8, teeth=16)    # DIN 6798
    full = flat_washer(d_inner=8.4, d_outer=15.0, thickness=0.8)
    # Same body + tip circle for both; only the tooth count differs.
    assert round(_max_radius(coarse), 2) == round(_max_radius(fine), 2) == 7.5
    assert coarse.volume < full.volume and fine.volume < full.volume
    assert round(coarse.volume, 3) != round(fine.volume, 3)   # tooth count is a real geometry knob


def test_toothed_lock_washer_guards_bad_geometry():
    from catalog.models.washer import toothed_lock_washer
    import pytest

    with pytest.raises(ValueError):
        toothed_lock_washer(d_inner=20.5, d_outer=12.5, thickness=1.0, teeth=10)  # inner>outer
    with pytest.raises(ValueError):
        toothed_lock_washer(d_inner=12.5, d_outer=20.5, thickness=1.0, teeth=2)   # too few teeth
    with pytest.raises(ValueError):
        # tooth_depth deeper than the ring land -> no material between bore and root
        toothed_lock_washer(d_inner=12.5, d_outer=20.5, thickness=1.0, teeth=10, tooth_depth=10.0)
    with pytest.raises(ValueError):
        # tip_ratio >= 1 would make teeth self-overlap
        toothed_lock_washer(d_inner=12.5, d_outer=20.5, thickness=1.0, teeth=10, tip_ratio=1.0)
    with pytest.raises(ValueError):
        # negative tooth_depth would invert the teeth (root beyond the tip circle)
        toothed_lock_washer(d_inner=12.5, d_outer=20.5, thickness=1.0, teeth=10, tooth_depth=-1.0)


def _radii(part):
    return [(v.X ** 2 + v.Y ** 2) ** 0.5 for v in part.vertices()]


def test_internal_toothed_has_plain_rim_and_toothed_bore():
    import math
    from catalog.models.washer import toothed_lock_washer_internal

    part = toothed_lock_washer_internal(d_inner=13.0, d_outer=20.5, thickness=1.0, teeth=10)
    radii = _radii(part)
    assert round(max(radii), 2) == 10.25            # plain outer disc at d_outer / 2
    assert round(min(radii), 2) == 6.5              # inward tips reach d_inner / 2 (the bore)
    assert round(part.bounding_box().size.Z, 1) == 1.0
    assert 0 < part.volume < math.pi * 10.25 ** 2 * 1.0   # disc minus a star-shaped hole


def test_internal_tooth_count_changes_geometry_within_same_envelope():
    from catalog.models.washer import toothed_lock_washer_internal

    coarse = toothed_lock_washer_internal(d_inner=13.0, d_outer=20.5, thickness=1.0, teeth=10)  # 6797 J
    fine = toothed_lock_washer_internal(d_inner=13.0, d_outer=20.5, thickness=1.0, teeth=16)    # 6798 J
    assert round(max(_radii(coarse)), 2) == round(max(_radii(fine)), 2) == 10.25   # same plain rim
    assert round(coarse.volume, 3) != round(fine.volume, 3)


def test_internal_toothed_guards_bad_geometry():
    from catalog.models.washer import toothed_lock_washer_internal
    import pytest

    with pytest.raises(ValueError):
        toothed_lock_washer_internal(d_inner=20.5, d_outer=13.0, thickness=1.0, teeth=10)  # inner>outer
    with pytest.raises(ValueError):
        # tooth_depth so deep the valleys pass the outer edge -> no rim left
        toothed_lock_washer_internal(d_inner=13.0, d_outer=20.5, thickness=1.0, teeth=10, tooth_depth=10.0)
    with pytest.raises(ValueError):
        toothed_lock_washer_internal(d_inner=13.0, d_outer=20.5, thickness=1.0, teeth=10, tip_ratio=1.0)
    with pytest.raises(ValueError):
        toothed_lock_washer_internal(d_inner=13.0, d_outer=20.5, thickness=1.0, teeth=10, tooth_depth=-1.0)


def test_countersunk_toothed_is_dished_and_toothed():
    from catalog.models.washer import countersunk_toothed_washer, toothed_lock_washer

    dished = countersunk_toothed_washer(d_inner=13.0, d_outer=22.0, thickness=0.8, teeth=18)
    flat = toothed_lock_washer(d_inner=13.0, d_outer=22.0, thickness=0.8, teeth=18)
    assert dished.volume > 0
    assert round(max(_radii(dished)), 1) <= 11.0        # teeth stay within d_outer / 2
    # the cone lifts the rim well above one flat thickness — this is what makes it "countersunk"
    assert dished.bounding_box().size.Z > 0.8 * 1.5
    assert dished.bounding_box().size.Z > flat.bounding_box().size.Z


def test_countersunk_tooth_count_changes_geometry():
    from catalog.models.washer import countersunk_toothed_washer

    coarse = countersunk_toothed_washer(d_inner=13.0, d_outer=22.0, thickness=0.8, teeth=12)
    fine = countersunk_toothed_washer(d_inner=13.0, d_outer=22.0, thickness=0.8, teeth=18)
    assert round(coarse.volume, 3) != round(fine.volume, 3)


def test_countersunk_toothed_guards_bad_geometry():
    from catalog.models.washer import countersunk_toothed_washer
    import pytest

    with pytest.raises(ValueError):
        countersunk_toothed_washer(d_inner=22.0, d_outer=13.0, thickness=0.8, teeth=18)   # inner>outer
    with pytest.raises(ValueError):
        countersunk_toothed_washer(d_inner=13.0, d_outer=22.0, thickness=0.8, teeth=18, tooth_depth=10.0)
    with pytest.raises(ValueError):
        countersunk_toothed_washer(d_inner=13.0, d_outer=22.0, thickness=0.8, teeth=18, tip_ratio=0)


def test_new_families_dispatch_via_registry():
    from catalog.models._registry import build_part

    assert build_part("helical_spring_washer",
                      {"d_inner": 12.2, "d_outer": 20.2, "section": 3.5}).volume > 0
    assert build_part("curved_washer",
                      {"d_inner": 12.2, "d_outer": 21.0, "thickness": 1.5}).volume > 0
    assert build_part("toothed_lock_washer",
                      {"d_inner": 12.5, "d_outer": 20.5, "thickness": 1.0, "teeth": 10}).volume > 0
    assert build_part("toothed_lock_washer_internal",
                      {"d_inner": 13.0, "d_outer": 20.5, "thickness": 1.0, "teeth": 10}).volume > 0
    assert build_part("countersunk_toothed_washer",
                      {"d_inner": 13.0, "d_outer": 22.0, "thickness": 0.8, "teeth": 18}).volume > 0
