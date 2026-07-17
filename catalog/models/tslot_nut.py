"""T-slot nut family generator (DIN 508, Nutenstein / T-slot nut).

A stepped-T prismatic block: a wide foot that engages a machine-table T-slot undercut, a
narrower neck rising from it (optionally chamfered on the top corners), and a threaded bore
running vertically through it. The T cross-section is drawn in the XZ plane and extruded along
Y (the sliding/length axis) so the iconic T lands in the profile view under NUT_PRESET; the
bore is subtracted along Z last (like ``hex_nut``). Only the metal envelope is drawn (no thread).
"""
from build123d import BuildPart, BuildSketch, Polygon, Cylinder, Plane, Mode, extrude

from catalog.models.hex_nut import _MIN_WALL_MM   # shared minimum wall thickness


def tslot_nut(length: float, foot_w: float, neck_w: float, foot_h: float,
              height: float, bore: float, chamfer: float | None = None):
    """T-slot nut: a block of ``length`` (along Y) whose cross-section is a wide foot
    (``foot_w`` x ``foot_h``) under a narrower neck (``neck_w`` x ``height - foot_h``), with a
    through ``bore`` along Z and an optional 45-degree ``chamfer`` on the top outer neck corners.

    The T cross-section is a ``Polygon`` in the XZ plane (x = width centred on 0, z = height
    from 0), extruded ``length`` along Y (centred), then the bore is subtracted last.
    """
    for name, val in (("length", length), ("foot_w", foot_w), ("neck_w", neck_w),
                      ("foot_h", foot_h), ("height", height), ("bore", bore)):
        if val <= 0:
            raise ValueError(f"tslot_nut: need {name} > 0, got {val}")
    if neck_w >= foot_w:
        raise ValueError(
            f"tslot_nut: neck_w {neck_w} must be < foot_w {foot_w} (the foot is the wider T-crossbar)")
    if foot_h >= height:
        raise ValueError(
            f"tslot_nut: foot_h {foot_h} must be < height {height} (a neck of positive height must remain)")
    if bore >= neck_w - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"tslot_nut: bore {bore} leaves too thin a wall vs neck_w {neck_w} "
            f"(needs < neck_w - {2.0 * _MIN_WALL_MM} mm; the neck is the binding width)")
    if bore >= length - 2.0 * _MIN_WALL_MM:
        raise ValueError(
            f"tslot_nut: bore {bore} leaves too thin a wall vs length {length} "
            f"(needs < length - {2.0 * _MIN_WALL_MM} mm; the bore must fit within the block length)")
    if chamfer is not None:
        if chamfer <= 0:
            raise ValueError(f"tslot_nut: need chamfer > 0 when given, got {chamfer}")
        if chamfer >= neck_w / 2.0:
            raise ValueError(
                f"tslot_nut: chamfer {chamfer} must be < neck_w/2 = {neck_w / 2.0} (stays within the neck width)")
        if chamfer >= height - foot_h:
            raise ValueError(
                f"tslot_nut: chamfer {chamfer} must be < neck height {height - foot_h} (stays within the neck)")
        top_half = neck_w / 2.0 - chamfer
        if bore / 2.0 >= top_half - _MIN_WALL_MM:
            raise ValueError(
                f"tslot_nut: bore {bore} leaves too thin a wall at the chamfered top "
                f"(neck top half-width {top_half:.3f}, needs bore/2 < it by {_MIN_WALL_MM} mm)")

    fw, nw = foot_w / 2.0, neck_w / 2.0
    if chamfer is not None:
        c = chamfer
        # T cross-section, counter-clockwise, with the top outer corners bevelled by 45 deg.
        pts = [
            (-fw, 0.0), (fw, 0.0),               # foot bottom edge
            (fw, foot_h), (nw, foot_h),          # foot top-right + step in to the neck
            (nw, height - c), (nw - c, height),  # neck right rise + top-right chamfer
            (-(nw - c), height), (-nw, height - c),  # top-left chamfer + neck left
            (-nw, foot_h), (-fw, foot_h),        # step out + foot top-left
        ]
    else:
        pts = [
            (-fw, 0.0), (fw, 0.0),
            (fw, foot_h), (nw, foot_h),
            (nw, height), (-nw, height),
            (-nw, foot_h), (-fw, foot_h),
        ]

    with BuildPart() as bp:
        with BuildSketch(Plane.XZ):
            Polygon(*pts, align=None)            # explicit coords -> no auto-centring
        extrude(amount=length / 2.0, both=True)  # extrude along Y, centred on y=0
        Cylinder(radius=bore / 2.0, height=height * 3.0, mode=Mode.SUBTRACT)   # through bore along Z, last
    part = bp.part
    if part.volume <= 0:                          # net guard (not is_valid — sewn-shell gotcha)
        raise ValueError("tslot_nut: produced an empty solid")
    return part
