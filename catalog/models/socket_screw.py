"""Socket-head cap screw family generator (ISO 4762 / DIN 912 hex socket, ISO 14579 Torx).

A plain cylindrical head with a BLIND drive socket cut into its top face, over a smooth
cylindrical shank (the shared ``_screw_shank``). The shank is envelope-only (no drawn thread)
and there is no through bore. Two drive recesses match the two end-view silhouettes:
``drive="hex"`` subtracts a hexagonal prism (an Allen socket); ``drive="lobular"`` subtracts a
representative rounded 6-lobe region (a Torx socket).

The lobular region is a REPRESENTATIVE icon (a core disc unioned with six rounded lobes), not
the dimensioned ISO 10664 curve and never a sharp 6-point star — its proportions are chosen so
the socket reads as a Torx at label scale (see THIRD-PARTY-NOTICES.md, FreeCAD Fasteners
Workbench / ISO 10664). Modelled axis-along-Z: the head sits z in [0, k] (bearing face on z=0),
the shank z in [-length, 0]; under the default camera the front view is the socket end view and
the side view is the horizontal head+shank elevation.
"""
import math

from build123d import (
    BuildPart, BuildSketch, Cylinder, Circle, RegularPolygon, PolarLocations,
    Plane, Align, Mode, add, extrude,
)

from catalog.models.screw_common import _screw_shank

_MIN_WALL_MM = 0.1                # local min wall (not imported — keep the screw_common-only dep)
_DRIVES = ("hex", "lobular")
_RECESS_EPS = 0.05               # cutter pokes this far above the top face for a clean rim cut
# Representative lobular proportions (fractions of socket_af): six rounded lobes whose tips reach
# socket_af/2, distinct convex bumps (adjacent lobes do NOT touch) connected by a smaller core
# disc that forms the concave valleys between them.
_LOBE_TIP_FRAC = 0.5             # lobe tip radius / socket_af  (overall socket half-width)
_LOBE_R_FRAC = 0.12              # lobe circle radius / socket_af
_CORE_R_FRAC = 0.33              # core disc radius / socket_af


def socket_screw(dk: float, k: float, length: float, d_shank: float, drive: str,
                 socket_af: float, socket_depth: float, tip_chamfer: float | None = None):
    """Socket-head cap screw: cylindrical head of diameter ``dk`` and height ``k`` with a blind
    drive socket of nominal across-size ``socket_af`` and depth ``socket_depth`` cut into its top
    face, over a smooth shank of diameter ``d_shank`` and ``length`` (optional lead
    ``tip_chamfer`` at the free end). ``drive`` is ``"hex"`` (hexagonal prism) or ``"lobular"``
    (representative rounded 6-lobe Torx). No through bore, no drawn thread.
    """
    for name, val in (("dk", dk), ("k", k), ("length", length), ("d_shank", d_shank),
                      ("socket_af", socket_af), ("socket_depth", socket_depth)):
        if val <= 0:
            raise ValueError(f"socket_screw: need {name} > 0, got {val}")
    if drive not in _DRIVES:
        raise ValueError(f"socket_screw: drive must be one of {_DRIVES}, got {drive!r}")
    if d_shank >= dk:
        raise ValueError(
            f"socket_screw: d_shank {d_shank} must be < head diameter {dk} (the shank emerges "
            f"from the head bearing face and is narrower than the head)")
    socket_outer_r = socket_af / math.sqrt(3.0) if drive == "hex" else _LOBE_TIP_FRAC * socket_af
    if socket_outer_r >= dk / 2.0 - _MIN_WALL_MM:
        raise ValueError(
            f"socket_screw: {drive} socket of across-size {socket_af} reaches radius "
            f"{socket_outer_r:.3f} which leaves too thin a wall vs head radius {dk / 2.0} "
            f"(needs < dk/2 - {_MIN_WALL_MM} mm)")
    if socket_depth >= k:
        raise ValueError(
            f"socket_screw: socket_depth {socket_depth} must be < head height {k} "
            f"(the socket is blind — a floor of head metal must remain below it)")

    shank = _screw_shank(d_shank, length, tip_chamfer)   # z in [-length, 0], validates chamfer
    floor_z = k - socket_depth                           # socket floor plane (z > 0 by the guard)
    with BuildPart() as bp:
        Cylinder(radius=dk / 2.0, height=k,
                 align=(Align.CENTER, Align.CENTER, Align.MIN))    # head z in [0, k]
        add(shank)                                                 # shares the z=0 face -> fuses
        with BuildSketch(Plane.XY.offset(floor_z)):                # socket cross-section at floor
            if drive == "hex":
                RegularPolygon(radius=socket_af / 2.0, side_count=6,
                               major_radius=False)                 # across-flats = socket_af
            else:
                Circle(radius=_CORE_R_FRAC * socket_af)            # connecting core disc
                offset = _LOBE_TIP_FRAC * socket_af - _LOBE_R_FRAC * socket_af
                with PolarLocations(offset, 6):
                    Circle(radius=_LOBE_R_FRAC * socket_af)        # six rounded lobes, unioned
        extrude(amount=socket_depth + _RECESS_EPS, mode=Mode.SUBTRACT)   # blind socket from top
    part = bp.part
    if part.volume <= 0:                                 # net guard (not is_valid — sewn-shell)
        raise ValueError("socket_screw: produced an empty solid")
    if len(part.solids()) != 1:                          # head and shank must FUSE, not just touch
        raise ValueError("socket_screw: head and shank did not fuse into a single solid")
    return part
