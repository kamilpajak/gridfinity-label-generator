"""Hex-socket set screw (grub screw) family generator (DIN 913/914/915/916, ISO 4026-4029).

A headless smooth cylinder (envelope-only, no drawn thread) with a BLIND hex socket in the top
(+Z) end and a point feature at the bottom (-Z) end. The four standards differ only by the point,
so ``point`` selects the tip silhouette: ``"flat"`` (din913), ``"cone"`` (din914), ``"dog"``
(din915), ``"cup"`` (din916). Modelled axis-along-Z: the body sits z in [0, length]; under the
default camera the front view is the hex-socket end view and the side view is the horizontal
cylinder+point elevation.

The body + point is one revolve of a point-specific outer meridian in the XZ plane (the same
deterministic technique as ``_screw_shank`` — no fragile edge selection); ``cup`` expresses its
annular rim + conical recess directly in that meridian, so every point is one revolve + one hex
socket subtract. The hex-socket cut is the same idiom as ``socket_screw`` but is reimplemented
here so this generator stays self-contained (no dependency on socket_screw / screw_common).
"""
import math

from build123d import (
    BuildPart, BuildSketch, Polygon, RegularPolygon, Plane, Axis, Mode, revolve, extrude,
)

_MIN_WALL_MM = 0.1               # local min wall (self-contained generator)
_POINTS = ("flat", "cone", "dog", "cup")
_RECESS_EPS = 0.05               # socket cutter overshoot above the top face for a clean rim cut


def set_screw(d: float, length: float, socket_af: float, socket_depth: float, point: str,
              point_h: float | None = None, point_d: float | None = None,
              tip_chamfer: float | None = None):
    """Headless hex-socket set screw: cylinder of diameter ``d`` and ``length`` with a blind hex
    socket (across-flats ``socket_af``, depth ``socket_depth``) in the top face and a ``point`` at
    the bottom. ``point``: "flat" (optional 45-degree ``tip_chamfer`` edge break), "cone" (tapers
    to a flat tip of diameter ``point_d`` over axial ``point_h``), "dog" (a cylindrical pilot of
    diameter ``point_d`` and length ``point_h``), or "cup" (a conical recess of mouth diameter
    ``point_d`` and depth ``point_h``, leaving an annular rim). No drawn thread.
    """
    for name, val in (("d", d), ("length", length), ("socket_af", socket_af),
                      ("socket_depth", socket_depth)):
        if val <= 0:
            raise ValueError(f"set_screw: need {name} > 0, got {val}")
    if point not in _POINTS:
        raise ValueError(f"set_screw: point must be one of {_POINTS}, got {point!r}")
    if socket_af / math.sqrt(3.0) >= d / 2.0 - _MIN_WALL_MM:
        raise ValueError(
            f"set_screw: hex socket across-flats {socket_af} (corner radius "
            f"{socket_af / math.sqrt(3.0):.3f}) leaves too thin a wall vs body radius {d / 2.0} "
            f"(needs corner < d/2 - {_MIN_WALL_MM} mm)")

    shaped = point in ("cone", "dog", "cup")
    if shaped:
        if point_h is None or point_d is None or point_h <= 0 or point_d <= 0:
            raise ValueError(
                f"set_screw: {point} point needs point_h > 0 and point_d > 0, "
                f"got point_h={point_h}, point_d={point_d}")
        if point_d >= d:
            raise ValueError(f"set_screw: point_d {point_d} must be < body d {d}")
        if point_h >= length:
            raise ValueError(f"set_screw: point_h {point_h} must be < length {length}")
    if point != "flat" and tip_chamfer is not None:
        raise ValueError("set_screw: tip_chamfer applies only to the flat point")
    if tip_chamfer is not None and not (0.0 < tip_chamfer < d / 2.0 and tip_chamfer < length):
        raise ValueError(
            f"set_screw: tip_chamfer {tip_chamfer} must be > 0 and < d/2 and < length")

    point_h_eff = point_h if shaped else 0.0
    if socket_depth >= length - point_h_eff:
        raise ValueError(
            f"set_screw: socket_depth {socket_depth} collides with the point (needs a solid core: "
            f"socket_depth < length - point-height = {length - point_h_eff})")

    r = d / 2.0
    # Outer meridian in XZ (x=radius, z=axial): body z in [0, length], point at the z=0 end.
    if point == "cone":
        profile = [(0.0, length), (r, length), (r, point_h), (point_d / 2.0, 0.0), (0.0, 0.0)]
    elif point == "dog":
        profile = [(0.0, length), (r, length), (r, point_h),
                   (point_d / 2.0, point_h), (point_d / 2.0, 0.0), (0.0, 0.0)]
    elif point == "cup":                                     # rim at z=0, conical recess to apex
        profile = [(0.0, length), (r, length), (r, 0.0), (point_d / 2.0, 0.0), (0.0, point_h)]
    elif tip_chamfer is not None:                            # flat with a 45-degree edge break
        c = tip_chamfer
        profile = [(0.0, length), (r, length), (r, c), (r - c, 0.0), (0.0, 0.0)]
    else:                                                    # plain flat
        profile = [(0.0, length), (r, length), (r, 0.0), (0.0, 0.0)]

    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)                    # explicit coords -> no auto-centring
        revolve(axis=Axis.Z, revolution_arc=360)             # body + point, one solid
        with BuildSketch(Plane.XY.offset(length - socket_depth)):   # hex socket at its floor
            RegularPolygon(radius=socket_af / 2.0, side_count=6, major_radius=False)
        extrude(amount=socket_depth + _RECESS_EPS, mode=Mode.SUBTRACT)   # blind socket from top
    part = bp.part
    if part.volume <= 0:                                     # net guard (not is_valid — sewn-shell)
        raise ValueError("set_screw: produced an empty solid")
    if len(part.solids()) != 1:                             # must be a single fused solid
        raise ValueError("set_screw: produced more than one solid")
    return part
