"""Knurled thumb screw family generator (DIN 464 high, DIN 653 low).

A smooth knurled cylindrical head (the knurl is a fine feature and is NOT drawn, like the
thread) over a smooth cylindrical shank (``screw_common._screw_shank``). DIN 464 (high) and
DIN 653 (low) are the same envelope at different head heights ``k``. The head top edge carries
an optional small chamfer breaking the top knurl rim; the knurl on the head wall is omitted (a
smooth cylinder) — the same envelope convention ``knurled_nut`` makes. Modelled axis-along-Z:
the head occupies z in [0, k] (bearing face on z=0), the shank z in [-length, 0]. Head and shank
fuse by face contact at the z=0 bearing plane (the screw_common stacking seam), guarded by net
volume>0 + single-solid.
"""
from build123d import BuildPart, BuildSketch, Polygon, Plane, Axis, add, revolve

from catalog.models.screw_common import _screw_shank


def knurled_screw(d: float, k: float, d_shank: float, length: float,
                  head_chamfer: float | None = None, tip_chamfer: float | None = None):
    """Knurled thumb screw: a knurled cylindrical head of diameter ``d`` and height ``k`` (with an
    optional 45-degree top-rim chamfer of leg ``head_chamfer``) over a smooth shank of diameter
    ``d_shank`` and ``length`` (optional 45-degree lead ``tip_chamfer``). No bore, no drawn thread,
    no drawn knurl.
    """
    for name, val in (("d", d), ("k", k), ("d_shank", d_shank), ("length", length)):
        if val <= 0:
            raise ValueError(f"knurled_screw: need {name} > 0, got {val}")
    if d_shank >= d:
        raise ValueError(
            f"knurled_screw: d_shank {d_shank} must be < head diameter {d} "
            f"(the knurled head is the grip and is wider than the thread)")
    r = d / 2.0
    if head_chamfer is not None:
        if not (0 < head_chamfer < r):
            raise ValueError(
                f"knurled_screw: head_chamfer {head_chamfer} must be > 0 and < head radius {r}")
        if head_chamfer >= k:
            raise ValueError(
                f"knurled_screw: head_chamfer {head_chamfer} must be < head height {k}")
        hc = head_chamfer
        # (x=radius, z=height): bearing face -> outer wall -> 45-deg top-rim chamfer -> top face.
        head_profile = [(0.0, 0.0), (r, 0.0), (r, k - hc), (r - hc, k), (0.0, k)]
    else:
        head_profile = [(0.0, 0.0), (r, 0.0), (r, k), (0.0, k)]

    shank = _screw_shank(d_shank, length, tip_chamfer)     # z in [-length, 0], validates chamfer
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*head_profile, align=None)             # explicit coords -> no auto-centring
        revolve(axis=Axis.Z, revolution_arc=360)           # knurled head, z in [0, k]
        add(shank)                                         # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell)
        raise ValueError("knurled_screw: produced an empty solid")
    if len(part.solids()) != 1:                            # head + shank must fuse to one solid
        raise ValueError("knurled_screw: head/shank did not fuse into a single solid")
    return part
