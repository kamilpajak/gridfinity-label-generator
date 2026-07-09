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


def test_new_families_dispatch_via_registry():
    from catalog.models._registry import build_part

    assert build_part("helical_spring_washer",
                      {"d_inner": 12.2, "d_outer": 20.2, "section": 3.5}).volume > 0
    assert build_part("curved_washer",
                      {"d_inner": 12.2, "d_outer": 21.0, "thickness": 1.5}).volume > 0
