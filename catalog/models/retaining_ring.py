"""Retaining-ring family generator (DIN 471 external / DIN 472 internal circlips).

A flat stamped split ring: a C with an angular gap whose radial section tapers between the
narrower back (opposite the gap) and the wider free ends, each free end carrying an enlarged
round eared lug with a plier hole. The ring lies in the XY plane and is a thin extrusion along
Z, so under the default camera the face view shows the tapered C + lugs + holes and the edge
view is a thin flat rectangle. External (DIN 471) grows the section outward from the seated
inner edge; internal (DIN 472) grows it inward from the seated outer edge — a pure radial
mirror selected by ``internal``. Only the metal envelope is drawn (no groove, no thread).
"""
import math

from build123d import BuildPart, BuildSketch, Polygon, Cylinder, Locations, Mode, extrude

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness

_ARC_SAMPLES = 90   # points per edge; dense enough for a smooth ring at label render scale


def retaining_ring(d_seat: float, thickness: float, w_lug: float, w_back: float,
                   gap_deg: float, lug_hole_d: float, lug_project: float,
                   internal: bool = False):
    """Retaining ring (circlip). ``d_seat`` is the constant-radius seated edge (the
    groove-contact circle): the ring's INNER edge for an external ring, its OUTER edge for an
    internal one. The radial section width tapers from ``w_back`` at the back (180 deg from the
    gap) to ``w_lug`` at the two free ends; ``gap_deg`` is the angular opening. Each free end
    carries a round eared lug of diameter ``w_lug + lug_project`` with a through plier hole of
    diameter ``lug_hole_d``. ``internal=False`` grows the section (and lugs) outward from
    ``d_seat`` (DIN 471); ``True`` grows it inward toward the axis (DIN 472).

    The ring is a closed ``Polygon`` in XY — the growing edge sampled around the material arc
    then the seated edge sampled back — extruded ``thickness`` along Z (centred), with the lug
    ears fused and the plier holes subtracted last.
    """
    for name, val in (("d_seat", d_seat), ("thickness", thickness), ("w_lug", w_lug),
                      ("w_back", w_back), ("lug_hole_d", lug_hole_d), ("lug_project", lug_project)):
        if val <= 0:
            raise ValueError(f"retaining_ring: need {name} > 0, got {val}")
    if not (0 < gap_deg < 180):
        raise ValueError(f"retaining_ring: need 0 < gap_deg < 180, got {gap_deg}")
    r_seat = d_seat / 2.0
    if internal:
        # Growing inward, the innermost reach — the wider of the body's max width or the
        # projecting ear — must leave a solid wall inside without crossing the axis.
        reach = max(w_back, w_lug + lug_project)
        if reach >= r_seat - _MIN_WALL_MM:
            raise ValueError(
                f"retaining_ring: internal ring grows inward by {reach} mm but only "
                f"{r_seat - _MIN_WALL_MM} mm of radius is available (d_seat {d_seat})")
    if lug_hole_d >= w_lug + lug_project - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"retaining_ring: plier hole {lug_hole_d} leaves too thin an ear wall vs lug "
            f"diameter {w_lug + lug_project} (needs < lug - {2.0 * _MIN_WALL_MM} mm)")

    sign = -1.0 if internal else 1.0
    half_gap = math.radians(gap_deg) / 2.0
    a0, a1 = half_gap, 2.0 * math.pi - half_gap    # material arc endpoints; gap centred on +X
    back = math.pi                                  # theta of the back (the min/max-width point)
    span = math.pi - half_gap                       # angular distance from the back to a free end

    def width(theta):
        return w_back + (w_lug - w_back) * abs(theta - back) / span

    growing, seated = [], []
    for i in range(_ARC_SAMPLES):
        theta = a0 + (a1 - a0) * i / (_ARC_SAMPLES - 1)
        r_grow = r_seat + sign * width(theta)
        growing.append((r_grow * math.cos(theta), r_grow * math.sin(theta)))
        seated.append((r_seat * math.cos(theta), r_seat * math.sin(theta)))

    r_ear = (w_lug + lug_project) / 2.0
    ear_r = r_seat + sign * r_ear                   # ear-disc centre radius (disc sits on the seat)
    lug_centres = [(ear_r * math.cos(a), ear_r * math.sin(a)) for a in (a0, a1)]

    with BuildPart() as bp:
        with BuildSketch():
            # Closed C: out along the growing edge (a0 -> a1), back along the seated edge
            # (a1 -> a0); the two straight jumps are the free-end caps. Explicit coords, no
            # auto-centring, so the polygon stays put on the seated circle.
            Polygon(*(growing + seated[::-1]), align=None)
        extrude(amount=thickness / 2.0, both=True)  # thin body centred on z = 0
        for cx, cy in lug_centres:                  # fuse a round eared lug at each free end
            with Locations((cx, cy, 0.0)):
                Cylinder(radius=r_ear, height=thickness)
        for cx, cy in lug_centres:                  # subtract the plier holes last
            with Locations((cx, cy, 0.0)):
                Cylinder(radius=lug_hole_d / 2.0, height=thickness * 3.0, mode=Mode.SUBTRACT)
    part = bp.part
    if part.volume <= 0:                            # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("retaining_ring: produced an empty solid")
    return part
