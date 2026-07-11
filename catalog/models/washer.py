"""Washer family generators."""
import math

from build123d import (
    BuildPart, BuildSketch, Rectangle, Plane, Axis, Locations,
    Cylinder, Box, Align, Mode, Helix, sweep, revolve, extrude, Polygon,
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


def _check_toothed(d_inner, d_outer, teeth, tip_ratio, caller):
    """Shared guards for the toothed-washer families (`caller` names them in errors)."""
    if not (0 < d_inner < d_outer):
        raise ValueError(f"{caller}: need 0 < d_inner < d_outer, got {d_inner}, {d_outer}")
    if teeth < 3:
        raise ValueError(f"{caller}: need teeth >= 3, got {teeth}")
    if not (0 < tip_ratio < 1):
        raise ValueError(f"{caller}: need 0 < tip_ratio < 1, got {tip_ratio}")


def _toothed_ring_points(r_tip, r_root, teeth, tip_ratio):
    """2D vertices of a `teeth`-pointed star ring: one vertex at `r_root` on each pitch
    line, plus two vertices at `r_tip` straddling each pitch midpoint. `r_tip` is always
    the pointed end — for external teeth it is the larger radius (teeth point outward),
    for internal teeth it is the smaller radius (teeth point inward toward the bore)."""
    pitch = 2 * math.pi / teeth
    half_tip = pitch * tip_ratio / 2.0
    pts = []
    for i in range(teeth):
        a = i * pitch
        pts.append((r_root * math.cos(a), r_root * math.sin(a)))                       # valley
        pts.append((r_tip * math.cos(a + pitch / 2 - half_tip),
                    r_tip * math.sin(a + pitch / 2 - half_tip)))                        # tip a
        pts.append((r_tip * math.cos(a + pitch / 2 + half_tip),
                    r_tip * math.sin(a + pitch / 2 + half_tip)))                        # tip b
    return pts


def toothed_lock_washer(d_inner: float, d_outer: float, thickness: float,
                        teeth: int, tooth_depth: float = None, tip_ratio: float = 0.45):
    """External-tooth lock washer: an annular disc whose outer edge carries `teeth`
    radial teeth, tips reaching `d_outer`. Covers DIN 6797 A (toothed / Zahnscheibe,
    few coarse teeth) and DIN 6798 A (serrated / Fächerscheibe, many fine teeth) —
    same body, the standard differs only in tooth count. `tip_ratio` sets the flat
    tooth-tip width as a fraction of the angular pitch."""
    _check_toothed(d_inner, d_outer, teeth, tip_ratio, "toothed_lock_washer")
    r_tip = d_outer / 2.0
    r_bore = d_inner / 2.0
    depth = tooth_depth if tooth_depth is not None else (r_tip - r_bore) * 0.35
    if depth <= 0:
        raise ValueError(f"toothed_lock_washer: tooth_depth must be positive, got {depth}")
    r_root = r_tip - depth
    if r_root <= r_bore:
        raise ValueError(
            f"toothed_lock_washer: tooth_depth {depth} leaves no ring "
            f"(r_root {r_root} <= r_bore {r_bore})")
    pts = _toothed_ring_points(r_tip, r_root, teeth, tip_ratio)
    with BuildPart() as bp:
        with BuildSketch():
            Polygon(*pts, align=None)
        extrude(amount=thickness / 2.0, both=True)
        Cylinder(radius=r_bore, height=thickness, mode=Mode.SUBTRACT)
    return bp.part


def toothed_lock_washer_internal(d_inner: float, d_outer: float, thickness: float,
                                 teeth: int, tooth_depth: float = None, tip_ratio: float = 0.45):
    """Internal-tooth lock washer (DIN 6797 J / DIN 6798 J, Innenzahn): a plain disc
    of diameter `d_outer` with `teeth` teeth on the bore pointing inward, tips reaching
    `d_inner`. Like the external forms, DIN 6797 uses few coarse teeth and DIN 6798
    many fine serrations — same body, tooth count carries the identity."""
    _check_toothed(d_inner, d_outer, teeth, tip_ratio, "toothed_lock_washer_internal")
    r_out = d_outer / 2.0
    r_tip = d_inner / 2.0                              # inward-pointing tips define the bore
    depth = tooth_depth if tooth_depth is not None else (r_out - r_tip) * 0.35
    if depth <= 0:
        raise ValueError(f"toothed_lock_washer_internal: tooth_depth must be positive, got {depth}")
    r_root = r_tip + depth                             # valleys sit outside the tips
    if r_root >= r_out:
        raise ValueError(
            f"toothed_lock_washer_internal: tooth_depth {depth} leaves no rim "
            f"(r_root {r_root} >= r_out {r_out})")
    pts = _toothed_ring_points(r_tip, r_root, teeth, tip_ratio)
    with BuildPart() as bp:
        Cylinder(radius=r_out, height=thickness)
        with BuildSketch():
            Polygon(*pts, align=None)
        extrude(amount=thickness / 2.0, both=True, mode=Mode.SUBTRACT)
    return bp.part


def countersunk_toothed_washer(d_inner: float, d_outer: float, thickness: float,
                               teeth: int, cone_angle: float = 32,
                               tooth_depth: float = None, tip_ratio: float = 0.45):
    """Countersunk external-tooth lock washer (DIN 6798 V, Senkzahn): the external
    toothed washer dished into a cone so it seats under a countersunk (90°) screw
    head. Built as a revolved tilted cross-section (the dish) intersected with a
    toothed star prism that carves the outer rim into `teeth` teeth. `cone_angle` is
    the tilt of the washer wall from flat, in degrees."""
    _check_toothed(d_inner, d_outer, teeth, tip_ratio, "countersunk_toothed_washer")
    r_tip = d_outer / 2.0
    r_bore = d_inner / 2.0
    depth = tooth_depth if tooth_depth is not None else (r_tip - r_bore) * 0.35
    if depth <= 0:
        raise ValueError(f"countersunk_toothed_washer: tooth_depth must be positive, got {depth}")
    r_root = r_tip - depth
    if r_root <= r_bore:
        raise ValueError(
            f"countersunk_toothed_washer: tooth_depth {depth} leaves no ring "
            f"(r_root {r_root} <= r_bore {r_bore})")
    r_mean = (r_bore + r_tip) / 2.0
    radial_w = r_tip - r_bore
    pts = _toothed_ring_points(r_tip, r_root, teeth, tip_ratio)
    cutter_h = radial_w * 2.0 + thickness * 4.0   # tall enough to span the dished body in Z
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            with Locations((r_mean, 0)):
                Rectangle(radial_w, thickness, rotation=cone_angle)
        revolve(axis=Axis.Z, revolution_arc=360)
        with BuildSketch():
            Polygon(*pts, align=None)
        extrude(amount=cutter_h, both=True, mode=Mode.INTERSECT)
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
