"""Prevailing-torque lock nut family generator (nylon-insert + all-metal).

A chamfered vertex-up hex body (the shared ``_chamfered_hex_solid``) with a top locking
feature and a through bore. Two top styles match the legacy silhouettes:
``"cylinder"`` is the straight metal skirt of a nylon-insert nut (din_985 / din_982);
``"cone"`` is the deformed truncated-metal crown of an all-metal nut (din_980 / din_6925).
Only the outer metal envelope is drawn — the polyamide ring and the crimp internals are not
modelled (envelope-only, like the din6926 nylon crown / din6927 all-metal flange nut).
"""
from build123d import (
    BuildPart, BuildSketch, Polygon, Cylinder, Locations,
    Plane, Axis, Align, Mode, revolve, add,
)

from catalog.models.hex_nut import _chamfered_hex_solid, _MIN_WALL_MM

_TOP_STYLES = ("cylinder", "cone")


def lock_nut(s: float, m: float, bore: float, top_style: str, top_h: float, top_d: float,
             top_d2: float | None = None, chamfer: float | None = None):
    """Prevailing-torque hex lock nut: across-flats ``s``, total height ``m`` (top feature
    included), drawn bore ``bore``.

    The hex body is ``_chamfered_hex_solid(s, m - top_h, chamfer)``. On its top face a
    locking feature of height ``top_h`` is unioned: ``top_style="cylinder"`` adds a straight
    ``Cylinder`` of diameter ``top_d`` (nyloc skirt); ``top_style="cone"`` revolves a
    truncated cone tapering from ``top_d`` (base) to ``top_d2`` (top) — the all-metal crown.
    A through bore is subtracted last (like ``hex_nut``). Vertex-up; no preset change.
    """
    for name, val in (("s", s), ("m", m), ("bore", bore), ("top_h", top_h), ("top_d", top_d)):
        if val <= 0:
            raise ValueError(f"lock_nut: need {name} > 0, got {val}")
    if top_style not in _TOP_STYLES:
        raise ValueError(f"lock_nut: top_style must be one of {_TOP_STYLES}, got {top_style!r}")
    if top_h >= m:
        raise ValueError(
            f"lock_nut: top_h {top_h} must be < total height m {m} (need a hex body below the top feature)")
    if bore >= s - _MIN_WALL_MM:
        raise ValueError(
            f"lock_nut: bore {bore} leaves too thin a wall vs across-flats {s} "
            f"(needs < s - {_MIN_WALL_MM} mm)")
    if bore >= top_d - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"lock_nut: bore {bore} leaves too thin a wall through the top feature top_d {top_d} "
            f"(needs < top_d - {2.0 * _MIN_WALL_MM} mm)")
    if top_d > s:
        raise ValueError(
            f"lock_nut: top_d {top_d} exceeds across-flats {s} (top feature must sit within the hex face)")
    if top_style == "cylinder" and top_d2 is not None:
        raise ValueError(
            f"lock_nut: cylinder top takes no top_d2 (got {top_d2}); top_d2 is only for a cone crown")
    if top_style == "cone":
        if top_d2 is None:                                # non-positive top_d2 is caught below
            raise ValueError(f"lock_nut: cone top needs top_d2 > 0, got {top_d2}")
        if not (0 < top_d2 < top_d):
            raise ValueError(
                f"lock_nut: cone top needs 0 < top_d2 < top_d, got top_d2={top_d2}, top_d={top_d}")
        if top_d2 <= bore + 2.0 * _MIN_WALL_MM:
            raise ValueError(
                f"lock_nut: cone top top_d2 {top_d2} leaves too thin a wall around bore {bore} "
                f"(needs > bore + {2.0 * _MIN_WALL_MM} mm)")

    hex_h = m - top_h
    hex_solid = _chamfered_hex_solid(s, hex_h, chamfer)   # validates s, hex_h, chamfer geometry
    with BuildPart() as bp:
        add(hex_solid)
        if top_style == "cylinder":
            with Locations((0.0, 0.0, hex_h)):            # collar base on the hex top face
                Cylinder(radius=top_d / 2.0, height=top_h,
                         align=(Align.CENTER, Align.CENTER, Align.MIN))
        else:                                             # cone: revolve a truncated trapezoid
            with BuildSketch(Plane.XZ):
                Polygon(
                    (0.0, hex_h), (top_d / 2.0, hex_h),
                    (top_d2 / 2.0, m), (0.0, m),
                    align=None,                           # absolute coords, base at z=hex_h
                )
            revolve(axis=Axis.Z)                          # unions the crown (default Mode.ADD)
        Cylinder(radius=bore / 2.0, height=m * 3, mode=Mode.SUBTRACT)   # through bore, last
    part = bp.part
    if part.volume <= 0:                                  # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("lock_nut: produced an empty solid")
    return part
