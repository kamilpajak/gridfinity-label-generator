"""Square head bolt family generator (DIN 478: square head bolts with collar).

A vertex-up square head (across-flats ``s``, the ``square_nut`` orientation — a corner points
along +X, the view's up axis) standing on a round collar washer face (diameter ``dc``,
thickness ``c``), with a smooth envelope-only shank (``screw_common._screw_shank``) hanging
below the z=0 bearing plane — no drawn thread, per the epic's fine-feature rule. ``k`` is the
DIN letter: the TOTAL head height from the collar bearing face to the square top, collar
included (cross-checked against DIN 479, whose collarless square head has k=12 at M12 vs
DIN 478's k=15 with c=3). The square corners are drawn sharp (across-corners ``s*sqrt(2)``);
the DIN table's rounded-corner width e (17 < s*sqrt(2) at M12) is omitted as an envelope
simplification — the sharp corners still sit inside the collar, which the ``dc`` guard
enforces. Square prism (z in [0, k]) and collar (z in [0, c]) union by overlap; the shank
fuses at the z=0 face-contact seam (the screw_common stacking convention), guarded by net
volume>0 + single-solid.
"""
import math

from build123d import (
    BuildPart, BuildSketch, RegularPolygon, Cylinder, Align, extrude, add,
)

from catalog.models.screw_common import _screw_shank


def square_head_bolt(s: float, k: float, dc: float, c: float, d_shank: float,
                     length: float, tip_chamfer: float | None = None):
    """DIN 478 square head bolt with collar: a vertex-up square head of across-flats ``s``
    and total height ``k`` (collar included) on a collar of diameter ``dc`` and thickness
    ``c`` (head z in [0, k], bearing face on z=0), over a smooth shank of diameter
    ``d_shank`` and ``length`` (z in [-length, 0], optional 45-degree lead ``tip_chamfer``).
    No bore, no drive, no drawn thread — the square head is the bolt's own drive.
    """
    for name, val in (("s", s), ("k", k), ("dc", dc), ("c", c),
                      ("d_shank", d_shank), ("length", length)):
        if val <= 0:
            raise ValueError(f"square_head_bolt: need {name} > 0, got {val}")
    if c >= k:
        raise ValueError(
            f"square_head_bolt: collar thickness c {c} must be < total head height k {k} "
            f"(k includes the collar; the square must rise above it)")
    across_corners = s * math.sqrt(2.0)                  # sharp-square corner-to-corner diagonal
    if dc <= across_corners:
        raise ValueError(
            f"square_head_bolt: collar dc {dc} must exceed the square across-corners "
            f"{across_corners:.3f} (else the collar washer face hides inside the head)")
    if d_shank >= dc:
        raise ValueError(
            f"square_head_bolt: d_shank {d_shank} must be < collar dc {dc} (the shank "
            f"emerges from the collar bearing face and is narrower than it)")

    shank = _screw_shank(d_shank, length, tip_chamfer)   # z in [-length, 0], validates chamfer
    half_diag = s / math.sqrt(2.0)                       # square across-corners / 2
    with BuildPart() as bp:
        with BuildSketch():
            RegularPolygon(radius=half_diag, side_count=4, rotation=0)   # vertex-up (corner on +X)
        extrude(amount=k)                                # square prism z in [0, k] (full head height)
        Cylinder(radius=dc / 2.0, height=c,
                 align=(Align.CENTER, Align.CENTER, Align.MIN))   # collar z in [0, c], overlap-union
        add(shank)                                       # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                                 # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("square_head_bolt: produced an empty solid")
    if len(part.solids()) != 1:                          # head + collar + shank must fuse to one solid
        raise ValueError("square_head_bolt: head/collar/shank did not fuse into a single solid")
    return part
