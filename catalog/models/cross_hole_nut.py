"""Cross-hole round nut family generator (DIN 1816, Kreuzlochmutter).

A round cylindrical body with N radial holes drilled into the outer wall (perpendicular to
the axis, for a pin / tommy-bar spanner) and a through bore. The holes sit at mid-height and
open on the OD surface. Only the metal envelope is drawn (no thread, no chamfer). The holes
are the defining drive feature — NOT axial holes in the top face.
"""
import math

from build123d import BuildPart, Cylinder, PolarLocations, Mode

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def cross_hole_nut(d: float, h: float, bore: float, n_holes: int,
                   hole_d: float, hole_depth: float):
    """Round nut of outer diameter ``d`` and height ``h`` with a through ``bore`` and
    ``n_holes`` radial holes of diameter ``hole_d`` drilled ``hole_depth`` into the OD wall at
    mid-height (a pin-spanner drive; first hole on +X).

    Body is a ``Cylinder`` centred on the origin; each hole is a ``Cylinder`` whose axis is
    rotated onto local X (``rotation=(0, 90, 0)``) and placed radially by ``PolarLocations``
    (its ``rotate=True`` frame points local X outward), centred at the OD so it reaches
    ``hole_depth`` into the wall; the bore is subtracted last (like ``hex_nut``). Rotationally
    symmetric at the N hole positions — no preset change.
    """
    for name, val in (("d", d), ("h", h), ("bore", bore),
                      ("hole_d", hole_d), ("hole_depth", hole_depth)):
        if val <= 0:
            raise ValueError(f"cross_hole_nut: need {name} > 0, got {val}")
    if n_holes < 1 or int(n_holes) != n_holes:
        raise ValueError(f"cross_hole_nut: n_holes must be a positive integer, got {n_holes}")
    if hole_d >= h - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"cross_hole_nut: hole_d {hole_d} leaves too thin a band vs height {h} "
            f"(needs < h - {2.0 * _MIN_WALL_MM} mm; the hole leaves a wall above and below)")
    if hole_depth >= d / 2.0 - bore / 2.0 - _MIN_WALL_MM:
        raise ValueError(
            f"cross_hole_nut: hole_depth {hole_depth} reaches the bore wall "
            f"(needs < d/2 - bore/2 - {_MIN_WALL_MM} = {d / 2.0 - bore / 2.0 - _MIN_WALL_MM:.3f} mm)")
    if n_holes * hole_d >= math.pi * d:
        raise ValueError(
            f"cross_hole_nut: {n_holes} holes of diameter {hole_d} exceed the OD "
            f"circumference {math.pi * d:.3f} (no towers would survive)")
    if bore >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"cross_hole_nut: bore {bore} leaves too thin a wall vs OD {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")

    with BuildPart() as bp:
        Cylinder(radius=d / 2.0, height=h)                 # Align.CENTER: spans z in [-h/2, h/2]
        with PolarLocations(d / 2.0, int(n_holes), start_angle=0.0):
            # axis rotated onto local X -> radial (PolarLocations points local X outward);
            # centred at the OD, height 2*hole_depth reaches hole_depth into the wall.
            Cylinder(radius=hole_d / 2.0, height=2.0 * hole_depth,
                     rotation=(0.0, 90.0, 0.0), mode=Mode.SUBTRACT)
        Cylinder(radius=bore / 2.0, height=h * 3.0, mode=Mode.SUBTRACT)  # through bore, last
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("cross_hole_nut: produced an empty solid")
    return part
