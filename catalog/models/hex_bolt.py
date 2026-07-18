"""Hex-head bolt family generator (ISO 4014 / 4017 and the hex-head screw family).

A chamfered hex head (reused from ``hex_nut``) with a smooth cylindrical shank hanging below it.
The shank is envelope-only (no drawn thread) and there is no bore — the external hex head is the
bolt's own drive. Modelled axis-along-Z: the head sits z in [0, k] (bearing face on z=0), the
shank z in [-length, 0]; under the default camera the front view is the hexagon end view and the
side view is the horizontal head+shank elevation.
"""
from build123d import BuildPart, add

from catalog.models.hex_nut import _chamfered_hex_solid
from catalog.models.screw_common import _screw_shank


def hex_bolt(s: float, k: float, length: float, d_shank: float,
             head_chamfer: float | None = None, tip_chamfer: float | None = None):
    """Hex-head bolt: across-flats ``s`` head of height ``k`` (vertex-up, chamfered by
    ``head_chamfer``) over a smooth shank of diameter ``d_shank`` and ``length`` (with an
    optional lead ``tip_chamfer`` at the free end). No bore, no drawn thread.
    """
    for name, val in (("s", s), ("k", k), ("length", length), ("d_shank", d_shank)):
        if val <= 0:
            raise ValueError(f"hex_bolt: need {name} > 0, got {val}")
    if d_shank >= s:
        raise ValueError(
            f"hex_bolt: d_shank {d_shank} must be < across-flats {s} (the shank emerges from "
            f"the head bearing face and is narrower than the head)")

    head = _chamfered_hex_solid(s, k, head_chamfer)          # z in [0, k], validates s/k/chamfer
    shank = _screw_shank(d_shank, length, tip_chamfer)       # z in [-length, 0], validates chamfer
    with BuildPart() as bp:
        add(head)
        add(shank)                                           # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                                     # net guard (not is_valid)
        raise ValueError("hex_bolt: produced an empty solid")
    if len(part.solids()) != 1:                              # head and shank must FUSE, not just touch
        raise ValueError("hex_bolt: head and shank did not fuse into a single solid")
    return part
