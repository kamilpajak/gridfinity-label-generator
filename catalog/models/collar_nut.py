"""Collar nut family generator: chamfered hex body with a plain cylindrical bearing collar and a bore."""
import math

from build123d import BuildPart, Cylinder, Align, Mode, add

from catalog.models.hex_nut import _chamfered_hex_solid, _MIN_WALL_MM


def collar_nut(s: float, m: float, bore: float, dc: float, collar_height: float,
               chamfer: float | None = None):
    """Hex nut with a plain cylindrical bearing collar: across-flats ``s``, total height
    ``m`` (collar included), drawn bore ``bore``, collar of diameter ``dc`` and height
    ``collar_height`` on the bearing face.

    A shared chamfered vertex-up hex body (``_chamfered_hex_solid``) of the full height
    ``m`` with a plain straight-walled cylinder unioned over the bottom ``collar_height``
    and a through bore subtracted last (like ``hex_nut``). Because ``dc`` exceeds the hex
    across-corners, the collar is a visible bearing ring that swallows the hex's bottom
    chamfer, leaving a flat bearing face; the top (free-face) chamfer is untouched.
    """
    if bore <= 0:
        raise ValueError(f"collar_nut: need bore > 0, got {bore}")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"collar_nut: bore {bore} leaves too thin a wall (needs < across-flats {s} "
            f"by at least {_MIN_WALL_MM} mm)")
    if not (0 < collar_height < m):
        raise ValueError(
            f"collar_nut: need 0 < collar_height < m, got collar_height={collar_height}, m={m}")
    circumradius = s / math.sqrt(3.0)
    if dc <= 2.0 * circumradius:
        raise ValueError(
            f"collar_nut: collar dc {dc} must exceed the hex across-corners "
            f"{2.0 * circumradius:.3f} (else there is no visible collar)")

    hex_solid = _chamfered_hex_solid(s, m, chamfer)   # full height m; validates s, m, chamfer
    with BuildPart() as bp:
        add(hex_solid)
        Cylinder(radius=dc / 2.0, height=collar_height,
                 align=(Align.CENTER, Align.CENTER, Align.MIN))   # collar on the bearing face z=0
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)   # through bore, last
    part = bp.part
    if part.volume <= 0:                              # net guard (matches hex_nut/flange_nut)
        raise ValueError("collar_nut: produced an empty solid")
    return part
