"""Knurled nut family generator (DIN 466 high, DIN 467 low).

A smooth cylindrical head (the knurl is a fine feature and is NOT drawn, like the thread)
with an optional narrower lower collar/boss unioned below it, and a through bore. DIN 467
(low) is a plain knurled disc (no collar); DIN 466 (high) is a knurled head on a narrower
plain boss. Only the smooth envelope is drawn. Axisymmetric — no preset change.
"""
from build123d import BuildPart, Cylinder, Locations, Align, Mode

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def knurled_nut(d: float, h: float, bore: float,
                collar_d: float | None = None, collar_h: float | None = None):
    """Knurled nut: smooth head of diameter ``d`` and height ``h`` with a through ``bore``.

    When ``collar_d``/``collar_h`` are given (DIN 466), a narrower plain boss of diameter
    ``collar_d`` and height ``collar_h`` is unioned on the bearing face below the head, which
    is raised to sit on top of it (total height ``collar_h + h``). Both collar params must be
    supplied together or both omitted (DIN 467, a plain disc). Bore subtracted last.
    """
    for name, val in (("d", d), ("h", h), ("bore", bore)):
        if val <= 0:
            raise ValueError(f"knurled_nut: need {name} > 0, got {val}")
    if bore >= d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"knurled_nut: bore {bore} leaves too thin a wall vs head d {d} "
            f"(needs < d - {2.0 * _MIN_WALL_MM} mm)")
    has_collar = collar_d is not None or collar_h is not None
    if has_collar and (collar_d is None or collar_h is None):
        raise ValueError(
            "knurled_nut: collar_d and collar_h must be given together (or both omitted)")
    if has_collar:
        if collar_d <= 0 or collar_h <= 0:
            raise ValueError(
                f"knurled_nut: need collar_d, collar_h > 0, got collar_d={collar_d}, collar_h={collar_h}")
        if collar_d >= d:
            raise ValueError(
                f"knurled_nut: collar_d {collar_d} must be < head d {d} (the boss is a narrower step)")
        if collar_d <= bore + 2.0 * _MIN_WALL_MM:
            raise ValueError(
                f"knurled_nut: collar_d {collar_d} leaves too thin a wall around bore {bore} "
                f"(needs > bore + {2.0 * _MIN_WALL_MM} mm)")

    collar_h_val = collar_h if has_collar else 0.0
    total_h = collar_h_val + h
    with BuildPart() as bp:
        if has_collar:
            Cylinder(radius=collar_d / 2.0, height=collar_h,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))   # boss on the bearing face z=0
        with Locations((0.0, 0.0, collar_h_val)):
            Cylinder(radius=d / 2.0, height=h,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))   # head on top of the boss
        Cylinder(radius=bore / 2.0, height=total_h * 3.0, mode=Mode.SUBTRACT)   # through bore, last
    part = bp.part
    if part.volume <= 0:                              # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("knurled_nut: produced an empty solid")
    return part
