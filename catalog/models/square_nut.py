"""Square nut family generator: a flat-up square prism with a through bore and an optional top-only chamfer."""
import math

from build123d import (
    BuildPart, BuildSketch, RegularPolygon, Polygon, Cylinder,
    Plane, Axis, Mode, extrude, revolve,
)

from catalog.models.hex_nut import _MIN_WALL_MM

# Standard square-nut top chamfer angle, measured from the bearing face (matches the hex family).
_CHAMFER_ANGLE_DEG = 30.0


def square_nut(s: float, m: float, bore: float, chamfer: float | None = None):
    """Square nut: across-flats ``s`` (the square side), height ``m``, drawn bore ``bore``.

    Vertex-up (a corner points along +X, the view's up axis, matching the hex nuts), so the
    plan bounding box is the across-corners ``s*sqrt(2)`` on both axes. A plain
    prism when ``chamfer`` is None (e.g. DIN 928); when ``chamfer`` is the top chamfer-circle
    diameter (ISO default ``s``, e.g. DIN 557) the TOP face corners bevel in to the chamfer
    circle while the bearing (bottom) face stays a sharp full square. Bore subtracted last,
    like ``hex_nut``.
    """
    if s <= 0 or m <= 0:
        raise ValueError(f"square_nut: need s, m > 0, got s={s}, m={m}")
    if bore <= 0:
        raise ValueError(f"square_nut: need bore > 0, got {bore}")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"square_nut: bore {bore} leaves too thin a wall (needs < across-flats {s} "
            f"by at least {_MIN_WALL_MM} mm)")

    circumradius = s / math.sqrt(2.0)          # square across-corners / 2 (half-diagonal)
    rise = 0.0
    profile = None
    if chamfer is not None:
        r_flat = chamfer / 2.0                 # radius of the top chamfer circle
        if not (0 < r_flat < circumradius):
            raise ValueError(
                f"square_nut: chamfer circle radius {r_flat} must sit between 0 and the "
                f"corner radius {circumradius:.3f}")
        rise = (circumradius - r_flat) * math.tan(math.radians(_CHAMFER_ANGLE_DEG))
        if rise >= m:
            raise ValueError(f"square_nut: top chamfer ({rise:.3f}) does not fit in height {m}")
        # Meridian (x = radius, z = height): full radius up to m-rise, then cone in to r_flat
        # at the top face. Bottom stays at the full corner radius -> sharp square bearing face.
        profile = [(0.0, 0.0), (circumradius, 0.0), (circumradius, m - rise),
                   (r_flat, m), (0.0, m)]

    with BuildPart() as bp:
        with BuildSketch():
            RegularPolygon(radius=circumradius, side_count=4, rotation=0)   # vertex-up (corner on +X)
        extrude(amount=m)
        if profile is not None:
            with BuildSketch(Plane.XZ):
                Polygon(*profile, align=None)
            revolve(axis=Axis.Z, revolution_arc=360, mode=Mode.INTERSECT)    # top-only bevel
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)         # through bore, last
    part = bp.part
    if part.volume <= 0:                        # net guard (matches hex_nut/flange_nut)
        raise ValueError("square_nut: produced an empty solid")
    return part
