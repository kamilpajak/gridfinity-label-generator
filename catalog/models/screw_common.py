"""Shared helpers for the screw families (hex_bolt, socket_screw, slotted_screw, ...).

The threaded shank is drawn ENVELOPE-ONLY (a smooth cylinder at the major diameter) — no
thread lines — consistent with the epic's fine-feature rule. Every screw family reuses
``_screw_shank`` for the body below the head.
"""
from build123d import BuildPart, BuildSketch, Polygon, Plane, Axis, revolve


def _screw_shank(d: float, length: float, tip_chamfer: float | None = None):
    """A smooth cylindrical shank of diameter ``d`` and axial ``length``, built along -Z from
    the under-head bearing plane ``z=0`` down to ``z=-length``, with an optional 45-degree lead
    chamfer of leg ``tip_chamfer`` at the free end. Built by revolving a meridian profile in the
    XZ plane about Z (deterministic — no fragile edge selection). Envelope only; no thread.
    """
    if d <= 0:
        raise ValueError(f"_screw_shank: need d > 0, got {d}")
    if length <= 0:
        raise ValueError(f"_screw_shank: need length > 0, got {length}")
    r = d / 2.0
    if tip_chamfer is not None:
        if not (0 < tip_chamfer < r):
            raise ValueError(
                f"_screw_shank: tip_chamfer {tip_chamfer} must be > 0 and < radius {r}")
        if tip_chamfer >= length:
            raise ValueError(
                f"_screw_shank: tip_chamfer {tip_chamfer} must be < length {length}")
        c = tip_chamfer
        # (x=radius, z=axial): top face -> outer wall -> 45-deg lead chamfer -> bottom face.
        profile = [(0.0, 0.0), (r, 0.0), (r, -(length - c)), (r - c, -length), (0.0, -length)]
    else:
        profile = [(0.0, 0.0), (r, 0.0), (r, -length), (0.0, -length)]
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)          # explicit coords -> no auto-centring
        revolve(axis=Axis.Z, revolution_arc=360)
    if bp.part.volume <= 0:                          # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("_screw_shank: produced an empty solid")
    return bp.part
