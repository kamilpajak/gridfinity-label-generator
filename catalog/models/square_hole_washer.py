"""Round flat washer with a square hole (DIN 440 Form V) generator.

DIN 440 Form V is the large-series round washer whose central hole is SQUARE (for square-neck
bolts), as opposed to Form R's round hole. Built as a plain disc minus a square prism, centred on
z=0 to match the other washers. The existing `square_washer` is the inverse shape (a square plate
with a round bore) and does not fit; this generator is self-contained.
"""
import math

from build123d import BuildPart, BuildSketch, Cylinder, Rectangle, RectangleRounded, Mode, extrude


def square_hole_washer(d_outer: float, thickness: float, hole_side: float,
                       hole_corner_r: float | None = None):
    """Round flat washer of diameter ``d_outer`` and ``thickness`` with a central SQUARE hole of
    side ``hole_side`` (optional small corner round ``hole_corner_r``). The disc is centred on
    ``z=0`` (so it occupies ``z in [-thickness/2, thickness/2]``), matching the other washers."""
    if d_outer <= 0 or thickness <= 0 or hole_side <= 0:
        raise ValueError(
            f"square_hole_washer: need positive d_outer, thickness, hole_side, "
            f"got {d_outer}, {thickness}, {hole_side}")
    if hole_side * math.sqrt(2.0) >= d_outer:
        raise ValueError(
            f"square_hole_washer: square hole side {hole_side} has corners at radius "
            f"{hole_side * math.sqrt(2.0) / 2.0:.3f} which reach/exceed the disc radius "
            f"{d_outer / 2.0} (no washer body left)")
    if hole_corner_r is not None and not (0.0 < hole_corner_r < hole_side / 2.0):
        raise ValueError(
            f"square_hole_washer: hole_corner_r {hole_corner_r} must be > 0 and < hole_side/2 "
            f"= {hole_side / 2.0}")
    with BuildPart() as bp:
        Cylinder(radius=d_outer / 2.0, height=thickness)             # disc z in [-t/2, t/2]
        with BuildSketch():                                          # square hole cross-section on z=0
            if hole_corner_r is None:
                Rectangle(hole_side, hole_side)
            else:
                RectangleRounded(hole_side, hole_side, hole_corner_r)
        extrude(amount=thickness, both=True, mode=Mode.SUBTRACT)     # through-cut the square hole
    part = bp.part
    if part.volume <= 0:                                             # net guard
        raise ValueError("square_hole_washer: produced an empty solid")
    return part
