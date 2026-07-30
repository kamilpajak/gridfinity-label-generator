"""Knurled thumb screw family generator, HIGH form (DIN 464, Raendelschraube hohe Form).

The DIN 653 knurled cylindrical head (the knurl is a fine feature and is NOT drawn, like the
thread) raised on a REDUCED-diameter cylindrical collar/shoulder between the head and the
shank — the feature that distinguishes DIN 464 (hohe Form) from the flat DIN 653 (niedrige
Form) drawn by ``knurled_screw`` (which stays a separate family: head directly on the shank,
no collar). It is the same head-on-narrower-boss relationship the DIN 466/467 knurled nuts
share (see ``knurled_nut``). Modelled axis-along-Z: the collar occupies z in [0, collar_h]
(bearing face on z=0), the head z in [collar_h, collar_h + k], the smooth envelope-only shank
(``screw_common._screw_shank``) z in [-length, 0]. Collar and head are a single revolved
meridian profile; the shank fuses by face contact at the z=0 bearing plane (the screw_common
stacking seam), guarded by net volume>0 + single-solid.
"""
from build123d import BuildPart, BuildSketch, Polygon, Plane, Axis, add, revolve

from catalog.models.screw_common import _screw_shank


def knurled_screw_high(d: float, k: float, collar_d: float, collar_h: float,
                       d_shank: float, length: float,
                       head_chamfer: float | None = None,
                       tip_chamfer: float | None = None):
    """DIN 464 high knurled thumb screw: a knurled cylindrical head of diameter ``d`` and
    height ``k`` (with an optional 45-degree top-rim chamfer of leg ``head_chamfer``) raised
    on a narrower collar of diameter ``collar_d`` and height ``collar_h``, over a smooth
    shank of diameter ``d_shank`` and ``length`` (optional 45-degree lead ``tip_chamfer``).
    No bore, no drawn thread, no drawn knurl.
    """
    for name, val in (("d", d), ("k", k), ("collar_d", collar_d), ("collar_h", collar_h),
                      ("d_shank", d_shank), ("length", length)):
        if val <= 0:
            raise ValueError(f"knurled_screw_high: need {name} > 0, got {val}")
    if collar_d >= d:
        raise ValueError(
            f"knurled_screw_high: collar_d {collar_d} must be < head diameter {d} "
            f"(the raised collar is the reduced step below the knurled grip)")
    if d_shank >= collar_d:
        raise ValueError(
            f"knurled_screw_high: d_shank {d_shank} must be < collar_d {collar_d} "
            f"(the collar overhangs the shank)")
    r = d / 2.0
    rc = collar_d / 2.0
    top = collar_h + k
    if head_chamfer is not None:
        if not (0 < head_chamfer < r):
            raise ValueError(
                f"knurled_screw_high: head_chamfer {head_chamfer} must be > 0 "
                f"and < head radius {r}")
        if head_chamfer >= k:
            raise ValueError(
                f"knurled_screw_high: head_chamfer {head_chamfer} must be < "
                f"knurled head height {k}")
        hc = head_chamfer
        # (x=radius, z=height): bearing face -> collar wall -> under-head step -> head wall
        # -> 45-deg top-rim chamfer -> top face.
        profile = [(0.0, 0.0), (rc, 0.0), (rc, collar_h), (r, collar_h),
                   (r, top - hc), (r - hc, top), (0.0, top)]
    else:
        profile = [(0.0, 0.0), (rc, 0.0), (rc, collar_h), (r, collar_h),
                   (r, top), (0.0, top)]

    shank = _screw_shank(d_shank, length, tip_chamfer)   # z in [-length, 0], validates chamfer
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)                # explicit coords -> no auto-centring
        revolve(axis=Axis.Z, revolution_arc=360)         # collar + head, z in [0, collar_h + k]
        add(shank)                                       # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                                 # net guard (not is_valid — sewn-shell)
        raise ValueError("knurled_screw_high: produced an empty solid")
    if len(part.solids()) != 1:                          # collar+head+shank must fuse to one solid
        raise ValueError(
            "knurled_screw_high: head/collar/shank did not fuse into a single solid")
    return part
