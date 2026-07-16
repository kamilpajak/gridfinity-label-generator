"""Slotted round nut family generator (DIN 546, screwdriver slot).

A round cylindrical body with a single straight slot cut diametrically across the top face
(a screwdriver drive) and a through bore. The slot opens from the top face to a partial axial
depth ``slot_depth`` — the DIN 546 slot does NOT run the full nut height (the tabulated slot
depth t is well under the height m). Only the metal envelope is drawn (no thread, no chamfer).
"""
from build123d import BuildPart, Cylinder, Box, Locations, Mode

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def slotted_face_nut(d: float, h: float, bore: float, slot_w: float, slot_depth: float):
    """Round nut of outer diameter ``d`` and height ``h`` with a through ``bore`` and one
    straight slot of width ``slot_w`` cut ``slot_depth`` into the top face, running the full
    diameter along X (a screwdriver slot, partial-depth — it opens from the top face only).

    Body is a ``Cylinder`` centred on the origin; the slot is a single ``Box`` subtracted at
    the top face, its length overshooting both rim edges and its upper half overshooting above
    the nut so only the top ``slot_depth`` is removed; the bore is subtracted last (like
    ``hex_nut``). Rotationally framed with the slot on X — no preset change.
    """
    for name, val in (("d", d), ("h", h), ("bore", bore),
                      ("slot_w", slot_w), ("slot_depth", slot_depth)):
        if val <= 0:
            raise ValueError(f"slotted_face_nut: need {name} > 0, got {val}")
    if slot_depth >= h - _MIN_WALL_MM:
        raise ValueError(
            f"slotted_face_nut: slot_depth {slot_depth} leaves too thin a floor vs height {h} "
            f"(needs < h - {_MIN_WALL_MM} mm; the slot opens from the top face only)")
    if slot_w >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"slotted_face_nut: slot_w {slot_w} leaves too thin a rim vs OD {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")
    if bore >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"slotted_face_nut: bore {bore} leaves too thin a wall vs OD {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")

    with BuildPart() as bp:
        Cylinder(radius=d / 2.0, height=h)                 # Align.CENTER: spans z in [-h/2, h/2]
        with Locations((0.0, 0.0, h / 2.0)):               # slot box centred on the top face
            Box(2.0 * d, slot_w, 2.0 * slot_depth, mode=Mode.SUBTRACT)  # diametral, opens from top
        Cylinder(radius=bore / 2.0, height=h * 3.0, mode=Mode.SUBTRACT)  # through bore, last
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("slotted_face_nut: produced an empty solid")
    return part
