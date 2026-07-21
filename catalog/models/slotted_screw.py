"""Slotted & cross-recess machine screw family generator (DIN 84/85/963/966,
ISO 1207/1580/2009/2010/7045/7046/7047).

A smooth cylindrical shank (envelope-only, no drawn thread) with a shaped head on top and a slot
or cross recess cut into the head. Two orthogonal features select the standard: ``head`` picks the
head silhouette (cheese / pan / countersunk / raised) and ``drive`` picks the recess (slot /
cross). The shank reuses the shared ``_screw_shank`` (top face on the under-head bearing plane
z=0, built down -Z); the head is built above z=0 so a plain add() fuses head and shank into one
solid.

Flat-topped heads (cheese, countersunk) are one revolve of a straight-segment XZ meridian (the
deterministic set_screw technique). Domed portions (the pan crown, the raised lens) reuse the
cap_nut spherical-cap idiom: a Sphere trimmed by a Box to a cap of the required height seated on
its base circle -- so the crown needs no arc-meridian and no radius parameter (the sphere radius
is derived, R = (r**2 + h**2) / (2h)). The cross recess is a REPRESENTATIVE tapered-pyramidal icon
(a lofted four-arm cutter), not the dimensioned ISO 4757 curve. Modelled axis-along-Z: under the
default camera the front view is the head end view (slot/cross) and the side view is the
horizontal head+shank elevation.
"""
from build123d import (
    BuildPart, BuildSketch, Polygon, Rectangle, Sphere, Box, Plane, Axis, Align, Mode,
    Locations, add, revolve, loft,
)

from catalog.models.screw_common import _screw_shank

_HEADS = ("cheese", "pan", "countersunk", "raised")
_DRIVES = ("slot", "cross")
_RECESS_EPS = 0.05           # drive cutter overshoot above the crown for a clean rim cut
_CROSS_TAPER = 0.35          # cross floor arm-span as a fraction of the surface span (converging)
_SLOT_OVERHANG = 2.0         # slot cutter length past the head diameter, so it spans edge-to-edge
_MIN_FLOOR_MM = 0.1          # minimum head metal left below the blind recess floor


def _spherical_cap(base_r: float, base_z: float, height: float):
    """A solid spherical cap of ``height`` seated on the circle of radius ``base_r`` at plane
    ``z = base_z`` (apex at ``base_z + height``). Built as a full Sphere trimmed to the half-space
    ``z >= base_z`` -- the cap_nut idiom (deterministic, no arc-meridian). The cap's flat base
    circle has radius exactly ``base_r``."""
    assert height > 0, f"_spherical_cap requires height > 0, got {height}"
    sphere_r = (base_r ** 2 + height ** 2) / (2.0 * height)        # cap height -> sphere radius R
    z_c = base_z + height - sphere_r                              # sphere centre on the Z axis
    big = 4.0 * (sphere_r + height + abs(base_z))                 # trim box, larger than the cap
    with BuildPart() as cap:
        with Locations((0.0, 0.0, z_c)):
            Sphere(radius=sphere_r)
        with Locations((0.0, 0.0, base_z - big / 2.0)):
            Box(big, big, big, mode=Mode.SUBTRACT)                # keep only z >= base_z
    return cap.part


def _head_solid(head: str, dk: float, k: float, d_shank: float,
                crown_r: float | None, raised_f: float | None):
    """The head solid, bearing face on z=0, occupying z in [0, k] (``raised`` extends to
    z = k + raised_f). (x=radius, z=axial) meridians are revolved about Z."""
    r = dk / 2.0
    if head == "cheese":
        if crown_r is not None:                                   # small 45-deg top-edge break
            c = crown_r
            profile = [(0.0, 0.0), (r, 0.0), (r, k - c), (r - c, k), (0.0, k)]
        else:
            profile = [(0.0, 0.0), (r, 0.0), (r, k), (0.0, k)]
        with BuildPart() as bp:
            with BuildSketch(Plane.XZ):
                Polygon(*profile, align=None)
            revolve(axis=Axis.Z, revolution_arc=360)
        return bp.part
    if head == "pan":                                             # shallow dome from the base circle
        return _spherical_cap(r, 0.0, k)
    # countersunk cone frustum: radius d_shank/2 at z=0 widening to dk/2 at the flush flat top z=k
    profile = [(0.0, 0.0), (d_shank / 2.0, 0.0), (r, k), (0.0, k)]
    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)
        revolve(axis=Axis.Z, revolution_arc=360)
        if head == "raised":
            add(_spherical_cap(r, k, raised_f))                   # raised lens on the cone top
    return bp.part


def _drive_cutter(drive: str, dk: float, drive_w: float, drive_t: float,
                  drive_m: float | None, top_z: float):
    """A cutter solid removed from the head top to form the drive. Its top sits ``_RECESS_EPS``
    above ``top_z`` so the rim cuts cleanly; the recess floor is flat at ``top_z - drive_t``."""
    top = top_z + _RECESS_EPS
    depth = drive_t + _RECESS_EPS
    if drive == "slot":
        span = dk + _SLOT_OVERHANG                                # edge-to-edge, past both rims
        with BuildPart() as cut:
            with Locations((0.0, 0.0, top)):
                # Slot runs along Y (drive_w in X), so it reads HORIZONTAL in the front/end view
                # (which looks down Z with X vertical on screen).
                Box(drive_w, span, depth, align=(Align.CENTER, Align.CENTER, Align.MAX))
        return cut.part
    # cross: a lofted tapered four-arm cutter, wide "+" at the surface converging toward the floor
    floor_m = drive_m * _CROSS_TAPER
    floor_w = drive_w * _CROSS_TAPER
    with BuildPart() as cut:
        with BuildSketch(Plane.XY.offset(top)):                   # full-size cross at the surface
            Rectangle(drive_m, drive_w)
            Rectangle(drive_w, drive_m)
        with BuildSketch(Plane.XY.offset(top - depth)):           # smaller cross at the floor
            Rectangle(floor_m, floor_w)
            Rectangle(floor_w, floor_m)
        loft()
    return cut.part


def slotted_screw(head: str, drive: str, dk: float, k: float, length: float, d_shank: float,
                  drive_w: float, drive_t: float, crown_r: float | None = None,
                  raised_f: float | None = None, drive_m: float | None = None,
                  tip_chamfer: float | None = None):
    """Slotted / cross-recess machine screw: a shaped ``head`` of diameter ``dk`` and height ``k``
    over a smooth shank of diameter ``d_shank`` and ``length`` (optional lead ``tip_chamfer``), with
    a ``drive`` recess of width ``drive_w`` and depth ``drive_t`` cut into the head top. ``head`` is
    "cheese" (cylinder, optional ``crown_r`` edge break), "pan" (spherical-cap dome), "countersunk"
    (flat cone frustum), or "raised" (cone + a ``raised_f`` spherical lens). ``drive`` is "slot"
    (one straight edge-to-edge slot) or "cross" (a representative tapered-pyramidal four-arm recess
    of overall span ``drive_m``). No through bore, no drawn thread.
    """
    for name, val in (("dk", dk), ("k", k), ("length", length), ("d_shank", d_shank),
                      ("drive_w", drive_w), ("drive_t", drive_t)):
        if val <= 0:
            raise ValueError(f"slotted_screw: need {name} > 0, got {val}")
    if head not in _HEADS:
        raise ValueError(f"slotted_screw: head must be one of {_HEADS}, got {head!r}")
    if drive not in _DRIVES:
        raise ValueError(f"slotted_screw: drive must be one of {_DRIVES}, got {drive!r}")
    if d_shank >= dk:
        raise ValueError(
            f"slotted_screw: d_shank {d_shank} must be < head diameter {dk} "
            f"(the shank emerges from the head bearing face and is narrower than the head)")
    if head == "raised" and (raised_f is None or raised_f <= 0):
        raise ValueError(f"slotted_screw: raised head needs raised_f > 0, got {raised_f}")
    if crown_r is not None and head != "cheese":
        raise ValueError("slotted_screw: crown_r applies only to the cheese head")
    if head == "cheese" and crown_r is not None and not (0.0 < crown_r < min(dk / 2.0, k)):
        raise ValueError(
            f"slotted_screw: crown_r {crown_r} must be > 0 and < min(dk/2, k) = {min(dk / 2.0, k)}")
    if drive == "cross":
        if drive_m is None or drive_m <= 0:
            raise ValueError(f"slotted_screw: cross drive needs drive_m > 0, got {drive_m}")
        # drive_m may reach dk (the cross arms touch the head rim) for the representative recess;
        # drive_w < drive_m keeps the arms finite and the net solids()==1 guard backstops manifoldness.
        if drive_m > dk:
            raise ValueError(
                f"slotted_screw: cross drive_m {drive_m} must be <= head diameter {dk}")
        if drive_w >= drive_m:
            raise ValueError(
                f"slotted_screw: cross drive_w {drive_w} must be < drive_m {drive_m} "
                f"(the arm is narrower than the overall cross span)")
    elif drive_w >= dk:
        raise ValueError(f"slotted_screw: slot drive_w {drive_w} must be < head diameter {dk}")
    if drive_t >= k - _MIN_FLOOR_MM:
        raise ValueError(
            f"slotted_screw: drive_t {drive_t} leaves too thin a head floor below the "
            f"recess (needs drive_t < k - {_MIN_FLOOR_MM} = {k - _MIN_FLOOR_MM})")

    shank = _screw_shank(d_shank, length, tip_chamfer)            # z in [-length, 0], validates chamfer
    head_solid = _head_solid(head, dk, k, d_shank, crown_r, raised_f)
    top_z = k + raised_f if head == "raised" else k              # head's maximum-Z plane
    cutter = _drive_cutter(drive, dk, drive_w, drive_t, drive_m, top_z)
    with BuildPart() as bp:
        add(head_solid)                                          # head z in [0, top_z]
        add(shank)                                               # shares the z=0 face -> fuses
        add(cutter, mode=Mode.SUBTRACT)                          # slot / cross recess from the top
    part = bp.part
    if part.volume <= 0:                                         # net guard (not is_valid -- sewn-shell)
        raise ValueError("slotted_screw: produced an empty solid")
    if len(part.solids()) != 1:                                  # head and shank must FUSE, not touch
        raise ValueError("slotted_screw: head and shank did not fuse into a single solid")
    return part
