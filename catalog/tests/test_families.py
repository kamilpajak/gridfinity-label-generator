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
    with pytest.raises(ValueError):
        # a near-flat tooth leaves the valleys outside the tilted body -> would carve no teeth
        countersunk_toothed_washer(d_inner=13.0, d_outer=22.0, thickness=0.8, teeth=18, tooth_depth=0.05)
    with pytest.raises(ValueError):
        # a near-vertical cone would self-intersect the revolved wall
        countersunk_toothed_washer(d_inner=13.0, d_outer=22.0, thickness=0.8, teeth=18, cone_angle=85)


def test_square_washer_is_a_flat_square_plate_with_a_bore():
    from catalog.models.washer import square_washer

    part = square_washer(side=40.0, thickness=4.0, d_bore=13.5)   # DIN 436
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == 40.0 and round(bb.size.Y, 1) == 40.0
    assert round(bb.size.Z, 1) == 4.0
    assert 0 < part.volume < 40.0 * 40.0 * 4.0                    # bore removes material


def test_square_taper_washer_is_a_wedge():
    from catalog.models.washer import square_washer

    flat = square_washer(side=30.0, thickness=4.1, d_bore=13.5)               # no taper
    wedge = square_washer(side=30.0, thickness=4.1, d_bore=13.5, taper=2.1)   # DIN 435
    # the wedge spans thickness -> thickness+taper in Z, and holds more material
    assert round(wedge.bounding_box().size.Z, 1) == round(4.1 + 2.1, 1)
    assert wedge.volume > flat.volume


def test_square_washer_supports_rectangular_plan():
    from catalog.models.washer import square_washer

    part = square_washer(side=30.0, thickness=2.5, d_bore=13.5, side_b=26.0)  # DIN 434 plan
    bb = part.bounding_box()
    assert round(bb.size.X, 1) == 30.0 and round(bb.size.Y, 1) == 26.0


def test_square_washer_guards_bad_geometry():
    from catalog.models.washer import square_washer
    import pytest

    with pytest.raises(ValueError):
        square_washer(side=-1.0, thickness=4.0, d_bore=13.5)
    with pytest.raises(ValueError):
        square_washer(side=40.0, thickness=0.0, d_bore=13.5)
    with pytest.raises(ValueError):
        square_washer(side=40.0, thickness=4.0, d_bore=50.0)          # bore wider than plate
    with pytest.raises(ValueError):
        square_washer(side=40.0, thickness=4.0, d_bore=13.5, taper=-1.0)


def test_tab_washer_has_a_disc_and_an_upright_tab():
    from catalog.models.washer import tab_washer, flat_washer

    part = tab_washer(13.0, 30.0, 1.2, [{"angle": 0, "length": 5.0, "width": 4.5}])
    disc = flat_washer(13.0, 30.0, 1.2)
    assert part.volume > disc.volume                       # the tab adds material
    # the tab stands up out of the disc plane, so Z spans the tab length, not the thickness
    assert round(part.bounding_box().size.Z, 1) == 5.0


def test_tab_washer_more_tabs_add_material():
    from catalog.models.washer import tab_washer

    one = tab_washer(13.0, 30.0, 1.0, [{"angle": 0, "length": 10.0, "width": 10.0}])
    two = tab_washer(13.0, 30.0, 1.0, [{"angle": 0, "length": 10.0, "width": 10.0},
                                       {"angle": 180, "length": 10.0, "width": 10.0}])
    assert two.volume > one.volume


def test_tab_washer_internal_tab_stands_at_the_bore():
    from catalog.models.washer import tab_washer, flat_washer

    part = tab_washer(12.0, 28.0, 0.8, [{"angle": 0, "length": 9.3, "width": 5.0, "internal": True}])
    disc = flat_washer(12.0, 28.0, 0.8)
    assert part.volume > disc.volume                       # the tab adds material
    assert round(part.bounding_box().size.Z, 1) == 9.3     # tab stands up out of the plane
    # the tab sits at the bore, so the min in-plane radius of any vertex is the bore radius
    # minus nothing (the flap's inner face is on the bore), well inside the disc's inner edge
    bore_r, rim_r = 12.0 / 2.0, 28.0 / 2.0                  # r=6 bore, r=14 rim
    tab_pts = [v for v in part.vertices() if v.Z > 0.5]    # vertices above the disc = the tab
    assert tab_pts, "internal tab should contribute vertices above the disc plane"
    # an internal tab's standing vertices sit at the bore, well inside the midpoint to the rim
    assert min((v.X ** 2 + v.Y ** 2) ** 0.5 for v in tab_pts) < (bore_r + rim_r) / 2.0


def test_tab_washer_guards_bad_geometry():
    from catalog.models.washer import tab_washer
    import pytest

    with pytest.raises(ValueError):
        tab_washer(30.0, 13.0, 1.0, [{"angle": 0, "length": 5.0, "width": 4.5}])   # inner>outer
    with pytest.raises(ValueError):
        tab_washer(13.0, 30.0, 1.0, [])                                            # no tabs
    with pytest.raises(ValueError):
        tab_washer(13.0, 30.0, 0.0, [{"angle": 0, "length": 5.0, "width": 4.5}])   # zero thickness
    with pytest.raises(ValueError):
        tab_washer(13.0, 30.0, 1.0, [{"angle": 0, "length": -1.0, "width": 4.5}])  # bad tab length
    with pytest.raises(ValueError):
        tab_washer(13.0, 30.0, 1.0, [{"angle": 0, "length": 5.0, "width": 0.0}])   # zero tab width
    with pytest.raises(ValueError):
        # thickness wider than the radial land -> a tab would protrude past the far edge
        tab_washer(13.0, 30.0, 12.0, [{"angle": 0, "length": 5.0, "width": 4.5}])


def test_spherical_seating_convex_washer_is_a_domed_ring():
    from catalog.models.washer import spherical_seating_washer, flat_washer

    part = spherical_seating_washer(13.0, 24.0, 4.0, sphere_radius=26.0)   # DIN 6319 Form C
    assert round(part.bounding_box().size.X, 1) == 24.0                    # outer diameter
    assert round(part.bounding_box().size.Z, 1) == 4.0                     # thickness spans Z
    # convex underside removes material toward the rim, so it holds less than a flat annulus
    ring = flat_washer(13.0, 24.0, 4.0)
    assert part.volume < ring.volume
    # flat top sits on z=0, the dome bulges downward (deepest at the bore)
    assert round(part.bounding_box().max.Z, 3) == 0.0
    assert round(part.bounding_box().min.Z, 1) == -4.0


def test_spherical_seating_concave_seat_has_a_recess():
    from catalog.models.washer import spherical_seating_washer, flat_washer

    part = spherical_seating_washer(13.0, 24.0, 3.0, sphere_radius=26.0, concave=True)  # Form D
    assert round(part.bounding_box().size.X, 1) == 24.0
    assert round(part.bounding_box().size.Z, 1) == 3.0
    # the concave recess dishes material out of the top, so it holds less than a flat annulus
    ring = flat_washer(13.0, 24.0, 3.0)
    assert part.volume < ring.volume
    # flat bottom on z=0, recess opens upward
    assert round(part.bounding_box().min.Z, 3) == 0.0


def test_spherical_seating_form_g_flange_widens_the_seat():
    from catalog.models.washer import spherical_seating_washer

    seat_d = spherical_seating_washer(13.0, 24.0, 3.0, sphere_radius=26.0, concave=True)  # Form D
    seat_g = spherical_seating_washer(13.0, 30.0, 3.0, sphere_radius=26.0, concave=True,
                                      seat_diameter=24.0)                                  # Form G
    assert round(seat_g.bounding_box().size.X, 1) == 30.0     # enlarged outer diameter
    # the recess band is identical; Form G only adds a flat flange, so it carries more material
    assert seat_g.volume > seat_d.volume


def test_spherical_seating_guards_bad_geometry():
    from catalog.models.washer import spherical_seating_washer
    import pytest

    with pytest.raises(ValueError):
        spherical_seating_washer(24.0, 13.0, 4.0, sphere_radius=26.0)          # inner > outer
    with pytest.raises(ValueError):
        spherical_seating_washer(13.0, 24.0, 0.0, sphere_radius=26.0)          # zero thickness
    with pytest.raises(ValueError):
        spherical_seating_washer(13.0, 24.0, 4.0, sphere_radius=10.0)          # sphere <= seat radius
    with pytest.raises(ValueError):
        # spherical drop exceeds thickness -> curved face breaks through the flat face
        spherical_seating_washer(13.0, 24.0, 0.5, sphere_radius=26.0)
    with pytest.raises(ValueError):
        # seat_diameter must sit between the bore and the outer diameter
        spherical_seating_washer(13.0, 24.0, 3.0, sphere_radius=26.0, concave=True,
                                 seat_diameter=30.0)
    with pytest.raises(ValueError):
        # seat_diameter has no meaning for a convex washer (no flange) -> rejected
        spherical_seating_washer(13.0, 24.0, 4.0, sphere_radius=26.0, seat_diameter=20.0)


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
    assert build_part("square_washer",
                      {"side": 40.0, "thickness": 4.0, "d_bore": 13.5}).volume > 0
    assert build_part("tab_washer",
                      {"d_inner": 13.0, "d_outer": 30.0, "thickness": 1.2,
                       "tabs": [{"angle": 0, "length": 5.0, "width": 4.5}]}).volume > 0
    assert build_part("spherical_seating_washer",
                      {"d_inner": 13.0, "d_outer": 24.0, "thickness": 4.0,
                       "sphere_radius": 26.0}).volume > 0
    assert build_part("spherical_seating_washer",
                      {"d_inner": 13.0, "d_outer": 24.0, "thickness": 3.0,
                       "sphere_radius": 26.0, "concave": True}).volume > 0
