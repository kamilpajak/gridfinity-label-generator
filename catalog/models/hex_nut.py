"""Hex nut family generator: a chamfered hexagonal nut with a central bore."""
import math

from build123d import (
    BuildPart, BuildSketch, RegularPolygon, Polygon, Cylinder,
    Plane, Axis, Mode, extrude, revolve, add,
)

# Standard hex-nut chamfer angle (ISO 4032 and its family), measured from the
# flat bearing (end) face. A non-standard nut needing a different angle would
# pass its own value rather than change this constant.
_CHAMFER_ANGLE_DEG = 30.0

# Leave at least this much wall between the bore and the across-flats faces, so a
# near-tangent bore cannot leave a razor-thin sliver the volume check would miss.
_MIN_WALL_MM = 0.1


def _chamfered_hex_solid(s: float, m: float, chamfer: float | None = None):
    """The vertex-up chamfered hexagonal body (no bore), shared by hex_nut and flange_nut.

    across-flats ``s``, height ``m``, top/bottom chamfer from the ``chamfer``-diameter
    circle (defaults to ``s``). Oriented vertex-up: a corner points along +X (the view's
    up axis), flats on the left/right (``s`` along Y), across-corners (``2s/√3``) along X.
    Built as a revolved silhouette (full corner radius coned to the chamfer circle at each
    end face) intersected with the hex prism, so only the corners are beveled.
    """
    if s <= 0 or m <= 0:
        raise ValueError(f"chamfered hex: need s, m > 0, got s={s}, m={m}")
    chamfer_d = s if chamfer is None else chamfer
    circumradius = s / math.sqrt(3.0)          # hex corner radius (across-corners / 2)
    r_flat = chamfer_d / 2.0                    # radius of the flat end-face circle
    if not (0 < r_flat < circumradius):
        raise ValueError(
            f"chamfered hex: chamfer circle radius {r_flat} must sit between 0 and the "
            f"corner radius {circumradius:.3f}")
    rise = (circumradius - r_flat) * math.tan(math.radians(_CHAMFER_ANGLE_DEG))
    if 2 * rise >= m:
        raise ValueError(f"chamfered hex: chamfers ({2 * rise:.3f}) do not fit in height {m}")

    profile = [
        (0.0, 0.0),
        (r_flat, 0.0),
        (circumradius, rise),
        (circumradius, m - rise),
        (r_flat, m),
        (0.0, m),
    ]
    # rotation=0: a vertex (corner) points along +X, the view's up axis -> vertex-up.
    with BuildPart() as bp:
        with BuildSketch():
            RegularPolygon(radius=circumradius, side_count=6, rotation=0)
        extrude(amount=m)
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)
        revolve(axis=Axis.Z, revolution_arc=360, mode=Mode.INTERSECT)
    if bp.part.volume <= 0:                      # fail loudly on our own, before any reuse
        raise ValueError("chamfered hex: produced an empty solid")
    return bp.part


def hex_nut(s: float, m: float, bore: float, chamfer: float | None = None):
    """Chamfered hex nut: across-flats ``s``, height ``m``, drawn bore ``bore``.

    ``chamfer`` is the chamfer-circle diameter the top/bottom bevel starts from; by ISO
    it equals the across-flats ``s``, so it defaults to ``s``. Vertex-up, matching the
    legacy nut drawings. See ``_chamfered_hex_solid`` for the body construction.
    """
    if bore <= 0:
        raise ValueError(f"hex_nut: need bore > 0, got {bore}")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"hex_nut: bore {bore} leaves too thin a wall (needs to be under "
            f"across-flats {s} by at least {_MIN_WALL_MM} mm)")
    hex_solid = _chamfered_hex_solid(s, m, chamfer)   # validates s, m, chamfer geometry
    with BuildPart() as bp:
        add(hex_solid)
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)
    part = bp.part
    if part.volume <= 0:                        # guard on volume, not is_valid (sewn-shell gotcha)
        raise ValueError("hex_nut: produced an empty solid")
    return part
