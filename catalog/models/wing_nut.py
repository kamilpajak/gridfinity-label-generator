"""Wing nut family generator (DIN 315 German Form D): a tapered threaded boss with two rounded finger wings.

The form matches the DIN 315 drawing: two flat paddle wings that rise from a tapered hub and
spread apart, each with a rounded outer ear and a concave valley toward the hub. The
construction follows the DIN 315 geometry as also implemented in the open-source FreeCAD
Fasteners Workbench (LGPL, github.com/shaise/FreeCAD_FastenersWB); it is reimplemented here in
build123d. The shape is dictated by the standard; the exact wing radii are not published, so
the outline is representative form and only the tabulated envelope dimensions are sourced.
"""
import math

from build123d import (
    BuildPart, BuildSketch, BuildLine, Line, Polyline, ThreePointArc, Cylinder,
    Plane, Axis, Align, Mode, extrude, revolve, make_face, mirror, fillet,
)

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness (same rule as hex_nut)

_INNER_EDGE_DEG = 20.0   # rise angle of the wing's inner (valley-side) edge, per the DIN 315 form


def _wing_profile(boss_d, span, height, wing_t):
    """Points closing one (+X) finger wing in the XZ plane (x = radial, z = axial).

    A: root at the hub (low z); A->B: inner (valley-side) edge rising at ``_INNER_EDGE_DEG`` to
    the top; B->C: rounded outer ear (arc, the large ``r1`` radius); C->D: concave outer-lower
    edge (arc) back to the hub; D->A closes along the hub. Every coordinate is a proportion of
    the tabulated envelope (boss_d, span, height, wing_t), so the wing is representative form.
    """
    xin = boss_d / 4.0                          # inner edge x (buried in the hub -> fused)
    A = (xin, 0.75 * wing_t)
    B = (xin + (height - 0.75 * wing_t) * math.tan(math.radians(_INNER_EDGE_DEG)), height)
    C = (span / 2.0, 0.80 * height)             # ear outer tip (max x)
    D = (xin, wing_t / 4.0)
    m_BC = (0.375 * span, 0.95 * height)        # through-point of the rounded ear arc
    m_CD = ((boss_d + span) / 4.0, 0.25 * height)   # through-point of the concave lower arc
    return A, B, C, D, m_BC, m_CD


def wing_nut(bore: float, boss_d: float, collar_d: float, boss_h: float,
             span: float, height: float, wing_t: float):
    """DIN 315 (German Form D) wing nut: a tapered hub (``boss_d`` at the bearing face down to
    ``collar_d`` at the top) of height ``boss_h``, two rounded finger wings, and a through
    ``bore``.

    Boss axis is Z (bore drilled along Z). The two wings live in the XZ plane: each is a flat
    blade of thickness ``wing_t`` (along Y) rising from the hub and spreading out to
    ``x=±span/2`` and up to ``z=height``, with a rounded outer ear and a concave inner edge
    (see ``_wing_profile``). The two wings are mirror images across x=0, joined through the hub
    and diverging into the German Form D butterfly. Bore subtracted last, like ``hex_nut``.
    """
    for name, val in (("bore", bore), ("boss_d", boss_d), ("collar_d", collar_d),
                      ("boss_h", boss_h), ("span", span), ("height", height), ("wing_t", wing_t)):
        if val <= 0:
            raise ValueError(f"wing_nut: need {name} > 0, got {val}")
    if collar_d > boss_d:
        raise ValueError(
            f"wing_nut: collar_d {collar_d} (hub top) must not exceed boss_d {boss_d} (hub base)")
    if collar_d <= bore + 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"wing_nut: collar_d {collar_d} leaves too thin a wall around bore {bore} "
            f"(needs > bore + {2.0 * _MIN_WALL_MM} mm)")
    if span <= boss_d:
        raise ValueError(
            f"wing_nut: span {span} must exceed boss_d {boss_d} (wings must reach past the hub)")
    if height <= boss_h:
        raise ValueError(
            f"wing_nut: height {height} must exceed boss_h {boss_h} (wings rise above the hub)")

    A, B, C, D, m_BC, m_CD = _wing_profile(boss_d, span, height, wing_t)
    ear_r = wing_t / 2.0                         # corner rounding of the exposed ear
    with BuildPart() as bp:
        # Tapered hub: revolve a trapezoid (boss_d/2 at the bearing face down to collar_d/2 at
        # the top). Revolve handles the cone and the degenerate cylinder (collar_d == boss_d)
        # uniformly, unlike the Cone primitive which rejects equal radii.
        with BuildSketch(Plane.XZ):
            with BuildLine():
                Polyline([(0.0, 0.0), (boss_d / 2.0, 0.0),
                          (collar_d / 2.0, boss_h), (0.0, boss_h)], close=True)
            make_face()
        revolve(axis=Axis.Z)
        with BuildSketch(Plane.XZ) as sk:
            with BuildLine():
                Line(A, B)                                       # inner (valley-side) edge, 20 deg
                ThreePointArc(B, m_BC, C)                        # rounded outer ear (r1)
                ThreePointArc(C, m_CD, D)                        # concave outer-lower edge
                Line(D, A)                                       # close along the hub
            make_face()
            ear_corners = sk.vertices().filter_by(lambda v: v.X > boss_d / 2.0)
            if ear_corners:
                fillet(ear_corners, radius=ear_r)                # soften the exposed ear corners
            mirror(about=Plane.YZ)                               # the second wing (−X)
        extrude(amount=wing_t / 2.0, both=True)                  # thickness wing_t, centered on Y=0
        Cylinder(radius=bore / 2.0, height=height * 3.0, mode=Mode.SUBTRACT)   # through bore, last
    part = bp.part
    if part.volume <= 0:                         # net guard (matches the family; not is_valid)
        raise ValueError("wing_nut: produced an empty solid")
    return part
