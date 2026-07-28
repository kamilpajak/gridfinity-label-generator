"""Carriage / cup-head bolt family generator (DIN 603 / ISO 8677 cup, DIN 605 countersunk).

A round shank with an anti-rotation SQUARE NECK (Vierkantansatz) directly under the head; the head is
either a shallow cup / mushroom dome (``head="cup"``, DIN 603 / ISO 8677) or a countersunk cone
(``head="countersunk"``, DIN 605). Envelope-only: no drawn thread, no drive recess (a carriage bolt
is held against rotation by its square neck, not a drive). Modelled axis-along-Z: the round shank
sits z in [-length, 0], the square neck z in [0, square_depth], the head above z=square_depth.

Composes established idioms — the shank is ``screw_common._screw_shank``, the square neck is the
``square_nut`` extruded-square-prism, the cup dome is the ``cap_nut`` spherical cap; the only new
profile is the countersunk cone frustum (a straight revolve). Head solids fuse to the neck via
face-contact ``add`` (the head base disc / cone base sits on the square-neck top plane), and the
neck fuses to the shank at z=0 — the same stacking seam ``screw_common`` documents. A net volume>0
and single-solid guard backstop the fusion.
"""
import math

from build123d import (
    BuildPart, BuildSketch, RegularPolygon, Polygon, Sphere, Box, Locations,
    Plane, Axis, Mode, extrude, revolve, add,
)

from catalog.models.screw_common import _screw_shank

_HEADS = ("cup", "countersunk")


def carriage_bolt(d: float, length: float, dk: float, k: float, head: str,
                  square_w: float, square_depth: float, tip_chamfer: float | None = None):
    """Carriage bolt: round shank Ø``d`` x ``length`` (optional 45-degree lead ``tip_chamfer``), an
    anti-rotation square neck (across-flats ``square_w``, axial ``square_depth``) under the head, and
    a head of diameter ``dk`` and height ``k``. ``head="cup"`` draws a shallow spherical-cap dome
    (DIN 603 / ISO 8677); ``head="countersunk"`` draws a cone frustum wide at the top face narrowing
    to the neck (DIN 605). No thread, no drive.
    """
    for name, val in (("d", d), ("length", length), ("dk", dk), ("k", k),
                      ("square_w", square_w), ("square_depth", square_depth)):
        if val <= 0:
            raise ValueError(f"carriage_bolt: need {name} > 0, got {val}")
    if head not in _HEADS:
        raise ValueError(f"carriage_bolt: head must be one of {_HEADS}, got {head!r}")
    if dk <= square_w:
        raise ValueError(
            f"carriage_bolt: head dk {dk} must exceed the square neck across-flats {square_w} "
            f"(the head must overhang the neck)")

    shank = _screw_shank(d, length, tip_chamfer)      # z in [-length, 0]; validates d/length/chamfer
    circumradius = square_w / math.sqrt(2.0)          # square across-corners / 2 (half-diagonal)
    neck_top = square_depth
    head_apex = square_depth + k

    with BuildPart() as bp:
        add(shank)
        with BuildSketch(Plane.XY):                   # square neck, vertex-up (corner on +X)
            RegularPolygon(radius=circumradius, side_count=4, rotation=0)
        extrude(amount=square_depth)                  # z in [0, square_depth], fuses to shank at z=0
        if head == "cup":
            # spherical cap: base circle radius dk/2 at z=neck_top, apex at z=head_apex (cap_nut idiom)
            r_base = dk / 2.0
            sphere_r = (r_base ** 2 + k ** 2) / (2.0 * k)
            z_c = neck_top + k - sphere_r             # sphere centre on Z (apex at head_apex)
            big = 4.0 * (sphere_r + head_apex)        # trim box, comfortably larger than the cap
            with BuildPart() as cap_bp:
                with Locations((0.0, 0.0, z_c)):
                    Sphere(radius=sphere_r)
                with Locations((0.0, 0.0, neck_top - big / 2.0)):
                    Box(big, big, big, mode=Mode.SUBTRACT)   # keep only z >= neck_top
            add(cap_bp.part)                          # union the dome onto the neck
        else:                                         # countersunk cone frustum: wide top, narrow neck
            r_bottom = square_w / 2.0                 # cone base ~ square inscribed circle (flagged)
            # (x=radius, z=axial): neck-top base -> out to bottom radius -> up-out to top rim -> axis
            profile = [(0.0, neck_top), (r_bottom, neck_top),
                       (dk / 2.0, head_apex), (0.0, head_apex)]
            with BuildSketch(Plane.XZ):
                Polygon(*profile, align=None)
            revolve(axis=Axis.Z, revolution_arc=360)  # union the cone onto the neck
    part = bp.part
    if part.volume <= 0:                              # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("carriage_bolt: produced an empty solid")
    if len(part.solids()) != 1:                       # head + neck + shank must fuse to one solid
        raise ValueError("carriage_bolt: produced more than one solid")
    return part
