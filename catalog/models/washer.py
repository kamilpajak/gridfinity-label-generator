"""Washer family generators."""
from build123d import (
    BuildPart, BuildSketch, Rectangle, Plane, Axis, Locations,
    Cylinder, Box, Align, Mode, Helix, sweep, revolve,
)


def flat_washer(d_inner: float, d_outer: float, thickness: float):
    """Plain flat washer: an annular disc (DIN 125/126/433/440/9021 & ISO equivalents)."""
    if not (0 < d_inner < d_outer):
        raise ValueError(f"flat_washer: need 0 < d_inner < d_outer, got {d_inner}, {d_outer}")
    with BuildPart() as bp:
        Cylinder(radius=d_outer / 2, height=thickness)
        Cylinder(radius=d_inner / 2, height=thickness, mode=Mode.SUBTRACT)
    return bp.part


def spring_washer(d_inner: float, d_outer: float, section: float, gap: float):
    """Split spring lock washer (DIN 127/128/137): square-section ring with a split gap."""
    if not (0 < d_inner < d_outer):
        raise ValueError(f"spring_washer: need 0 < d_inner < d_outer, got {d_inner}, {d_outer}")
    with BuildPart() as bp:
        Cylinder(radius=d_outer / 2, height=section)
        Cylinder(radius=d_inner / 2, height=section, mode=Mode.SUBTRACT)
        # Cut a radial slot (the split) from centre out past the outer edge.
        Box(
            d_outer, gap, section * 2,
            align=(Align.MIN, Align.CENTER, Align.CENTER),
            mode=Mode.SUBTRACT,
        )
    return bp.part


def helical_spring_washer(d_inner: float, d_outer: float, section: float, gap_deg: float = 16):
    """DIN 127: split spring lock washer — square section swept along a partial helix
    that rises by one `section` over the turn, so the split ends sit at different heights."""
    if not (0 < d_inner < d_outer):
        raise ValueError(f"helical_spring_washer: need 0 < d_inner < d_outer, got {d_inner}, {d_outer}")
    r_mean = (d_inner + d_outer) / 4.0
    radial_w = (d_outer - d_inner) / 2.0
    turns = (360.0 - gap_deg) / 360.0
    with BuildPart() as bp:
        path = Helix(pitch=section / turns, height=section, radius=r_mean)
        with BuildSketch(Plane(origin=path @ 0, z_dir=path % 0)):
            Rectangle(radial_w, section)
        sweep(path=path)
    return bp.part


def curved_washer(d_inner: float, d_outer: float, thickness: float,
                  cone_angle: float = 18, gap_deg: float = 16):
    """DIN 128: curved (domed) split spring washer — a radial cross-section tilted by
    `cone_angle`, revolved with a gap about the axis, giving a dished ring."""
    if not (0 < d_inner < d_outer):
        raise ValueError(f"curved_washer: need 0 < d_inner < d_outer, got {d_inner}, {d_outer}")
    r_mean = (d_inner + d_outer) / 4.0
    radial_w = (d_outer - d_inner) / 2.0
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            with Locations((r_mean, 0)):
                Rectangle(radial_w, thickness, rotation=cone_angle)
        revolve(axis=Axis.Z, revolution_arc=360 - gap_deg)
    return bp.part
