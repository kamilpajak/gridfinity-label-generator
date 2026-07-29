"""Hex flange bolt family generator (DIN 6921 / ISO 4162).

A vertex-up chamfered hex head (reused from ``hex_nut``) sitting on an integral conical flange
(the revolved profile reused from ``flange_nut``) over a smooth cylindrical shank
(``screw_common._screw_shank``). The flange is a flat bearing disc of diameter ``dc`` and rim
thickness ``c`` coning inward and up to the hex across-corners circle; it is wider than the hex, so
the bearing face is the flange disc, not the hex, and the shank emerges from the flange disc.
Envelope-only: no drawn thread, no bore, and the serrated (ribbed) bearing face of a real DIN 6921
is omitted (a smooth flange) — the same simplification ``flange_nut`` makes. Modelled axis-along-Z:
the flange/head occupy z in [0, k] (bearing face on z=0), the shank z in [-length, 0]; the front
view is the hexagon-on-flange end view, the side view the head+shank elevation.
"""
import math

from build123d import BuildPart, BuildSketch, Polygon, Plane, Axis, add, revolve

from catalog.models.flange_nut import _FLANGE_CONE_ANGLE_DEG
from catalog.models.hex_nut import _chamfered_hex_solid
from catalog.models.screw_common import _screw_shank


def hex_flange_bolt(s: float, k: float, dc: float, c: float, d_shank: float, length: float,
                    head_chamfer: float | None = None, tip_chamfer: float | None = None):
    """Hex flange bolt: across-flats ``s`` hex head of total height ``k`` (vertex-up, chamfered by
    ``head_chamfer``) on an integral conical flange of diameter ``dc`` and rim thickness ``c``, over
    a smooth shank of diameter ``d_shank`` and ``length`` (optional 45-degree lead ``tip_chamfer``).
    No bore, no drawn thread, smooth (unserrated) flange.
    """
    for name, val in (("s", s), ("k", k), ("dc", dc), ("c", c),
                      ("d_shank", d_shank), ("length", length)):
        if val <= 0:
            raise ValueError(f"hex_flange_bolt: need {name} > 0, got {val}")
    if d_shank >= s:
        raise ValueError(
            f"hex_flange_bolt: d_shank {d_shank} must be < across-flats {s} (the shank is narrower "
            f"than the hex head and, since s < dc, stays within the flange disc it joins)")
    circumradius = s / math.sqrt(3.0)                     # hex across-corners / 2
    if dc <= 2 * circumradius:
        raise ValueError(
            f"hex_flange_bolt: dc {dc} must exceed the hex across-corners {2 * circumradius:.3f} "
            f"(else there is no flange)")
    r_flange = dc / 2.0
    rise = (r_flange - circumradius) * math.tan(math.radians(_FLANGE_CONE_ANGLE_DEG))
    flange_top = c + rise
    if flange_top >= k:
        raise ValueError(
            f"hex_flange_bolt: flange ({flange_top:.3f}) leaves no hex below total head height {k}")

    # Flange silhouette in the XZ half-plane (x = radius, z = height), revolved about Z: flat bearing
    # disc out to the rim, up the rim edge, then coning inward and up to the hex corner circle. The
    # profile touches the Z axis at both ends (x=0); the volume/solid guards below are the net.
    flange_profile = [
        (0.0, 0.0),
        (r_flange, 0.0),
        (r_flange, c),
        (circumradius, flange_top),
        (0.0, flange_top),
    ]
    hex_solid = _chamfered_hex_solid(s, k, head_chamfer)   # z in [0, k], validates s/k/chamfer
    shank = _screw_shank(d_shank, length, tip_chamfer)     # z in [-length, 0], validates chamfer
    with BuildPart() as bp:
        add(hex_solid)
        with BuildSketch(Plane.XZ):
            Polygon(*flange_profile, align=None)
        revolve(axis=Axis.Z, revolution_arc=360)           # Mode.ADD (union) — flange around hex base
        add(shank)                                         # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                                   # net guard (not is_valid — sewn-shell)
        raise ValueError("hex_flange_bolt: produced an empty solid")
    if len(part.solids()) != 1:                            # flange + hex + shank must fuse to one solid
        raise ValueError("hex_flange_bolt: flange/head/shank did not fuse into a single solid")
    return part
