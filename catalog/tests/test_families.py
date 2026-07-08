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
