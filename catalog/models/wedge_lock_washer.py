"""Wedge-lock washer (DIN 25201) generator — a REPRESENTATIVE icon.

A DIN 25201 wedge-lock washer is an annular ring with fine RADIAL serrations on one face (they
bite the clamped part) and a CIRCUMFERENTIAL cam surface on the mating face (cam ramp angle greater
than the thread pitch, so the pair jacks apart rather than loosening). The pair uses two identical
washers; the catalog ships the single repeating unit.

The exact DIN 25201 cam curve and serration pitch are paywalled and, at real sub-millimetre depth,
invisible at label scale. So both faces are modelled as a REPRESENTATIVE, deliberately legible icon
(like the Torx/cross recesses in the screw families), not the dimensioned geometry: `teeth` radial
grooves cut into the top face, and `cam_count` circumferential notches cut into a mid-ring band of
the bottom face. Both are `PolarLocations` patterns (deterministic, no fragile edge selection). The
ring is centred on z=0. Net guards keep it one valid solid.
"""
import math

from build123d import (
    BuildPart, BuildSketch, Cylinder, Rectangle, Plane, PolarLocations, Mode, extrude,
)

_TOOTH_W_FRAC = 0.5      # radial-groove tangential width as a fraction of the tooth pitch
_CAM_ARC_FRAC = 0.6      # cam-notch tangential width as a fraction of the cam pitch
_CAM_BAND_FRAC = 0.7     # cam notches span this fraction of the ring width (mid-band; rims survive)


def wedge_lock_washer(d_inner: float, d_outer: float, thickness: float, teeth: int,
                      cam_count: int, cam_height: float, tooth_depth: float):
    """Representative wedge-lock washer: an annular ring (``d_inner``..``d_outer``, ``thickness``)
    with ``teeth`` radial serrations cut ``tooth_depth`` into the top face and ``cam_count``
    circumferential cam notches cut ``cam_height`` into a mid-band of the bottom face. Ring centred
    on ``z=0``. The serration/cam geometry is a legible representative icon, not the dimensioned
    DIN 25201 form."""
    if not (0 < d_inner < d_outer):
        raise ValueError(f"wedge_lock_washer: need 0 < d_inner < d_outer, got {d_inner}, {d_outer}")
    if thickness <= 0 or cam_height <= 0 or tooth_depth <= 0:
        raise ValueError(
            f"wedge_lock_washer: need positive thickness, cam_height, tooth_depth, "
            f"got {thickness}, {cam_height}, {tooth_depth}")
    if teeth < 3 or cam_count < 3:
        raise ValueError(
            f"wedge_lock_washer: need teeth >= 3 and cam_count >= 3, got {teeth}, {cam_count}")
    if cam_height >= thickness or tooth_depth >= thickness:
        raise ValueError(
            f"wedge_lock_washer: cam_height {cam_height} and tooth_depth {tooth_depth} must each "
            f"be < thickness {thickness}")
    if tooth_depth + cam_height >= thickness:
        raise ValueError(
            f"wedge_lock_washer: tooth_depth + cam_height ({tooth_depth + cam_height}) must be "
            f"< thickness {thickness} so a solid core remains between the top and bottom features")

    r_in = d_inner / 2.0
    r_out = d_outer / 2.0
    r_mean = (r_in + r_out) / 2.0
    ring_w = r_out - r_in
    top = thickness / 2.0
    bottom = -thickness / 2.0
    tooth_w = (2.0 * math.pi * r_mean / teeth) * _TOOTH_W_FRAC      # groove tangential width (repr)
    cam_arc = (2.0 * math.pi * r_mean / cam_count) * _CAM_ARC_FRAC  # notch tangential width (repr)

    with BuildPart() as bp:
        Cylinder(radius=r_out, height=thickness)                    # ring z in [-t/2, t/2]
        Cylinder(radius=r_in, height=thickness, mode=Mode.SUBTRACT)
        # Radial serrations cut into the TOP face: `teeth` radial slots at the mean radius.
        with BuildSketch(Plane.XY.offset(top)):
            with PolarLocations(r_mean, teeth):
                Rectangle(ring_w * 1.05, tooth_w)                   # length radial, width tangential
        extrude(amount=-tooth_depth, mode=Mode.SUBTRACT)            # cut down into the top
        # Circumferential cam notches cut into a MID-BAND of the BOTTOM face: `cam_count` tangential
        # notches (inner and outer rims survive, keeping the ring one solid).
        with BuildSketch(Plane.XY.offset(bottom)):
            with PolarLocations(r_mean, cam_count):
                Rectangle(ring_w * _CAM_BAND_FRAC, cam_arc)         # radial band, tangential width
        extrude(amount=cam_height, mode=Mode.SUBTRACT)              # cut up into the bottom
    part = bp.part
    if part.volume <= 0:                                            # net guard
        raise ValueError("wedge_lock_washer: produced an empty solid")
    if len(part.solids()) != 1:                                     # ring must stay a single solid
        raise ValueError("wedge_lock_washer: produced more than one solid")
    return part
