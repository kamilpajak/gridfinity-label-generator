"""Prism-head bolt family generator (T-head DIN 261/787, T-head + square neck DIN 186,
square head + collar DIN 478).

The head is a rectangular block ``Box(head_len, head_width, head_height)`` centered on the shank
axis (a square head is the special case ``head_len == head_width``); the end view is the
distinctive rectangle/square. An ``under`` feature sits between the head and the shared
``_screw_shank``: nothing (``"none"``), a square anti-rotation neck (``"square_neck"`` — a
``Box(under_size, under_size, under_height)``), or a round bearing collar (``"collar"`` — a
``Cylinder``). Envelope-only: no drawn thread, no drive, no under-head fillet. Modelled
axis-along-Z: shank z in [-length, 0], the under feature z in [0, under_height], the head above it.
Head and under feature fuse to the shank by face contact (the screw_common stacking seam), guarded
by net volume>0 + single-solid.
"""
from build123d import BuildPart, Box, Cylinder, Locations, Align, add

from catalog.models.screw_common import _screw_shank

_UNDER = ("none", "square_neck", "collar")


def prism_head_bolt(d: float, length: float, head_len: float, head_width: float,
                    head_height: float, under: str = "none", under_size: float | None = None,
                    under_height: float | None = None, tip_chamfer: float | None = None):
    """Prism-head bolt: a rectangular/square head (``head_len`` x ``head_width`` x ``head_height``)
    over a smooth shank Ø``d`` x ``length`` (optional 45-degree lead ``tip_chamfer``). ``under`` is
    ``"none"`` (head on the bearing plane), ``"square_neck"`` (a square prism of side ``under_size``
    and height ``under_height``, DIN 186), or ``"collar"`` (a round flange of diameter ``under_size``
    and height ``under_height``, DIN 478). No thread, no drive.
    """
    for name, val in (("d", d), ("length", length), ("head_len", head_len),
                      ("head_width", head_width), ("head_height", head_height)):
        if val <= 0:
            raise ValueError(f"prism_head_bolt: need {name} > 0, got {val}")
    if under not in _UNDER:
        raise ValueError(f"prism_head_bolt: under must be one of {_UNDER}, got {under!r}")
    if under != "none":
        if under_size is None or under_size <= 0:
            raise ValueError(
                f"prism_head_bolt: under={under!r} needs under_size > 0, got {under_size}")
        if under_height is None or under_height <= 0:
            raise ValueError(
                f"prism_head_bolt: under={under!r} needs under_height > 0, got {under_height}")
    if d > min(head_len, head_width):
        raise ValueError(
            f"prism_head_bolt: d {d} must not exceed the smaller head side "
            f"{min(head_len, head_width)} (the shank emerges from the head bearing face and cannot be "
            f"wider than the head; d == the short side is allowed — the shank inscribes in the head)")

    shank = _screw_shank(d, length, tip_chamfer)          # z in [-length, 0], validates chamfer
    under_h = under_height if under != "none" else 0.0    # top plane of the under feature
    with BuildPart() as bp:
        add(shank)                                        # shares the z=0 face -> fuses
        if under == "square_neck":
            Box(under_size, under_size, under_height,
                align=(Align.CENTER, Align.CENTER, Align.MIN))       # z in [0, under_height]
        elif under == "collar":
            Cylinder(radius=under_size / 2.0, height=under_height,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))  # z in [0, under_height]
        with Locations((0.0, 0.0, under_h)):
            Box(head_len, head_width, head_height,
                align=(Align.CENTER, Align.CENTER, Align.MIN))       # head on top of the under feature
    part = bp.part
    if part.volume <= 0:                                  # net guard (not is_valid — sewn-shell)
        raise ValueError("prism_head_bolt: produced an empty solid")
    if len(part.solids()) != 1:                           # head + under + shank must fuse to one solid
        raise ValueError("prism_head_bolt: head/under/shank did not fuse into a single solid")
    return part
