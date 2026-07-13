"""Cap / dome nut family generator: a chamfered hex body with a closed spherical-cap dome."""
from build123d import BuildPart, Sphere, Box, Locations, Mode, add

from catalog.models.hex_nut import _chamfered_hex_solid


def cap_nut(s: float, m: float, dome_height: float, chamfer: float | None = None):
    """Closed cap (dome / acorn) nut: across-flats ``s``, total height ``m``, dome of
    height ``dome_height`` rising from the top chamfer circle.

    A shared chamfered vertex-up hex body (``_chamfered_hex_solid``) of height
    ``m - dome_height`` with a solid spherical cap unioned on top. The cap base circle
    is the top chamfer circle (radius ``chamfer/2``, default ``s/2``), so the dome
    springs seamlessly from the chamfered hex top. No bore (closed cap). A tall dome
    (``dome_height > s/2``) is slightly super-hemispherical, as a real acorn crown is.
    """
    if dome_height <= 0:
        raise ValueError(f"cap_nut: need dome_height > 0, got {dome_height}")
    if dome_height >= m:
        raise ValueError(
            f"cap_nut: dome_height {dome_height} leaves no hex body under height {m}")
    r_flat = (s if chamfer is None else chamfer) / 2.0
    if r_flat > s / 2.0:
        raise ValueError(
            f"cap_nut: dome base radius {r_flat} exceeds the hex inradius {s / 2.0:.3f}; "
            f"the cap would overhang the flats (needs chamfer <= s)")
    # 3x the base radius is a sanity ceiling to reject obviously bad data, not a
    # geometric limit (a spherical cap fits any dome_height > 0).
    if dome_height > 3.0 * r_flat:
        raise ValueError(
            f"cap_nut: dome_height {dome_height} exceeds 3x the base radius {r_flat} "
            f"(likely bad data)")

    hex_h = m - dome_height
    hex_solid = _chamfered_hex_solid(s, hex_h, chamfer)   # validates s, hex_h, chamfer geometry

    base_z = hex_h                                # top plane of the hex body
    sphere_r = (r_flat ** 2 + dome_height ** 2) / (2.0 * dome_height)   # spherical-cap radius R
    z_c = base_z + dome_height - sphere_r          # sphere centre on the Z axis (apex at z=m)
    big = 4.0 * (sphere_r + m)                     # trim box, comfortably larger than the part

    # Build the spherical cap alone: a full sphere trimmed to the half-space z >= base_z,
    # leaving a cap of height exactly `dome_height` seated on the base circle of radius r_flat.
    # (Trim the cap in its own context so the box never touches the hex body below base_z.)
    with BuildPart() as cap_bp:
        with Locations((0.0, 0.0, z_c)):
            Sphere(radius=sphere_r)
        with Locations((0.0, 0.0, base_z - big / 2.0)):
            Box(big, big, big, mode=Mode.SUBTRACT)
    cap = cap_bp.part

    with BuildPart() as bp:
        add(hex_solid)
        add(cap)                                   # union the dome onto the hex body
    part = bp.part
    if part.volume <= 0:                           # net guard (matches hex_nut/flange_nut)
        raise ValueError("cap_nut: produced an empty solid")
    return part
