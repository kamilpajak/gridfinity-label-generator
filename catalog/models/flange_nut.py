"""Flange nut family generator: a chamfered hex body with a conical flange at the base."""
import math

from build123d import (
    BuildPart, BuildSketch, Polygon, Cylinder, Plane, Axis, Mode, revolve, add,
)

from catalog.models.hex_nut import _chamfered_hex_solid, _MIN_WALL_MM

# Representative flange-cone angle (from horizontal) for the tapered top surface of the
# flange, used where a table does not publish the internal cone. The tabulated dimensions
# (s, m, d_flange, flange_thickness, bore) are always sourced; only this transition is
# representative.
_FLANGE_CONE_ANGLE_DEG = 20.0


def flange_nut(s: float, m: float, bore: float, d_flange: float,
               flange_thickness: float, chamfer: float | None = None):
    """Hex flange nut: across-flats ``s``, total height ``m``, drawn bore ``bore``,
    conical flange of outer diameter ``d_flange`` and rim thickness ``flange_thickness``.

    A shared chamfered vertex-up hex body (``_chamfered_hex_solid``) with a revolved
    conical flange unioned at the base: a flat bearing bottom of diameter ``d_flange``
    and rim thickness ``flange_thickness`` whose top cones inward and up to meet the hex
    corner circle. Bore subtracted through both.
    """
    if bore <= 0:
        raise ValueError(f"flange_nut: need bore > 0, got {bore}")
    if bore >= s - _MIN_WALL_MM:
        # The thinnest wall on a flange nut is at the hex flats (the flange is wider),
        # so the across-flats `s` sets the wall limit — same convention as hex_nut.
        raise ValueError(
            f"flange_nut: bore {bore} leaves too thin a wall across the hex flats "
            f"(across-flats {s})")
    circumradius = s / math.sqrt(3.0)
    if d_flange <= 2 * circumradius:
        raise ValueError(
            f"flange_nut: d_flange {d_flange} must exceed the hex across-corners "
            f"{2 * circumradius:.3f} (else there is no flange)")
    if flange_thickness <= 0:
        raise ValueError(f"flange_nut: flange_thickness must be > 0, got {flange_thickness}")
    r_flange = d_flange / 2.0
    rise = (r_flange - circumradius) * math.tan(math.radians(_FLANGE_CONE_ANGLE_DEG))
    flange_top = flange_thickness + rise
    if flange_top >= m:
        raise ValueError(
            f"flange_nut: flange ({flange_top:.3f}) leaves no hex above height {m}")

    # Flange silhouette in the XZ half-plane (x = radius, y = height), revolved about Z:
    # flat bearing bottom out to the rim, up the thin rim edge, then coning inward and up
    # to the hex corner circle. The profile deliberately touches the Z axis at both ends
    # (x=0); build123d revolves it to a sound solid (the volume guard below is the net).
    flange_profile = [
        (0.0, 0.0),
        (r_flange, 0.0),
        (r_flange, flange_thickness),
        (circumradius, flange_top),
        (0.0, flange_top),
    ]
    hex_solid = _chamfered_hex_solid(s, m, chamfer)
    with BuildPart() as bp:
        add(hex_solid)
        with BuildSketch(Plane.XZ):
            Polygon(*flange_profile, align=None)
        revolve(axis=Axis.Z, revolution_arc=360)          # Mode.ADD (union) by default
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)
    part = bp.part
    if part.volume <= 0:
        raise ValueError("flange_nut: produced an empty solid")
    return part
