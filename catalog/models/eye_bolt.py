"""Eye bolt family generator (DIN 444 'Augenschraube', Type B form): a flat annular eye
on a smooth shank.

The eye is a ring drawn in the XZ plane — its plane CONTAINS the screw axis — with outer
diameter ``eye_od`` (DIN 444 d3), through hole ``eye_hole`` (d2) and width ``eye_t`` (s),
extruded symmetrically in Y like a wing blade. A rectangular neck of width ``d_shank``
bridges the ring down to the z=0 bearing plane so head and shank meet on a full face (the
tangent ring alone would touch the shank in a single point — a fragile Boolean seam).
Below z=0 hangs a smooth envelope-only shank (``screw_common._screw_shank``) — no drawn
thread, per the epic's fine-feature rule; the DIN 444 eye-to-shank transition radius r is
likewise omitted (straight neck is representative form). Guarded by net volume>0 +
single-solid.
"""
from build123d import (
    BuildPart, BuildSketch, Circle, Rectangle, Locations,
    Plane, Align, Mode, add, extrude,
)

from catalog.models.screw_common import _screw_shank


def eye_bolt(d_shank: float, length: float, eye_od: float, eye_hole: float,
             eye_t: float, tip_chamfer: float | None = None):
    """DIN 444 eye bolt: an annular eye of outer diameter ``eye_od``, bore ``eye_hole``
    and width ``eye_t`` whose plane contains the screw axis (ring center at z=eye_od/2,
    so the eye occupies z in [0, eye_od]), over a smooth shank of diameter ``d_shank``
    and ``length`` (z in [-length, 0], optional 45-degree lead ``tip_chamfer``).
    Envelope only: no drawn thread, no eye-to-shank blend radius.
    """
    for name, val in (("d_shank", d_shank), ("length", length), ("eye_od", eye_od),
                      ("eye_hole", eye_hole), ("eye_t", eye_t)):
        if val <= 0:
            raise ValueError(f"eye_bolt: need {name} > 0, got {val}")
    if eye_hole >= eye_od:
        raise ValueError(
            f"eye_bolt: eye_hole {eye_hole} must be < eye_od {eye_od} (the ring needs a wall)")
    if eye_od <= d_shank:
        raise ValueError(
            f"eye_bolt: eye_od {eye_od} must exceed d_shank {d_shank} (the eye overhangs the shank)")

    zc = eye_od / 2.0                                    # ring center height above the bearing plane
    shank = _screw_shank(d_shank, length, tip_chamfer)   # z in [-length, 0], validates chamfer
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            with Locations((0.0, zc)):
                Circle(radius=eye_od / 2.0)              # eye disk, bottom tangent to z=0
            # Neck bridging the ring to the shank: full-width face contact at z=0 (the
            # screw_common stacking seam) instead of the disk's single tangent point.
            Rectangle(d_shank, zc, align=(Align.CENTER, Align.MIN))
            with Locations((0.0, zc)):
                Circle(radius=eye_hole / 2.0, mode=Mode.SUBTRACT)   # the eye's through hole
        extrude(amount=eye_t / 2.0, both=True)           # width eye_t, centered on Y=0
        add(shank)                                       # shares the z=0 face -> fuses
    part = bp.part
    if part.volume <= 0:                         # net guard (matches the family; not is_valid)
        raise ValueError("eye_bolt: produced an empty solid")
    if len(part.solids()) != 1:                  # eye + neck + shank must fuse to one solid
        raise ValueError("eye_bolt: eye/shank did not fuse into a single solid")
    return part
