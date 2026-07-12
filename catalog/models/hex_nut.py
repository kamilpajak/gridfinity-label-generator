"""Hex nut family generator: a chamfered hexagonal nut with a central bore."""
import math

from build123d import (
    BuildPart, BuildSketch, RegularPolygon, Polygon, Cylinder,
    Plane, Axis, Mode, extrude, revolve,
)

# Standard hex-nut chamfer angle, measured from the flat bearing (end) face.
_CHAMFER_ANGLE_DEG = 30.0


def hex_nut(s: float, m: float, bore: float, chamfer: float | None = None):
    """Chamfered hex nut: across-flats ``s``, height ``m``, drawn bore ``bore``.

    ``chamfer`` is the chamfer-circle diameter the top/bottom bevel starts from
    (the flat end-face circle); by ISO it equals the across-flats ``s``, so it
    defaults to ``s``. The nut is oriented vertex-up: a corner points along +X
    (the view's up axis), flats on the left and right (``s`` along Y),
    across-corners (``2s/√3``) along X, height along Z. Matches legacy nut drawings.

    Built as a revolved silhouette (a full-radius body coned down to the chamfer
    circle at each end face) intersected with the hex prism, so the cone bevels
    only the eight corners — producing the arcs across the flats in the face view.
    Revolved surfaces project cleanly (swept/filleted edges can leave a seam).
    """
    if s <= 0 or m <= 0 or bore <= 0:
        raise ValueError(f"hex_nut: need s, m, bore > 0, got s={s}, m={m}, bore={bore}")
    chamfer_d = s if chamfer is None else chamfer
    circumradius = s / math.sqrt(3.0)          # hex corner radius (across-corners / 2)
    r_flat = chamfer_d / 2.0                    # radius of the flat end-face circle
    if bore >= s:
        raise ValueError(f"hex_nut: bore {bore} leaves no wall (>= across-flats {s})")
    if not (0 < r_flat < circumradius):
        raise ValueError(
            f"hex_nut: chamfer circle radius {r_flat} must sit between 0 and the "
            f"corner radius {circumradius:.3f}")
    rise = (circumradius - r_flat) * math.tan(math.radians(_CHAMFER_ANGLE_DEG))
    if 2 * rise >= m:
        raise ValueError(
            f"hex_nut: chamfers ({2 * rise:.3f}) do not fit in height {m}")

    # Silhouette in the XZ half-plane (x = radius, y = height), revolved about Z.
    # Full corner radius at mid-height; coned in to r_flat at each end face.
    profile = [
        (0.0, 0.0),
        (r_flat, 0.0),
        (circumradius, rise),
        (circumradius, m - rise),
        (r_flat, m),
        (0.0, m),
    ]
    # rotation=0: a vertex (corner) points along +X, which is the view's up axis -> vertex-up.
    # The flats then fall on the left/right (±Y), matching the legacy nut drawings.
    with BuildPart() as bp:
        with BuildSketch():
            RegularPolygon(radius=circumradius, side_count=6, rotation=0)
        extrude(amount=m)
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)
        revolve(axis=Axis.Z, revolution_arc=360, mode=Mode.INTERSECT)
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)
    part = bp.part
    if part.volume <= 0:                        # guard on volume, not is_valid (sewn-shell gotcha)
        raise ValueError("hex_nut: produced an empty solid")
    return part
