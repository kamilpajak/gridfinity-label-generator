"""Nib bolt family generator (Nasenschraube: DIN 604 flat countersunk, DIN 607 cup head).

A round shank with a small rectangular anti-rotation NIB (Nase) that digs into the mating
part and stops the bolt from turning while the nut is tightened (the nib-bolt sibling of the
carriage bolt's square neck). ``head_style`` selects the head, the same two-silhouette switch
as ``lock_nut.top_style`` — and, per the standards' figures (fasteners.eu drawings), also
WHERE the nib sits. Both standards tabulate ``i`` as the RADIAL nose height above the shank
(the figures' i arrows are radial; the legacy rasters agree). On the DIN 604
``"countersunk"`` head the nib is a wedge alongside the cone: top edge on the flat face out
to the rim, outer edge tapering to the nose corner (shank radius + i) at the bearing plane,
back face dropping to the shank at 15 degrees from the radial (the figure's angles). On the
DIN 607 ``"cup"`` head it is a triangular wedge on the shank hugging the z=0 bearing face —
full reach at the head, underside sloping to the shank per the figure's 30-degree slope.
Envelope-only: no drawn thread, no drive; the tabulated width (g) and nose height (i) are
honoured, the remaining wedge proportions are representative form.

Composes established idioms — the shank is ``screw_common._screw_shank`` (top face on the z=0
under-head bearing plane, body down -Z), the countersunk cone is the ``slotted_screw`` /
``carriage_bolt`` straight-revolve frustum, the cup dome is the ``cap_nut`` /
``carriage_bolt`` spherical cap. The nib box hangs below z=0 along +X and volumetrically
overlaps the shank, so head, shank and nib fuse into one solid (net volume>0 + single-solid
guards backstop the Booleans).
"""
import math

from build123d import (
    BuildPart, BuildSketch, Polygon, Sphere, Box, Locations,
    Plane, Axis, Align, Mode, extrude, revolve, add,
)

from catalog.models.screw_common import _screw_shank

_HEAD_STYLES = ("countersunk", "cup")
_NIB_BACK_DEG = 15.0   # DIN 604 nib back-face angle from the radial, per the standard's figure


def nib_bolt(d_shank: float, length: float, dk: float, k: float, head_style: str,
             nib_w: float, nib_d: float, nib_l: float | None = None,
             tip_chamfer: float | None = None):
    """Nib bolt: a smooth shank of diameter ``d_shank`` and ``length`` (z in [-length, 0],
    optional 45-degree lead ``tip_chamfer``), a head of diameter ``dk`` and height ``k`` above
    the z=0 bearing plane, and one rectangular nib along +X — width ``nib_w`` (tangential,
    along Y), radial reach ``nib_l`` from the axis, axial height ``nib_d``.
    ``head_style="countersunk"`` draws the DIN 604 cone frustum (``d_shank/2`` at z=0 widening
    to ``dk/2`` at z=k) with the nib as a wedge alongside the cone whose top corner IS the
    head-rim corner and whose back face lands ON the cone-shank junction (``nib_l`` must be
    omitted — the wedge is fully determined by dk/k/``nib_d``); ``nib_d`` is the tabulated
    radial nose height ``i``. ``head_style="cup"`` draws the DIN 607 spherical-cap dome with
    the nib as a triangular wedge on the shank — reach ``nib_l`` (required) at the z=0
    bearing face, underside sloping to the shank at z=-``nib_d`` (the figure's 30-degree
    slope; here ``nib_d`` is the wedge's axial extent). No thread, no drive.
    """
    for name, val in (("d_shank", d_shank), ("length", length), ("dk", dk), ("k", k),
                      ("nib_w", nib_w), ("nib_d", nib_d)):
        if val <= 0:
            raise ValueError(f"nib_bolt: need {name} > 0, got {val}")
    if head_style not in _HEAD_STYLES:
        raise ValueError(f"nib_bolt: head_style must be one of {_HEAD_STYLES}, got {head_style!r}")
    if d_shank >= dk:
        raise ValueError(
            f"nib_bolt: d_shank {d_shank} must be < head diameter dk {dk} "
            f"(the head must overhang the shank)")
    if nib_w >= d_shank:
        raise ValueError(
            f"nib_bolt: nib_w {nib_w} must be < d_shank {d_shank} (a nib is a narrow lug)")
    if head_style == "countersunk":
        if nib_l is not None:
            raise ValueError(
                "nib_bolt: nib_l is not a free parameter for the countersunk form — the DIN "
                "604 nib tops out exactly at the head rim (dk/2) per the standard's figure")
        if d_shank / 2.0 + nib_d >= dk / 2.0:
            raise ValueError(
                f"nib_bolt: shank radius + nib_d {d_shank / 2.0 + nib_d} must be < head "
                f"radius {dk / 2.0} (the nose corner stays inside the rim)")
    else:
        if nib_l is None:
            raise ValueError("nib_bolt: the cup form needs nib_l (radial nib reach)")
        if nib_l <= d_shank / 2.0:
            raise ValueError(
                f"nib_bolt: nib_l {nib_l} must exceed the shank radius {d_shank / 2.0} "
                f"(the nib must protrude past the shank)")
        if nib_l > dk / 2.0:
            raise ValueError(
                f"nib_bolt: nib_l {nib_l} must not exceed the head radius {dk / 2.0} "
                f"(the nib stays within the head outline)")
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
        # Nib along +X, width nib_w centred on Y=0; both variants overlap the head/shank
        # volumetrically near the axis, so the union is robust.
        if head_style == "countersunk":
            # DIN 604: a wedge alongside the head cone, per the figure and the legacy raster.
            # Two of its corners COINCIDE with existing silhouette vertices: the top corner is
            # the head-rim corner (dk/2, k) and the back face lands exactly on the cone-shank
            # junction (d_shank/2, 0). Between them the nose corner sits at
            # (d_shank/2 + nib_d, nib_d*tan(_NIB_BACK_DEG)) — i radial, back face 15 deg from
            # the radial; the outer edge's slight taper emerges from the tabulated numbers.
            # The sketch extends to the axis for a robust union.
            nose = (d_shank / 2.0 + nib_d, nib_d * math.tan(math.radians(_NIB_BACK_DEG)))
            with BuildSketch(Plane.XZ):
                Polygon((0.0, k), (dk / 2.0, k), nose,
                        (d_shank / 2.0, 0.0), (0.0, 0.0), align=None)
            extrude(amount=nib_w / 2.0, both=True)
        else:
            # DIN 607: a triangular wedge on the shank hugging the bearing face — full reach
            # nib_l at z=0, underside sloping down to meet the shank at z=-nib_d (the figure's
            # 30-degree slope, honoured via the tabulated i and the data's nib_l). The sketch
            # triangle extends the slope to the axis so the prism overlaps the shank.
            z0 = nib_d * nib_l / (nib_l - d_shank / 2.0)
            with BuildSketch(Plane.XZ):
                Polygon((0.0, 0.0), (nib_l, 0.0), (0.0, -z0), align=None)
            extrude(amount=nib_w / 2.0, both=True)
    part = bp.part
    if part.volume <= 0:                                 # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("nib_bolt: produced an empty solid")
    if len(part.solids()) != 1:                          # head + shank + nib must fuse to one solid
        raise ValueError("nib_bolt: head/shank/nib did not fuse into a single solid")
    return part
