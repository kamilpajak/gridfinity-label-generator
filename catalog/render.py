"""Project a 3D Part to a two-view (front + side) monochrome SVG technical drawing."""
import math
from dataclasses import dataclass

from build123d import ExportSVG, Unit, LineType, Location, Polyline

# --- Line style, in printed dots ---
#
# The app scales every drawing into the same small image slot on the label, but
# the drawings span 21mm to 129mm in their own coordinates, so a width fixed in
# drawing units reaches the paper at wildly different widths: the 0.5mm this
# catalog used landed anywhere between 0.5 and 3.1 dots at 360dpi. The widths
# below are therefore a target on the PAPER, converted back into drawing units
# per drawing through its own extent, so every drawing prints the same.
#
# The values keep the 5:4:3 ratio of the 0.5/0.4/0.3mm they replace and sit on
# what that scheme printed at the median drawing, so the average weight is
# unchanged — only the spread is gone. Tune them from printed results.
#
# All layers are pure black: the label printer is monochrome, so a gray would only
# dither. Hidden and center lines stay apart by dash pattern and weight.
PRINT_DPI = 360
_DOT_MM = 25.4 / PRINT_DPI
# The image slot the app scales a drawing into, measured off the rendered label
# canvas (12mm tape): ~8.9 x 9.4mm, so a drawing's longest side lands on ~9.15mm.
LABEL_SLOT_MM = 9.15

VISIBLE_DOTS = 1.5
HIDDEN_DOTS = 1.2
CENTER_DOTS = 0.9

HIDDEN_COLOR = (0, 0, 0)
CENTERLINE_COLOR = (0, 0, 0)
_CENTER_EXT_FRAC = 0.08  # overhang past the outline, as a fraction of view size
_CENTER_MIN_EXT_MM = 1.5  # floor so small drawings still get a visible overhang

# Chain-line pattern for the symmetry axes, in printed dots like the weights, so
# the axes read the same on every drawing. These are what the previous absolute
# 6.35/1.27/1.27mm pattern printed at the median drawing.
#
# Not tied to the line width, the way the exporter and ISO 128 express dash
# lengths: that is right for a full-size sheet where the width is chosen once per
# drawing group, but here the width is a printer setting being tuned, and a
# thicker pen would stretch the dashes until a small drawing's whole arm was
# shorter than one long dash (measured: raising the pen from 0.2 to 0.3mm
# collapsed 69 of 125 axes into a solid line, which reads as an edge, not an axis).
# The dashes are emitted as geometry (see _chain_dashes), not a stroke-dasharray.
_CENTER_LONG_DOTS = 18.5
_CENTER_SHORT_DOTS = 3.7
_CENTER_DASH_GAP_DOTS = 3.7

# No margin: the view box hugs the drawing, so the whole image slot on the label
# is drawing. Whitespace around it belongs to whoever places the image — the label
# layout already spaces the image from the text — and a margin baked in here would
# also shrink the drawing, since the app scales the whole box into a fixed slot.
# The exporter still pads by half a line width (fit_to_stroke) so the outermost
# stroke is not clipped in half.
_MARGIN_MM = 0.0

_SEGMENTS = 72  # per-edge discretization before simplification

# Every edge is sampled at _SEGMENTS points and then simplified back down, because
# the sampler cannot tell a straight edge from a curved one: without this a hex
# outline stored each of its straight sides as 73 points, and din472.svg reached
# 1.15MB against 4KB for the raster it replaces. The tolerance is a fraction of
# the drawing's own extent, so it means the same thing on a 21mm washer and a
# 130mm bolt: about 1/12 of a printer dot once the drawing is fitted to the label,
# and still invisible at the magnification the contact sheet uses.
_CHORD_TOLERANCE_FRAC = 1 / 2000


def dots_to_drawing_mm(dots: float, box_extent_mm: float) -> float:
    """Width in drawing units that prints as `dots` once fitted to the label slot."""
    return dots * _DOT_MM * box_extent_mm / LABEL_SLOT_MM


def _weights_for_extent(geometry_extent_mm: float) -> tuple[float, float, float]:
    """Visible, hidden and centerline weights for a drawing of the given extent.

    The exported view box is the geometry plus (because ExportSVG fits the box to
    the strokes) one visible line width, and it is that whole box the app scales
    into the slot. Solving for the width that is a fixed share `k` of the final
    box keeps the printed result on target instead of a few percent thin.
    """
    k = VISIBLE_DOTS * _DOT_MM / LABEL_SLOT_MM
    visible = round(k * geometry_extent_mm / (1 - k), 4)
    hidden = round(visible * HIDDEN_DOTS / VISIBLE_DOTS, 4)
    center = round(visible * CENTER_DOTS / VISIBLE_DOTS, 4)
    return visible, hidden, center


def _simplify(points, tolerance):
    """Drop sampled points that lie within `tolerance` of the chord they sit on.

    Ramer-Douglas-Peucker. A straight edge collapses to its two endpoints; an arc
    keeps only as many points as the tolerance needs.
    """
    if len(points) < 3 or tolerance <= 0:
        return points

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        if last <= first + 1:
            continue
        ax, ay = points[first][0], points[first][1]
        dx = points[last][0] - ax
        dy = points[last][1] - ay
        chord = math.hypot(dx, dy)
        worst, worst_at = -1.0, -1
        for i in range(first + 1, last):
            px, py = points[i][0], points[i][1]
            if chord == 0:  # closed edge: the chord degenerates to a point
                deviation = math.hypot(px - ax, py - ay)
            else:
                deviation = abs((px - ax) * dy - (py - ay) * dx) / chord
            if deviation > worst:
                worst, worst_at = deviation, i
        if worst > tolerance:
            keep[worst_at] = True
            stack.append((first, worst_at))
            stack.append((worst_at, last))
    return [p for p, k in zip(points, keep) if k]


def _to_polylines(edges, tolerance=0.0, n=_SEGMENTS):
    """Discretize edges into polylines to avoid ExportSVG's closed-ellipse assert."""
    out = []
    for e in edges:
        pts = []
        for i in range(n + 1):
            p = e @ (i / n)
            v = (round(p.X, 4), round(p.Y, 4), round(p.Z, 4))
            if not pts or v != pts[-1]:
                pts.append(v)
        pts = _simplify(pts, tolerance)
        if len(pts) >= 2:
            out.append(Polyline(*pts))
    return out


@dataclass(frozen=True)
class CameraPreset:
    front_origin: tuple
    front_up: tuple
    side_origin: tuple
    side_up: tuple


# For a part whose main axis is Z:
#   front = look down the axis (face view: hex/ring outline + bore),
#   side  = look along -Y (profile view: thickness + hidden bore).
# Both views use X as the vertical axis, so the front and side views share the
# same height — the orthographic-projection alignment rule. It is invisible on
# axisymmetric parts (X == Y == diameter) but matters for rectangular ones: a
# taper washer's length axis (X) then reads at true height in BOTH views, and
# its wedge profile stays visible in the side view (which looks along Y).
DEFAULT_AXIS_Z = CameraPreset(
    front_origin=(0, 0, 1000),
    front_up=(1, 0, 0),   # X up: shared with the side view (height alignment)
    side_origin=(0, -1000, 0),
    side_up=(1, 0, 0),   # standing: length/diameter vertical, thickness horizontal
)

# Nuts share the washer camera geometry: look down the axis for the hex face view,
# look along -Y for the profile, X vertical in both so the two views are height-aligned
# (the orthographic-projection rule). The hex is oriented vertex-up by the generator, so
# no preset change is needed beyond reusing these axes — NUT_PRESET is intentionally the
# same object as DEFAULT_AXIS_Z today. It exists as the seam to diverge later: when a
# non-axisymmetric nut family arrives (e.g. a square nut) this can point at its own preset.
NUT_PRESET = DEFAULT_AXIS_Z


def preset_for_hardware_type(hardware_type: str) -> CameraPreset:
    """Camera preset selected by hardware type. Nuts use NUT_PRESET; everything else the default."""
    return NUT_PRESET if hardware_type == "nut" else DEFAULT_AXIS_Z


def _centerline_coords(bbox, ext, cross):
    """Endpoint pairs for the symmetry axes of a view.

    bbox is (xmin, ymin, xmax, ymax). Each axis is emitted as two half-lines
    running from the view's own center outward (overhanging the outline by
    ``ext``), with the center as the first point of every pair. Because the
    dash pattern begins at that first point, a long dash always starts at the
    crossing and the two arms mirror each other — the ISO 128 rule that
    centerlines meet on dashes, not gaps. The horizontal (rotation) axis is
    always drawn; ``cross`` adds the vertical axis a circular face view needs.
    """
    xmin, ymin, xmax, ymax = bbox
    cx, cy = (xmin + xmax) / 2.0, (ymin + ymax) / 2.0
    coords = [((cx, cy), (xmin - ext, cy)), ((cx, cy), (xmax + ext, cy))]
    if cross:
        coords += [((cx, cy), (cx, ymin - ext)), ((cx, cy), (cx, ymax + ext))]
    return coords


def _chain_dashes(start, end, box_extent_mm):
    """Dash segments of one centerline arm, beginning and ending on a long dash.

    ISO 128 wants a chain line to start and finish with a long dash, never in a
    gap. A stroke-dasharray cannot promise that: the pattern runs until the line
    ends, wherever that falls, which left some arms stopping in a gap — visible as
    an axis that fades out short of its tip, and as an empty band at the edge of
    the image (the view box follows the geometry, which does reach the tip).

    So the dashes are emitted as geometry. The arm keeps the exact length it was
    given — the overhang past the outline stays consistent across the drawing —
    and the pattern is stretched by up to half a period to land on it, which is
    what a drafter does with the linetype scale and is imperceptible over these
    lengths. An arm too short for one long dash becomes a single solid stroke.
    """
    (x0, y0), (x1, y1) = start, end
    length = math.hypot(x1 - x0, y1 - y0)
    if length <= 0:
        return []

    long_dash = dots_to_drawing_mm(_CENTER_LONG_DOTS, box_extent_mm)
    short_dash = dots_to_drawing_mm(_CENTER_SHORT_DOTS, box_extent_mm)
    gap = dots_to_drawing_mm(_CENTER_DASH_GAP_DOTS, box_extent_mm)
    period = long_dash + gap + short_dash + gap

    repeats = max(0, round((length - long_dash) / period))
    fit = length / (repeats * period + long_dash)
    long_dash, short_dash, gap = long_dash * fit, short_dash * fit, gap * fit

    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    point_at = lambda t: (x0 + ux * t, y0 + uy * t)  # noqa: E731 - local shorthand

    segments = []
    at = 0.0
    for _ in range(repeats):
        segments.append((point_at(at), point_at(at + long_dash)))
        at += long_dash + gap
        segments.append((point_at(at), point_at(at + short_dash)))
        at += short_dash + gap
    segments.append((point_at(at), point_at(length)))
    return segments


def _edges_bbox(edges):
    """Combined (xmin, ymin, xmax, ymax) of projected 2D edges."""
    xs_min = ys_min = float("inf")
    xs_max = ys_max = float("-inf")
    for e in edges:
        bb = e.bounding_box()
        xs_min, ys_min = min(xs_min, bb.min.X), min(ys_min, bb.min.Y)
        xs_max, ys_max = max(xs_max, bb.max.X), max(ys_max, bb.max.Y)
    if xs_min == float("inf"):
        raise ValueError("no edges to bound (empty projection)")
    return xs_min, ys_min, xs_max, ys_max


def render_two_views(part, preset: CameraPreset, out_path: str, gap_mm: float = 4.0) -> None:
    v_front, h_front = part.project_to_viewport(
        viewport_origin=preset.front_origin, viewport_up=preset.front_up
    )
    v_side, h_side = part.project_to_viewport(
        viewport_origin=preset.side_origin, viewport_up=preset.side_up
    )

    front_bbox = _edges_bbox(v_front + h_front)
    side_bbox0 = _edges_bbox(v_side + h_side)
    # Place the side view to the right of the front view with a fixed gap.
    dx = (front_bbox[2] + gap_mm) - side_bbox0[0]
    move = Location((dx, 0, 0))
    v_side = [move * e for e in v_side]
    h_side = [move * e for e in h_side]
    side_bbox = _edges_bbox(v_side + h_side)

    # Centerlines: a full cross on the circular face view, a single axis on the
    # profile view. A single overhang, scaled to the largest span across both
    # views, keeps the extension length consistent between them.
    #
    # Placement uses each view's bounding-box center as the symmetry center. That
    # is exact for the axisymmetric parts this catalog draws (washers); a future
    # non-symmetric family would need its axis passed in explicitly rather than
    # inferred from the bbox.
    fw, fh = front_bbox[2] - front_bbox[0], front_bbox[3] - front_bbox[1]
    sw, sh = side_bbox[2] - side_bbox[0], side_bbox[3] - side_bbox[1]
    ext = round(max(_CENTER_MIN_EXT_MM, _CENTER_EXT_FRAC * max(fw, fh, sw, sh)), 2)
    center_coords = _centerline_coords(front_bbox, ext, cross=True)
    center_coords += _centerline_coords(side_bbox, ext, cross=False)

    # Everything the drawing occupies: both views plus the centerline overhang.
    geometry_extent = max(
        (side_bbox[2] + ext) - (front_bbox[0] - ext),
        max(front_bbox[3] + ext, side_bbox[3]) - min(front_bbox[1] - ext, side_bbox[1]),
    )
    visible_weight, hidden_weight, center_weight = _weights_for_extent(geometry_extent)
    box_extent = geometry_extent + visible_weight

    centerlines = [
        Polyline((a[0], a[1], 0), (b[0], b[1], 0))
        for start, end in center_coords
        for a, b in _chain_dashes(start, end, box_extent)
    ]

    # 3 decimals is a micron of drawing, two orders finer than the simplification
    # tolerance below, and it costs a quarter of the file size of 4.
    exporter = ExportSVG(unit=Unit.MM, precision=3, margin=_MARGIN_MM)
    exporter.add_layer("Visible", line_weight=visible_weight, line_type=LineType.CONTINUOUS)
    exporter.add_layer(
        "Hidden", line_color=HIDDEN_COLOR, line_weight=hidden_weight,
        line_type=LineType.ISO_DASH,  # dash scales with the weight, so it is uniform too
    )
    exporter.add_layer(
        "Center", line_color=CENTERLINE_COLOR, line_weight=center_weight,
        line_type=LineType.CONTINUOUS,  # the chain pattern is geometry, not a dasharray
    )
    chord_tolerance = geometry_extent * _CHORD_TOLERANCE_FRAC
    exporter.add_shape(_to_polylines(v_front + v_side, chord_tolerance), layer="Visible")
    exporter.add_shape(_to_polylines(h_front + h_side, chord_tolerance), layer="Hidden")
    exporter.add_shape(centerlines, layer="Center")
    exporter.write(out_path)
