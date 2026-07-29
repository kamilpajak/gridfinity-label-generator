"""Wing screw family generator (DIN 316 German form 'rounded wings'): the DIN 315 wing head
on a threaded shank.

The head is the wing_nut top without the bore: a tapered hub (``boss_d`` at the bearing face
up to ``collar_d`` at the top, height ``boss_h``) carrying two flat paddle wings from the
shared ``wing_common._wing_profile``. Below the z=0 bearing plane hangs a smooth
envelope-only shank (``screw_common._screw_shank``) — no drawn thread, per the epic's
fine-feature rule. Head and shank fuse by face contact at z=0 (the screw_common stacking
seam), guarded by net volume>0 + single-solid.
"""
from build123d import (
    BuildPart, BuildSketch, BuildLine, Line, Polyline, ThreePointArc,
    Plane, Axis, add, extrude, revolve, make_face, mirror, fillet,
)

from catalog.models.wing_common import _wing_profile
from catalog.models.screw_common import _screw_shank


def wing_screw(d_shank: float, length: float, boss_d: float, collar_d: float,
               boss_h: float, span: float, height: float, wing_t: float,
               tip_chamfer: float | None = None):
    """DIN 316 wing screw: a tapered hub plus two rounded finger wings (z in [0, height])
    over a smooth shank of diameter ``d_shank`` and ``length`` (z in [-length, 0], optional
    45-degree lead ``tip_chamfer``). No bore, no drawn thread.
    """
    for name, val in (("d_shank", d_shank), ("length", length), ("boss_d", boss_d),
                      ("collar_d", collar_d), ("boss_h", boss_h), ("span", span),
                      ("height", height), ("wing_t", wing_t)):
        if val <= 0:
            raise ValueError(f"wing_screw: need {name} > 0, got {val}")
    if collar_d > boss_d:
        raise ValueError(
            f"wing_screw: collar_d {collar_d} (hub top) must not exceed boss_d {boss_d} (hub base)")
    if d_shank >= boss_d:
        raise ValueError(
            f"wing_screw: d_shank {d_shank} must be < boss_d {boss_d} (the hub overhangs the shank)")
    if span <= boss_d:
        raise ValueError(
            f"wing_screw: span {span} must exceed boss_d {boss_d} (wings must reach past the hub)")
    if height <= boss_h:
        raise ValueError(
            f"wing_screw: height {height} must exceed boss_h {boss_h} (wings rise above the hub)")

    A, B, C, D, m_BC, m_CD = _wing_profile(boss_d, span, height, wing_t)
    ear_r = wing_t / 2.0                         # corner rounding of the exposed ear
    shank = _screw_shank(d_shank, length, tip_chamfer)   # z in [-length, 0], validates chamfer
    with BuildPart() as bp:
        # Tapered hub, z in [0, boss_h]: same revolved trapezoid as wing_nut (revolve handles
        # the cone and the degenerate cylinder collar_d == boss_d uniformly).
        with BuildSketch(Plane.XZ):
            with BuildLine():
                Polyline([(0.0, 0.0), (boss_d / 2.0, 0.0),
                          (collar_d / 2.0, boss_h), (0.0, boss_h)], close=True)
            make_face()
        revolve(axis=Axis.Z)
        with BuildSketch(Plane.XZ) as sk:
            with BuildLine():
                Line(A, B)                                       # inner (valley-side) edge, 20 deg
                ThreePointArc(B, m_BC, C)                        # rounded outer ear
                ThreePointArc(C, m_CD, D)                        # concave outer-lower edge
                Line(D, A)                                       # close along the hub
            make_face()
            # Filter on boss_d/2 (the wider hub base): any vertex outside it is outside the hub
            # at every height, so the narrower top (collar_d/2) is a subset — no corner missed.
            # For real dimension sets this selects B (valley-side top), C (ear tip) and D
            # (lower outboard corner) — all three exposed corners are rounded deliberately.
            ear_corners = sk.vertices().filter_by(lambda v: v.X > boss_d / 2.0)
            if ear_corners:
                fillet(ear_corners, radius=ear_r)                # soften the exposed ear corners
            mirror(about=Plane.YZ)                               # duplicate onto the -X wing
        extrude(amount=wing_t / 2.0, both=True)                  # thickness wing_t, centered on Y=0
        add(shank)                                               # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                         # net guard (matches the family; not is_valid)
        raise ValueError("wing_screw: produced an empty solid")
    if len(part.solids()) != 1:                  # hub + wings + shank must fuse to one solid
        raise ValueError("wing_screw: head/shank did not fuse into a single solid")
    return part
