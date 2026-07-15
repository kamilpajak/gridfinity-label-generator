"""Slotted round nut family generator (DIN 981 bearing locknut, DIN 70852 groove nut).

A round cylindrical body with N radial slots cut into the outer diameter (for a hook or face
spanner) and a through bore. The slots open from the top face to a partial axial depth
``slot_h`` — the DIN 981/70852 spanner grooves do NOT run the full nut height (the tabulated
axial dimension t/c is well under the height h). The din981 internal keyway is NOT modelled
(a minor internal feature that would break the body's rotational symmetry). Only the metal
envelope is drawn.
"""
import math

from build123d import BuildPart, Cylinder, Box, Locations, PolarLocations, Mode

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def slotted_round_nut(d: float, h: float, bore: float, n_slots: int,
                      slot_w: float, slot_depth: float, slot_h: float):
    """Round nut of outer diameter ``d`` and height ``h`` with a through ``bore`` and
    ``n_slots`` radial slots of width ``slot_w`` cut ``slot_depth`` into the OD, each opening
    from the top face to axial depth ``slot_h`` (the spanner grooves are partial-depth, not
    full-height).

    Body is a ``Cylinder`` centred on the origin; each slot is a ``Box`` subtracted at the OD
    via ``PolarLocations`` and centred on the top face so it removes material only over the top
    ``slot_h`` (first slot on +X, the view's up axis); the bore is subtracted last (like
    ``hex_nut``). Rotationally symmetric at the N slot positions — no preset change.
    """
    for name, val in (("d", d), ("h", h), ("bore", bore), ("slot_w", slot_w),
                      ("slot_depth", slot_depth), ("slot_h", slot_h)):
        if val <= 0:
            raise ValueError(f"slotted_round_nut: need {name} > 0, got {val}")
    if n_slots < 1 or int(n_slots) != n_slots:
        raise ValueError(f"slotted_round_nut: n_slots must be a positive integer, got {n_slots}")
    if slot_h > h:
        raise ValueError(
            f"slotted_round_nut: slot_h {slot_h} exceeds the nut height {h} (slot opens from one face)")
    if bore >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"slotted_round_nut: bore {bore} leaves too thin a wall vs OD {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")
    if slot_depth >= d / 2.0 - bore / 2.0 - _MIN_WALL_MM:
        raise ValueError(
            f"slotted_round_nut: slot_depth {slot_depth} reaches the bore wall "
            f"(needs < d/2 - bore/2 - {_MIN_WALL_MM} = {d / 2.0 - bore / 2.0 - _MIN_WALL_MM:.3f} mm)")
    # slot-floor diameter — the tightest circumference the towers must fit around; positive
    # because the slot_depth guard above keeps d - 2*slot_depth > bore + 2*_MIN_WALL_MM.
    floor_d = d - 2.0 * slot_depth
    if n_slots * slot_w >= math.pi * floor_d:
        raise ValueError(
            f"slotted_round_nut: {n_slots} slots of width {slot_w} exceed the slot-floor "
            f"circumference {math.pi * floor_d:.3f} (no towers would survive)")

    with BuildPart() as bp:
        Cylinder(radius=d / 2.0, height=h)                 # Align.CENTER: spans z in [-h/2, h/2]
        with Locations((0.0, 0.0, h / 2.0)):               # slot boxes centred on the top face
            with PolarLocations(d / 2.0, int(n_slots), start_angle=0.0):
                Box(2.0 * slot_depth, slot_w, slot_h * 2.0, mode=Mode.SUBTRACT)  # opens from top, depth slot_h
        Cylinder(radius=bore / 2.0, height=h * 3.0, mode=Mode.SUBTRACT)  # through bore, last
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("slotted_round_nut: produced an empty solid")
    return part
