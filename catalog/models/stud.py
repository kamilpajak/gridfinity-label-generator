"""Plain double-end stud / threaded-rod family generator (DIN 938 / 939 / 835).

A headless, socket-less smooth cylinder (envelope-only, no drawn thread) with a 45-degree lead
chamfer at BOTH free ends. A stud has a thread at each end and a plain unthreaded middle; the
standards in this family (DIN 938 metal end 1d, DIN 939 1.25d, DIN 835 2d) differ only in the
thread-end engagement length, which is not drawn, so envelope-only they are the same plain rod.
Modelled axis-along-Z: the body sits z in [0, length].

The body is one revolve of an XZ meridian about Z (the same deterministic technique as
``_screw_shank`` / ``set_screw`` — no fragile edge selection). Self-contained: no dependency on
``screw_common``.
"""
from build123d import BuildPart, BuildSketch, Polygon, Plane, Axis, revolve


def stud(d: float, length: float, tip_chamfer: float | None = None):
    """Plain double-end stud: a smooth cylinder of diameter ``d`` and axial ``length`` with an
    optional 45-degree lead chamfer of leg ``tip_chamfer`` at BOTH free ends. Built along +Z with
    the body z in [0, length], by revolving a meridian in the XZ plane about Z. Envelope only; no
    thread, no socket, no head.
    """
    if d <= 0:
        raise ValueError(f"stud: need d > 0, got {d}")
    if length <= 0:
        raise ValueError(f"stud: need length > 0, got {length}")
    r = d / 2.0
    if tip_chamfer is not None:
        if not (0.0 < tip_chamfer < r):
            raise ValueError(
                f"stud: tip_chamfer {tip_chamfer} must be > 0 and < radius {r}")
        if 2.0 * tip_chamfer >= length:
            raise ValueError(
                f"stud: two tip_chamfers {tip_chamfer} must fit within length {length} "
                f"(need 2*tip_chamfer < length)")
        c = tip_chamfer
        # (x=radius, z=axial): bottom face -> bottom chamfer -> wall -> top chamfer -> top face.
        profile = [(0.0, 0.0), (r - c, 0.0), (r, c),
                   (r, length - c), (r - c, length), (0.0, length)]
    else:
        profile = [(0.0, 0.0), (r, 0.0), (r, length), (0.0, length)]
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)          # explicit coords -> no auto-centring
        revolve(axis=Axis.Z, revolution_arc=360)
    part = bp.part
    if part.volume <= 0:                            # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("stud: produced an empty solid")
    if len(part.solids()) != 1:                     # must be a single fused solid
        raise ValueError("stud: produced more than one solid")
    return part
