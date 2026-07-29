"""Shared DIN 315/316 German-form wing profile (rounded finger wings).

Two flat paddle wings rise from a tapered hub and spread apart, each with a rounded outer
ear and a concave valley toward the hub. The construction follows the DIN 315/316 geometry
as also implemented in the open-source FreeCAD Fasteners Workbench (LGPL,
github.com/shaise/FreeCAD_FastenersWB); it is reimplemented here in build123d. The shape is
dictated by the standards; the exact wing radii are not published, so the outline is
representative form and only the tabulated envelope dimensions are sourced. Consumed by
``wing_nut`` (DIN 315) and ``wing_screw`` (DIN 316).
"""
import math

_INNER_EDGE_DEG = 20.0   # rise angle of the wing's inner (valley-side) edge, per the DIN 315/316 form


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
