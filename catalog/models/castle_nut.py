"""Castle / slotted nut family generator: chamfered hex body with a slotted cylindrical crown and a through bore."""
import math

from build123d import (
    BuildPart, Cylinder, Box, Locations, PolarLocations, Align, Mode, add,
)

from catalog.models.hex_nut import _chamfered_hex_solid, _MIN_WALL_MM

# First slot centred on +X (the vertex-up view's up axis); the rest at k*360/n_slots.
# Clocking is cosmetic here: every crown is narrower than the hex inscribed circle, so
# the slots stay inside the crown and never reach the hex flats/corners.
_SLOT_START_DEG = 0.0


def castle_nut(s: float, m: float, bore: float, dk: float, m1: float,
               n_slots: int, e: float, chamfer: float | None = None):
    """Castle / slotted nut: across-flats ``s``, total height ``m``, drawn bore ``bore``,
    cylindrical crown of diameter ``dk`` above the un-slotted height ``m1``, with
    ``n_slots`` rectangular slots of width ``e`` cut through the crown.

    A shared chamfered vertex-up hex body (``_chamfered_hex_solid``) of height ``m1`` with
    a ``dk`` crown unioned on top (z=m1..m); ``n_slots`` flat-bottom radial slots (floor
    at z=m1) subtracted from the crown; a through bore subtracted last like ``hex_nut``.
    The crown is fully slotted (no solid crown band below the slots) — a documented
    envelope simplification, since no table publishes the hex/crown transition height.
    """
    if bore <= 0:
        raise ValueError(f"castle_nut: need bore > 0, got {bore}")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"castle_nut: bore {bore} leaves too thin a wall (needs < across-flats {s} "
            f"by at least {_MIN_WALL_MM} mm)")
    if not (0 < m1 < m):
        raise ValueError(f"castle_nut: need 0 < m1 < m, got m1={m1}, m={m}")
    if dk > s:
        raise ValueError(
            f"castle_nut: crown dk {dk} exceeds across-flats {s} (crown must sit within the hex)")
    if dk <= bore:
        raise ValueError(
            f"castle_nut: crown dk {dk} must exceed bore {bore} (a crown wall must remain)")
    if not (0 < e < dk):
        raise ValueError(f"castle_nut: need 0 < slot width e < dk, got e={e}, dk={dk}")
    if n_slots < 1 or int(n_slots) != n_slots:
        raise ValueError(f"castle_nut: n_slots must be a positive integer, got {n_slots}")
    if n_slots * e >= math.pi * dk:
        raise ValueError(
            f"castle_nut: {n_slots} slots of width {e} exceed the crown circumference "
            f"(no castellation towers would survive)")

    hex_solid = _chamfered_hex_solid(s, m1, chamfer)   # validates s, m1, chamfer geometry
    crown_h = m - m1
    margin = 0.5 * (dk + m)                # generous build overshoot (not a physical value)
    slot_len = dk / 2.0 + margin           # from the axis out past the crown surface
    slot_hh = crown_h + margin             # overshoot the top only; floor stays at m1
    slot_zc = m1 + slot_hh / 2.0           # box centred so its bottom face is exactly at z=m1

    with BuildPart() as bp:
        add(hex_solid)
        with Locations((0.0, 0.0, m1)):    # crown base on the hex top face
            Cylinder(radius=dk / 2.0, height=crown_h,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))
        with Locations((0.0, 0.0, slot_zc)):
            with PolarLocations(slot_len / 2.0, int(n_slots), start_angle=_SLOT_START_DEG):
                Box(slot_len, e, slot_hh, mode=Mode.SUBTRACT)   # radial flat-bottom slot
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)   # through bore, last
    part = bp.part
    if part.volume <= 0:                   # net guard (matches hex_nut/flange_nut/cap_nut)
        raise ValueError("castle_nut: produced an empty solid")
    return part
