"""Hex nut family generator (used by the Phase 0 spike; reused in the nuts phase)."""
import math

from build123d import BuildPart, BuildSketch, RegularPolygon, Cylinder, extrude, Mode


def hex_nut(s: float, m: float, bore: float):
    """Hexagon nut: across-flats `s`, height `m`, central bore diameter `bore`.

    RegularPolygon radius is the circumradius; across-flats s => circumradius s/sqrt(3).
    """
    circumradius = s / math.sqrt(3.0)
    with BuildPart() as bp:
        with BuildSketch():
            RegularPolygon(radius=circumradius, side_count=6)
        extrude(amount=m)
        Cylinder(radius=bore / 2, height=m * 3, mode=Mode.SUBTRACT)
    return bp.part
