"""Turnbuckle nut family generator (DIN 1479, Sechskant-Spannschlossmutter): the hexagon
turnbuckle nut — an elongated hexagonal sleeve, threaded right-hand/left-hand from the two
ends, used as a rigging tensioner between two threaded rods.

The body reuses ``hex_nut._chamfered_hex_solid`` — the vertex-up hex prism with 30-degree
corner chamfers at both end faces — stretched to the sleeve ``length`` (z in [0, length]).
An axial through ``bore`` is subtracted (envelope-only: a smooth bore, no drawn thread and
no left/right-hand distinction, per the epic's fine-feature rule). The defining extra
feature is the sight hole: DIN 1479 sleeves carry small cross-holes so the rigger can check
thread engagement; it is drawn simplified as ONE through-hole of diameter ``sight_hole_d``
along Y at mid-length — through two opposite flats, which face +/-Y in the vertex-up
orientation.
"""
import math

from build123d import BuildPart, Cylinder, Locations, Mode, add

from catalog.models.hex_nut import _chamfered_hex_solid, _MIN_WALL_MM


def turnbuckle_nut(s: float, length: float, bore: float, sight_hole_d: float,
                   chamfer: float | None = None):
    """DIN 1479 turnbuckle nut: chamfered hex sleeve of across-flats ``s`` and overall
    ``length`` (z in [0, length]), axial through ``bore``, and a ``sight_hole_d`` through-hole
    along Y at mid-length. ``chamfer`` is the end chamfer-circle diameter (defaults to ``s``,
    as in hex_nut). Envelope only: no thread in the bore, no thread-hand marking.
    """
    for name, val in (("s", s), ("length", length), ("bore", bore),
                      ("sight_hole_d", sight_hole_d)):
        if val <= 0:
            raise ValueError(f"turnbuckle_nut: need {name} > 0, got {val}")
    if length <= s:
        raise ValueError(
            f"turnbuckle_nut: length {length} must exceed across-flats {s} "
            f"(the turnbuckle body is an elongated sleeve, not a plain nut)")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"turnbuckle_nut: bore {bore} leaves too thin a wall (needs to be under "
            f"across-flats {s} by at least {_MIN_WALL_MM} mm)")
    flat_w = s / math.sqrt(3.0)                  # hex side length == width of one flat face
    if sight_hole_d >= flat_w:
        raise ValueError(
            f"turnbuckle_nut: sight_hole_d {sight_hole_d} must be smaller than the flat "
            f"face width {flat_w:.3f} (s/sqrt(3)) so the hole stays within one flat")

    hex_body = _chamfered_hex_solid(s, length, chamfer)   # validates s/length/chamfer geometry
    with BuildPart() as bp:
        add(hex_body)                                     # vertex-up hex, z in [0, length]
        with Locations((0.0, 0.0, length / 2.0)):
            # sight hole: axis rotated onto Y (rotation about X), centred at mid-length;
            # height 3*s pierces both +/-Y flats (at +/- s/2) with margin.
            Cylinder(radius=sight_hole_d / 2.0, height=s * 3.0,
                     rotation=(90.0, 0.0, 0.0), mode=Mode.SUBTRACT)
        # axial through bore, subtracted last (like hex_nut); centred Cylinder of height
        # 3*length spans well past both end faces.
        Cylinder(radius=bore / 2.0, height=length * 3.0, mode=Mode.SUBTRACT)
    part = bp.part
    if part.volume <= 0:                         # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("turnbuckle_nut: produced an empty solid")
    if len(part.solids()) != 1:                  # the two cross-drillings must not split the sleeve
        raise ValueError("turnbuckle_nut: did not produce a single solid")
    return part
