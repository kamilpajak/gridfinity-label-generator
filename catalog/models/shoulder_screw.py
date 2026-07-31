"""Shoulder screw family generator (ISO 7379 hexagon socket head shoulder screw, a.k.a.
stripper bolt).

Three coaxial diameters stacked along Z: a cylindrical socket head of diameter ``dk`` and
height ``k`` (z in [0, k], the socket_screw cylindrical-head form) carrying a blind hex
drive socket cut into its top face; below the z=0 under-head bearing plane the defining
feature — a wide ground shoulder cylinder of diameter ``d_shoulder`` and length
``shoulder_len`` (z in [-shoulder_len, 0]); and below the shoulder a REDUCED smooth thread
envelope of major diameter ``d_thread`` and length ``thread_len`` (the shared
``screw_common._screw_shank``, translated so its top face sits on the shoulder end).

ISO 7379 designates the screw by its SHOULDER diameter, so d_shoulder > d_thread always
(e.g. shoulder 12 carries an M10 thread). Everything is a meridian revolve except the hex
socket (a subtracted hexagonal prism, the socket_screw idiom). Envelope-only per the
epic's fine-feature rule: no drawn thread, no head knurl, and the small thread undercut /
shoulder chamfers are omitted. Head, shoulder and thread envelope fuse by face contact at
their two seams, guarded by net volume>0 + single-solid.
"""
from build123d import (
    BuildPart, BuildSketch, Polygon, RegularPolygon, Plane, Axis, Mode,
    Pos, add, extrude, revolve,
)

from catalog.models.screw_common import _screw_shank

_MIN_WALL_MM = 0.1               # local min wall (not imported — keep the screw_common-only dep)
_RECESS_EPS = 0.05               # cutter pokes this far above the top face for a clean rim cut
_SQRT3 = 3.0 ** 0.5


def shoulder_screw(dk: float, k: float, d_shoulder: float, shoulder_len: float,
                   d_thread: float, thread_len: float, socket_af: float,
                   socket_depth: float, tip_chamfer: float | None = None):
    """ISO 7379 shoulder screw: cylindrical head of diameter ``dk`` and height ``k`` with a
    blind hex socket (across-flats ``socket_af``, depth ``socket_depth``) in its top face
    (z in [0, k]); a ground shoulder cylinder ``d_shoulder`` x ``shoulder_len``
    (z in [-shoulder_len, 0]); and a reduced smooth thread envelope ``d_thread`` x
    ``thread_len`` below it (optional 45-degree lead ``tip_chamfer`` at the free end).
    No drawn thread, no bore.
    """
    for name, val in (("dk", dk), ("k", k), ("d_shoulder", d_shoulder),
                      ("shoulder_len", shoulder_len), ("d_thread", d_thread),
                      ("thread_len", thread_len), ("socket_af", socket_af),
                      ("socket_depth", socket_depth)):
        if val <= 0:
            raise ValueError(f"shoulder_screw: need {name} > 0, got {val}")
    if d_thread >= d_shoulder:
        raise ValueError(
            f"shoulder_screw: d_thread {d_thread} must be < d_shoulder {d_shoulder} "
            f"(ISO 7379 designates by shoulder diameter; the thread is always the reduced end)")
    if d_shoulder >= dk:
        raise ValueError(
            f"shoulder_screw: d_shoulder {d_shoulder} must be < head diameter {dk} "
            f"(the head overhangs the shoulder to form the bearing face)")
    if socket_depth >= k:
        raise ValueError(
            f"shoulder_screw: socket_depth {socket_depth} must be < head height {k} "
            f"(the socket is blind — a floor of head metal must remain below it)")
    socket_outer_r = socket_af / _SQRT3          # hex circumradius for across-flats socket_af
    if socket_outer_r >= dk / 2.0 - _MIN_WALL_MM:
        raise ValueError(
            f"shoulder_screw: hex socket of across-size {socket_af} reaches radius "
            f"{socket_outer_r:.3f} which leaves too thin a wall vs head radius {dk / 2.0} "
            f"(needs < dk/2 - {_MIN_WALL_MM} mm)")

    floor_z = k - socket_depth                   # socket floor plane (z > 0 by the guard above)
    thread = _screw_shank(d_thread, thread_len, tip_chamfer)   # z in [-thread_len, 0], checks chamfer
    with BuildPart() as bp:
        # Head + shoulder as ONE meridian revolve, z in [-shoulder_len, k]: head cylinder above
        # the z=0 bearing plane (screw_common stacking convention), shoulder cylinder below.
        profile = [(0.0, k), (dk / 2.0, k), (dk / 2.0, 0.0),
                   (d_shoulder / 2.0, 0.0), (d_shoulder / 2.0, -shoulder_len),
                   (0.0, -shoulder_len)]
        with BuildSketch(Plane.XZ):
            Polygon(*profile, align=None)        # explicit coords -> no auto-centring
        revolve(axis=Axis.Z, revolution_arc=360)
        # Thread envelope: the shared shank dropped so its top face sits on the shoulder end
        # (z = -shoulder_len) — face contact -> fuses on add.
        add(Pos(0.0, 0.0, -shoulder_len) * thread)
        # Blind hex drive socket cut from the head top face (socket_screw hex idiom).
        with BuildSketch(Plane.XY.offset(floor_z)):
            RegularPolygon(radius=socket_af / 2.0, side_count=6,
                           major_radius=False)   # across-flats = socket_af
        extrude(amount=socket_depth + _RECESS_EPS, mode=Mode.SUBTRACT)
    part = bp.part
    if part.volume <= 0:                         # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("shoulder_screw: produced an empty solid")
    if len(part.solids()) != 1:                  # head/shoulder/thread must fuse to one solid
        raise ValueError("shoulder_screw: body did not fuse into a single solid")
    return part
