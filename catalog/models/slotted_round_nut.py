"""Slotted round nut family generator (DIN 981 bearing locknut, DIN 70852 groove nut).

A round cylindrical body with N full-height radial slots cut into the outer diameter (for a
hook or face spanner) and a through bore. The slots are the drive feature; the din981 bearing
locknut's internal keyway is NOT modelled (a minor internal feature that would break the
body's rotational symmetry). Only the metal envelope is drawn.
"""
import math

from build123d import BuildPart, Cylinder, Box, PolarLocations, Mode

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def slotted_round_nut(d: float, h: float, bore: float, n_slots: int,
                      slot_w: float, slot_depth: float):
    """Round nut of outer diameter ``d`` and height ``h`` with a through ``bore`` and
    ``n_slots`` full-height radial slots of width ``slot_w`` cut ``slot_depth`` into the OD.

    Body is a ``Cylinder`` centred on the origin; each slot is a ``Box`` subtracted at the OD
    via ``PolarLocations`` (first slot on +X, the view's up axis); the bore is subtracted last
    (like ``hex_nut``). Rotationally symmetric at the N slot positions — no preset change.
    """
    for name, val in (("d", d), ("h", h), ("bore", bore), ("slot_w", slot_w),
                      ("slot_depth", slot_depth)):
        if val <= 0:
            raise ValueError(f"slotted_round_nut: need {name} > 0, got {val}")
    if n_slots < 1 or int(n_slots) != n_slots:
        raise ValueError(f"slotted_round_nut: n_slots must be a positive integer, got {n_slots}")
    if bore >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"slotted_round_nut: bore {bore} leaves too thin a wall vs OD {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")
    if slot_depth >= d / 2.0 - bore / 2.0 - _MIN_WALL_MM:
        raise ValueError(
            f"slotted_round_nut: slot_depth {slot_depth} reaches the bore wall "
            f"(needs < d/2 - bore/2 - {_MIN_WALL_MM} = {d / 2.0 - bore / 2.0 - _MIN_WALL_MM:.3f} mm)")
    if n_slots * slot_w >= math.pi * d:
        raise ValueError(
            f"slotted_round_nut: {n_slots} slots of width {slot_w} exceed the circumference "
            f"{math.pi * d:.3f} (no towers would survive)")

    with BuildPart() as bp:
        Cylinder(radius=d / 2.0, height=h)                 # Align.CENTER: spans z in [-h/2, h/2]
        with PolarLocations(d / 2.0, int(n_slots), start_angle=0.0):
            Box(2.0 * slot_depth, slot_w, h * 2.0, mode=Mode.SUBTRACT)   # radial notch, full height
        Cylinder(radius=bore / 2.0, height=h * 3.0, mode=Mode.SUBTRACT)  # through bore, last
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("slotted_round_nut: produced an empty solid")
    return part
