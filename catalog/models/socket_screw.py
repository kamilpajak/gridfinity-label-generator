"""Socket-head cap screw family generator (ISO 4762 / DIN 912 hex socket, ISO 14579 Torx).

The head is cylindrical (default), a countersunk cone (``head="countersunk"``), or a button
dome (``head="button"``), each carrying the same blind drive socket cut into its top face, over
a smooth cylindrical shank (the shared ``_screw_shank``). The shank is envelope-only (no drawn
thread) and there is no through bore. Two drive recesses match the two end-view silhouettes:
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
    Polygon, Sphere, Box, Locations, Plane, Axis, Align, Mode, add, extrude, revolve,
)

from catalog.models.screw_common import _screw_shank

_MIN_WALL_MM = 0.1                # local min wall (not imported — keep the screw_common-only dep)
_DRIVES = ("hex", "lobular")
_HEAD_SHAPES = ("cylindrical", "countersunk", "button")
_RECESS_EPS = 0.05               # cutter pokes this far above the top face for a clean rim cut
# Representative lobular proportions (fractions of socket_af): six rounded lobes whose tips reach
# socket_af/2, distinct convex bumps (adjacent lobes do NOT touch) connected by a smaller core
# disc that forms the concave valleys between them.
_LOBE_TIP_FRAC = 0.5             # lobe tip radius / socket_af  (overall socket half-width)
_LOBE_R_FRAC = 0.12              # lobe circle radius / socket_af
_CORE_R_FRAC = 0.33              # core disc radius / socket_af
_LOBE_OFFSET_FRAC = _LOBE_TIP_FRAC - _LOBE_R_FRAC   # 0.38: lobe-center radius / socket_af
# Invariant (guards future edits of the fractions above): the core disc must overlap every lobe so
# the core + six lobes form ONE connected region, and adjacent lobes must stay distinct (rounded
# bumps, not merged into a ring). Both hold as fractions of socket_af, so they are size-invariant.
assert _CORE_R_FRAC > _LOBE_OFFSET_FRAC - _LOBE_R_FRAC, "lobular core must overlap the lobes"
assert _LOBE_OFFSET_FRAC > 2.0 * _LOBE_R_FRAC, "lobular lobes must stay distinct"


def socket_screw(dk: float, k: float, length: float, d_shank: float, drive: str,
                 socket_af: float, socket_depth: float, tip_chamfer: float | None = None,
                 head: str = "cylindrical"):
    """Socket-head cap screw: head of diameter ``dk`` and height ``k`` with a blind drive socket
    of nominal across-size ``socket_af`` and depth ``socket_depth`` cut into its top face, over a
    smooth shank of diameter ``d_shank`` and ``length`` (optional lead ``tip_chamfer`` at the free
    end). ``drive`` is ``"hex"`` (hexagonal prism) or ``"lobular"`` (representative rounded
    6-lobe Torx). ``head`` is ``"cylindrical"`` (default), ``"countersunk"`` (cone), or
    ``"button"`` (spherical dome). No through bore, no drawn thread.
    """
    for name, val in (("dk", dk), ("k", k), ("length", length), ("d_shank", d_shank),
                      ("socket_af", socket_af), ("socket_depth", socket_depth)):
        if val <= 0:
            raise ValueError(f"socket_screw: need {name} > 0, got {val}")
    if drive not in _DRIVES:
        raise ValueError(f"socket_screw: drive must be one of {_DRIVES}, got {drive!r}")
    if head not in _HEAD_SHAPES:
        raise ValueError(f"socket_screw: head must be one of {_HEAD_SHAPES}, got {head!r}")
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
        if head == "cylindrical":
            Cylinder(radius=dk / 2.0, height=k,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))    # head z in [0, k]
        elif head == "countersunk":
            # cone frustum: bottom radius d_shank/2 at z=0, up to top radius dk/2 at z=k, flat top
            # (carriage_bolt countersunk-cone idiom). Using tabulated dk/k directly makes the slant
            # approximate the nominal 90-degree countersink (representative envelope simplification).
            profile = [(d_shank / 2.0, 0.0), (dk / 2.0, k), (0.0, k), (0.0, 0.0)]
            with BuildSketch(Plane.XZ):
                Polygon(*profile, align=None)
            revolve(axis=Axis.Z, revolution_arc=360)                   # head z in [0, k]
        else:                                                          # button: spherical dome
            # spherical cap: base circle radius dk/2 at z=0, apex at z=k (cap_nut idiom). The small
            # cylindrical base belt of a real button head is omitted (envelope simplification).
            r_base = dk / 2.0
            sphere_r = (r_base ** 2 + k ** 2) / (2.0 * k)
            z_c = k - sphere_r                                         # sphere centre on Z
            big = 4.0 * (sphere_r + k)                                 # trim box, larger than cap
            with Locations((0.0, 0.0, z_c)):
                Sphere(radius=sphere_r)
            with Locations((0.0, 0.0, -big / 2.0)):
                Box(big, big, big, mode=Mode.SUBTRACT)                 # keep only z >= 0
        add(shank)                                                     # shares the z=0 face -> fuses
        with BuildSketch(Plane.XY.offset(floor_z)):                # socket cross-section at floor
            if drive == "hex":
                RegularPolygon(radius=socket_af / 2.0, side_count=6,
                               major_radius=False)                 # across-flats = socket_af
            else:
                Circle(radius=_CORE_R_FRAC * socket_af)            # connecting core disc
                with PolarLocations(_LOBE_OFFSET_FRAC * socket_af, 6):
                    Circle(radius=_LOBE_R_FRAC * socket_af)        # six rounded lobes, unioned
        extrude(amount=socket_depth + _RECESS_EPS, mode=Mode.SUBTRACT)   # blind socket from top
    part = bp.part
    if part.volume <= 0:                                 # net guard (not is_valid — sewn-shell)
        raise ValueError("socket_screw: produced an empty solid")
    if len(part.solids()) != 1:                          # head and shank must FUSE, not just touch
        raise ValueError("socket_screw: head and shank did not fuse into a single solid")
    return part
