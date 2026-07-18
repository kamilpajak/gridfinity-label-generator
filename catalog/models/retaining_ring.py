"""Retaining-ring family generator (DIN 471 external / DIN 472 internal circlips).

A flat stamped split ring: a C with an angular gap whose radial section tapers between the
narrower back (opposite the gap) and the wider free ends, each free end carrying a round eared
lug (a boss around the plier hole). The ring lies in the XY plane and is a thin extrusion along
Z, so under the default camera the face view shows the tapered C + lugs + holes and the edge
view is a thin flat rectangle. External (DIN 471) grows the section outward from the seated
inner edge; internal (DIN 472) grows it inward from the seated outer edge — a pure radial
mirror selected by ``internal``. Only the metal envelope is drawn (no groove, no thread).

The two lug ears must stay clear of each other so the ring reads as an OPEN split (a circlip
must be open to spring on). The ear is therefore sized to the plier hole (``lug_project`` is the
ring of material around the hole), NOT to the full radial section width — a section-wide ear
would meet its twin across a small gap and fuse the ring shut. ``_split_open`` guards that.
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
    carries a round eared lug of diameter ``lug_hole_d + 2*lug_project`` (a boss of wall
    ``lug_project`` around a through plier hole of diameter ``lug_hole_d``). ``internal=False``
    grows the section (and lugs) outward from ``d_seat`` (DIN 471); ``True`` grows it inward
    toward the axis (DIN 472).

    The ring is a closed ``Polygon`` in XY — the growing edge sampled around the material arc
    then the seated edge sampled back — extruded ``thickness`` along Z (centred), with the lug
    ears fused and the plier holes subtracted last. The ear boss seats with its inner edge on
    ``d_seat`` (the largest radius available), so the two ears clear each other — leaving the
    ring open — at the smallest gap.
    """
    for name, val in (("d_seat", d_seat), ("thickness", thickness), ("w_lug", w_lug),
                      ("w_back", w_back), ("lug_hole_d", lug_hole_d), ("lug_project", lug_project)):
        if val <= 0:
            raise ValueError(f"retaining_ring: need {name} > 0, got {val}")
    if not (0 < gap_deg < 180):
        raise ValueError(f"retaining_ring: need 0 < gap_deg < 180, got {gap_deg}")
    if w_back > w_lug:
        raise ValueError(
            f"retaining_ring: w_back {w_back} must not exceed w_lug {w_lug} — this family "
            f"tapers wider toward the eared lugs, not the back (equal is allowed)")
    if lug_project < _MIN_WALL_MM:
        raise ValueError(
            f"retaining_ring: lug_project {lug_project} is the ear wall around the plier hole "
            f"and must be >= _MIN_WALL_MM ({_MIN_WALL_MM})")
    r_seat = d_seat / 2.0
    r_ear = lug_hole_d / 2.0 + lug_project          # ear boss = hole radius + surrounding wall
    sign = -1.0 if internal else 1.0
    if internal:
        # Growing inward, the innermost reach — the widest body point or the ear boss — must
        # leave a solid wall inside without crossing the axis.
        reach = max(w_back, w_lug, 2.0 * r_ear)
        if reach >= r_seat - _MIN_WALL_MM:
            raise ValueError(
                f"retaining_ring: internal ring grows inward by {reach} mm but only "
                f"{r_seat - _MIN_WALL_MM} mm of radius is available (d_seat {d_seat})")

    half_gap = math.radians(gap_deg) / 2.0
    a0, a1 = half_gap, 2.0 * math.pi - half_gap    # material arc endpoints; gap centred on +X
    back = math.pi                                  # theta of the back (the min/max-width point)
    span = math.pi - half_gap                       # angular distance from the back to a free end

    ear_r = r_seat + sign * r_ear                   # ear-boss centre radius (inner edge on the seat)
    # The two ears sit at the free ends (+/-half_gap). Their centres are 2*ear_r*sin(half_gap)
    # apart; if that is not more than an ear diameter they touch and bridge the gap, fusing the
    # ring shut. Require an open split of at least _MIN_WALL_MM between the ear rims.
    _split_open = 2.0 * ear_r * math.sin(half_gap) - 2.0 * r_ear
    if _split_open < _MIN_WALL_MM:
        raise ValueError(
            f"retaining_ring: the two lug ears close the gap (split {_split_open:.3f} mm < "
            f"{_MIN_WALL_MM} mm) — a circlip must stay open; widen gap_deg or shrink the ear "
            f"(smaller lug_hole_d / lug_project)")

    def width(theta):
        return w_back + (w_lug - w_back) * abs(theta - back) / span

    growing, seated = [], []
    for i in range(_ARC_SAMPLES):
        theta = a0 + (a1 - a0) * i / (_ARC_SAMPLES - 1)
        r_grow = r_seat + sign * width(theta)
        growing.append((r_grow * math.cos(theta), r_grow * math.sin(theta)))
        seated.append((r_seat * math.cos(theta), r_seat * math.sin(theta)))

    lug_centres = [(ear_r * math.cos(a), ear_r * math.sin(a)) for a in (a0, a1)]

    with BuildPart() as bp:
        with BuildSketch():
            # Closed C: out along the growing edge (a0 -> a1), back along the seated edge
            # (a1 -> a0); the two straight jumps are the free-end caps. The seated edge is
            # REVERSED so the loop is a single simple (non-self-intersecting) polygon in both
            # cases — including the internal ring, where the growing edge sits INSIDE the seated
            # circle (a non-reversed order would cross itself). Explicit coords, no auto-centring.
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
