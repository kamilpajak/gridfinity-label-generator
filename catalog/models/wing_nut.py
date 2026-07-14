"""Wing nut family generator (DIN 315 German Form D): a cylindrical threaded boss with two rounded finger wings."""
from build123d import (
    BuildPart, BuildSketch, Circle, Polygon, Cylinder, Locations,
    Plane, Align, Mode, extrude,
)

from catalog.models.hex_nut import _MIN_WALL_MM


def wing_nut(bore: float, boss_d: float, boss_h: float, span: float,
             height: float, wing_t: float, tip_r: float):
    """DIN 315 (German Form D) wing nut: a cylindrical hub of diameter ``boss_d`` and height
    ``boss_h`` on the bearing face, two rounded finger wings, and a through ``bore``.

    Boss axis is Z (bore drilled along Z). The two wings live in the XZ plane: each is a flat
    rounded lobe of thickness ``wing_t`` (along Y) whose outer arc has radius ``tip_r``, its
    tip at ``x = ±span/2`` and its top at ``z = height``, blended to the hub by a wedge neck.
    The lobes are mirror images across x=0 and do not meet at the center, leaving the hub top
    exposed as the central dip. Bore is subtracted last, like ``hex_nut``.
    """
    for name, val in (("bore", bore), ("boss_d", boss_d), ("boss_h", boss_h),
                      ("span", span), ("height", height), ("wing_t", wing_t),
                      ("tip_r", tip_r)):
        if val <= 0:
            raise ValueError(f"wing_nut: need {name} > 0, got {val}")
    if boss_d <= bore + 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"wing_nut: boss_d {boss_d} leaves too thin a wall around bore {bore} "
            f"(needs > bore + {2.0 * _MIN_WALL_MM} mm)")
    if span <= boss_d:
        raise ValueError(
            f"wing_nut: span {span} must exceed boss_d {boss_d} (wings must reach past the hub)")
    if height <= boss_h:
        raise ValueError(
            f"wing_nut: height {height} must exceed boss_h {boss_h} (wings rise above the hub)")
    if tip_r > height / 2.0:
        raise ValueError(
            f"wing_nut: tip_r {tip_r} must be <= height/2 ({height / 2.0}) so the lobe fits "
            f"below the top face")
    if span / 2.0 - tip_r <= boss_d / 2.0:
        raise ValueError(
            f"wing_nut: lobe center {span / 2.0 - tip_r} must clear the hub radius "
            f"{boss_d / 2.0} (else the two wings merge — no central dip)")

    z_c = height - tip_r                         # lobe center height
    with BuildPart() as bp:
        Cylinder(radius=boss_d / 2.0, height=boss_h,
                 align=(Align.CENTER, Align.CENTER, Align.MIN))   # hub on the bearing face z=0
        for sign in (1.0, -1.0):
            x_c = sign * (span / 2.0 - tip_r)    # lobe center; tip at sign*span/2
            with BuildSketch(Plane.XZ):
                with Locations((x_c, z_c)):
                    Circle(radius=tip_r)                          # rounded outer/top lobe
                if sign == 1.0:
                    Polygon(                                      # wedge neck lobe -> hub
                        (0.0, 0.0),
                        (x_c, z_c - tip_r),
                        (x_c, z_c),
                        (0.0, boss_h),
                        align=None,
                    )
                else:
                    Polygon(                                      # reversed winding for -X wing
                        (0.0, 0.0),
                        (0.0, boss_h),
                        (x_c, z_c),
                        (x_c, z_c - tip_r),
                        align=None,
                    )
            extrude(amount=wing_t / 2.0, both=True)               # thickness wing_t, centered on Y=0
        Cylinder(radius=bore / 2.0, height=height * 3.0, mode=Mode.SUBTRACT)   # through bore, last
    part = bp.part
    if part.volume <= 0:                         # net guard (matches the family; not is_valid)
        raise ValueError("wing_nut: produced an empty solid")
    return part
