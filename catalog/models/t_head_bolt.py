"""T-head (hammer) bolt family generator (DIN 186 T-head bolt with square neck,
DIN 787 T-slot bolt).

A rectangular T-head on a round shank. DIN 186 (Hammerschraube mit Vierkant) adds an
anti-rotation SQUARE NECK directly under the head, flush with the head's narrow faces
(square side = head width n for M12); DIN 787 (T-slot bolt) has no neck — its rectangular
head itself locks in the machine-tool T-slot (dropped through the slot opening on the
narrow width ``head_w``, turned 90 degrees so ``head_l`` spans the undercut). One
parametric family covers both forms: the optional square neck selects between them.

Modelled axis-along-Z on the screw_common stacking seam: the round shank z in [-length, 0]
(``screw_common._screw_shank``), the optional square neck z in [0, neck_h], the head block
above (the carriage_bolt square-neck-under-a-head approach, with axis-aligned flats since
the DIN 186 square is flush with the head sides). Envelope-only per the epic's fine-feature
rule: no drawn thread, and the hammer head's end rounding / corner radii (untabulated fine
details) are omitted — the head is its ``head_l`` x ``head_w`` x ``head_h`` box. The Box
solids fuse by face contact (neck bottom on the shank top face at z=0, head bottom on the
neck top), guarded by net volume>0 + single-solid.
"""
from build123d import BuildPart, Box, Locations, Align, add

from catalog.models.screw_common import _screw_shank

_BOTTOM = (Align.CENTER, Align.CENTER, Align.MIN)   # centred in X/Y, base on the build plane


def t_head_bolt(d_shank: float, length: float, head_l: float, head_w: float, head_h: float,
                neck_w: float | None = None, neck_h: float | None = None,
                tip_chamfer: float | None = None):
    """T-head bolt: a rectangular head ``head_l`` (long axis, along X) x ``head_w`` (Y) x
    ``head_h`` over a smooth shank of diameter ``d_shank`` and ``length`` (z in [-length, 0],
    optional 45-degree lead ``tip_chamfer``). Passing BOTH ``neck_w``/``neck_h`` inserts an
    anti-rotation square neck (side ``neck_w``, flats parallel to the head sides, axial
    ``neck_h``) between head and shank (DIN 186); omitting both seats the head straight on
    the z=0 bearing plane (DIN 787). No thread, no drive.
    """
    for name, val in (("d_shank", d_shank), ("length", length), ("head_l", head_l),
                      ("head_w", head_w), ("head_h", head_h)):
        if val <= 0:
            raise ValueError(f"t_head_bolt: need {name} > 0, got {val}")
    if head_l < head_w:
        raise ValueError(
            f"t_head_bolt: head_l {head_l} must be >= head_w {head_w} (head_l is the T long axis)")
    if head_w < d_shank:
        raise ValueError(
            f"t_head_bolt: head_w {head_w} must be >= d_shank {d_shank} "
            f"(the head must cover the shank; DIN 186 M12 has them equal)")
    if (neck_w is None) != (neck_h is None):
        raise ValueError(
            "t_head_bolt: square neck needs BOTH neck_w and neck_h (or neither for DIN 787)")
    if neck_w is not None:
        for name, val in (("neck_w", neck_w), ("neck_h", neck_h)):
            if val <= 0:
                raise ValueError(f"t_head_bolt: need {name} > 0, got {val}")
        if neck_w < d_shank:
            raise ValueError(
                f"t_head_bolt: neck_w {neck_w} must be >= d_shank {d_shank} "
                f"(the square neck must cover the shank; DIN 186 M12 has them equal)")
        if neck_w > head_w:
            raise ValueError(
                f"t_head_bolt: neck_w {neck_w} must not exceed head_w {head_w} "
                f"(the square sits flush within the head footprint)")

    shank = _screw_shank(d_shank, length, tip_chamfer)   # z in [-length, 0]; validates chamfer
    with BuildPart() as bp:
        add(shank)
        neck_top = 0.0
        if neck_w is not None:
            # square neck, z in [0, neck_h] — fuses to the shank top face at z=0
            Box(neck_w, neck_w, neck_h, align=_BOTTOM)
            neck_top = neck_h
        with Locations((0.0, 0.0, neck_top)):
            # rectangular T-head, z in [neck_top, neck_top + head_h] — fuses on the neck top
            Box(head_l, head_w, head_h, align=_BOTTOM)
    part = bp.part
    if part.volume <= 0:                     # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("t_head_bolt: produced an empty solid")
    if len(part.solids()) != 1:              # head + (neck +) shank must fuse to one solid
        raise ValueError("t_head_bolt: head/neck/shank did not fuse into a single solid")
    return part
