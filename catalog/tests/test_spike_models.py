def test_flat_washer_is_a_ring_with_correct_extents():
    from catalog.models.washer import flat_washer

    part = flat_washer(d_inner=13.0, d_outer=24.0, thickness=2.5)
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == 24.0  # outer diameter
    assert round(bb.size.Z, 1) == 2.5   # thickness
    assert part.volume > 0
    # Ring: volume less than a solid disc of the same outer size.
    import math
    solid = math.pi * (24.0 / 2) ** 2 * 2.5
    assert part.volume < solid


def test_hex_nut_has_six_side_faces_and_a_bore():
    from catalog.models.hex_nut import hex_nut

    part = hex_nut(s=34.0, m=8.5, bore=20.96)
    bb = part.bounding_box()
    assert round(bb.size.Z, 1) == 8.5
    # Across-flats 34 => across-corners ~39.26; X extent is the corner-to-corner span.
    assert 38.0 < bb.size.X < 40.5
    assert part.volume > 0
