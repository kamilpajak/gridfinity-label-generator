"""Nib bolt family generator (Nasenschraube: DIN 604 flat countersunk, DIN 607 cup head).

A round shank with a small rectangular anti-rotation NIB (Nase) under the head — the nib is a
lug that digs into the mating part and stops the bolt from turning while the nut is tightened
(the nib-bolt sibling of the carriage bolt's square neck). ``head_style`` selects the head, the
same two-silhouette switch as ``lock_nut.top_style``: ``"countersunk"`` is the flat conical
DIN 604 head, ``"cup"`` the shallow domed DIN 607 head. Envelope-only: no drawn thread, no
drive (the nib is the anti-rotation feature); the nib is drawn as a simple extruded box — its
tabulated width (g) and depth (i) are honoured, its radial extent is representative form (DIN
604/607 do not tabulate it).

Composes established idioms — the shank is ``screw_common._screw_shank`` (top face on the z=0
under-head bearing plane, body down -Z), the countersunk cone is the ``slotted_screw`` /
``carriage_bolt`` straight-revolve frustum, the cup dome is the ``cap_nut`` /
``carriage_bolt`` spherical cap. The nib box hangs below z=0 along +X and volumetrically
overlaps the shank, so head, shank and nib fuse into one solid (net volume>0 + single-solid
guards backstop the Booleans).
"""
from build123d import (
    BuildPart, BuildSketch, Polygon, Sphere, Box, Locations,
    Plane, Axis, Align, Mode, revolve, add,
)

from catalog.models.screw_common import _screw_shank

_HEAD_STYLES = ("countersunk", "cup")


def nib_bolt(d_shank: float, length: float, dk: float, k: float, head_style: str,
             nib_w: float, nib_l: float, nib_d: float, tip_chamfer: float | None = None):
    """Nib bolt: a smooth shank of diameter ``d_shank`` and ``length`` (z in [-length, 0],
    optional 45-degree lead ``tip_chamfer``), a head of diameter ``dk`` and height ``k`` above
    the z=0 bearing plane, and one rectangular nib under the head along +X — width ``nib_w``
    (tangential, along Y), radial reach ``nib_l`` from the axis, hanging ``nib_d`` below z=0.
    ``head_style="countersunk"`` draws the DIN 604 cone frustum (``d_shank/2`` at z=0 widening
    to ``dk/2`` at z=k); ``head_style="cup"`` draws the DIN 607 spherical-cap dome. No thread,
    no drive.
    """
    for name, val in (("d_shank", d_shank), ("length", length), ("dk", dk), ("k", k),
                      ("nib_w", nib_w), ("nib_l", nib_l), ("nib_d", nib_d)):
        if val <= 0:
            raise ValueError(f"nib_bolt: need {name} > 0, got {val}")
    if head_style not in _HEAD_STYLES:
        raise ValueError(f"nib_bolt: head_style must be one of {_HEAD_STYLES}, got {head_style!r}")
    if d_shank >= dk:
        raise ValueError(
            f"nib_bolt: d_shank {d_shank} must be < head diameter dk {dk} "
            f"(the head must overhang the shank)")
    if nib_l <= d_shank / 2.0:
        raise ValueError(
            f"nib_bolt: nib_l {nib_l} must exceed the shank radius {d_shank / 2.0} "
            f"(the nib must protrude past the shank)")
    if nib_l > dk / 2.0:
        raise ValueError(
            f"nib_bolt: nib_l {nib_l} must not exceed the head radius {dk / 2.0} "
            f"(the nib stays within the head outline)")
    if nib_w >= d_shank:
        raise ValueError(
            f"nib_bolt: nib_w {nib_w} must be < d_shank {d_shank} (a nib is a narrow lug)")
    if nib_d >= length:
        raise ValueError(
            f"nib_bolt: nib_d {nib_d} must be < length {length} "
            f"(the nib may not reach past the shank tip)")

    shank = _screw_shank(d_shank, length, tip_chamfer)   # z in [-length, 0]; validates chamfer

    # Build the cup dome in its own closed context first (the carriage_bolt / cap_nut idiom —
    # its trim Box SUBTRACT must not eat the shank), then union it below.
    cup_solid = None
    if head_style == "cup":
        r_base = dk / 2.0
        sphere_r = (r_base ** 2 + k ** 2) / (2.0 * k)    # cap height -> sphere radius R
        z_c = k - sphere_r                               # sphere centre on Z (apex at z=k)
        big = 4.0 * (sphere_r + k)                       # trim box, comfortably larger than the cap
        with BuildPart() as cap_bp:
            with Locations((0.0, 0.0, z_c)):
                Sphere(radius=sphere_r)
            with Locations((0.0, 0.0, -big / 2.0)):
                Box(big, big, big, mode=Mode.SUBTRACT)   # keep only z >= 0
        cup_solid = cap_bp.part

    with BuildPart() as bp:
        add(shank)                                       # z in [-length, 0]
        if head_style == "cup":
            add(cup_solid)                               # dome base disc shares the z=0 face
        else:                                            # countersunk cone frustum, narrow at z=0
            # (x=radius, z=axial): shank-top disc -> up-out to the flat top rim -> back to axis
            profile = [(0.0, 0.0), (d_shank / 2.0, 0.0), (dk / 2.0, k), (0.0, k)]
            with BuildSketch(Plane.XZ):
                Polygon(*profile, align=None)
            revolve(axis=Axis.Z, revolution_arc=360)     # unions the cone (default Mode.ADD)
        # Nib: one box along +X from the axis to nib_l, width nib_w centred on Y=0, hanging
        # nib_d below the bearing plane. It volumetrically overlaps the shank (x < d_shank/2),
        # so the union is robust for both head styles.
        Box(nib_l, nib_w, nib_d, align=(Align.MIN, Align.CENTER, Align.MAX))
    part = bp.part
    if part.volume <= 0:                                 # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("nib_bolt: produced an empty solid")
    if len(part.solids()) != 1:                          # head + shank + nib must fuse to one solid
        raise ValueError("nib_bolt: head/shank/nib did not fuse into a single solid")
    return part
