"""Project a 3D Part to a two-view (front + side) monochrome SVG technical drawing."""
import math
from dataclasses import dataclass

from build123d import ExportSVG, Unit, LineType, Location, Polyline

# --- Line style ---
#
# Widths are absolute in drawing units. They started from the 0.4/0.3/0.2 the
# catalog families were drawn and reviewed with and are being tuned from printed
# results, one step at a time — adjust them from what comes off the tape rather
# than from theory.
#
# Known property of this scheme: the app scales every drawing into the same small
# image slot, and the drawings span 20mm to 133mm in their own coordinates, so the
# same width reaches the paper at different widths — the 0.5mm below lands between
# 0.5 and 3.1 dots at 360dpi, median 1.5. Deriving the weights from a target
# printed width instead was tried (git history: "set line widths in printed dots")
# and gave a uniform 2 dots everywhere, but at the ~128 dots a drawing gets on the
# label it cost visible detail.
#
# All layers are pure black: the label printer is monochrome, so a gray would only
# dither. Hidden and center lines stay apart by dash pattern and weight.
VISIBLE_WEIGHT_MM = 0.5
HIDDEN_WEIGHT_MM = 0.4
CENTERLINE_WEIGHT_MM = 0.3

HIDDEN_COLOR = (0, 0, 0)
CENTERLINE_COLOR = (0, 0, 0)
_CENTER_EXT_FRAC = 0.08  # overhang past the outline, as a fraction of view size
_CENTER_MIN_EXT_MM = 1.5  # floor so small drawings still get a visible overhang

# Chain-line pattern for the symmetry axes, in millimetres of drawing. The
# exporter (and ISO 128) express dash lengths as multiples of the line width,
# which is right for a full-size sheet where the width is picked once per drawing
# group. Here the width is a printer setting being tuned, and tying the rhythm to
# it means every adjustment reshapes the axes: raising the pen from 0.2 to 0.3mm
# made the long dash 9.5mm, longer than a small drawing's whole arm, and 69 of 125
# axes collapsed into a solid line — which reads as an edge, not an axis. So the
# pattern is fixed at what those 0.2mm drawings had, and only the pen changes.
# The dashes are emitted as geometry (see _chain_dashes), not a stroke-dasharray.
_CENTER_LONG_MM = 6.35
_CENTER_SHORT_MM = 1.27
_CENTER_DASH_GAP_MM = 1.27

# No margin: the view box hugs the drawing, so the whole image slot on the label
# is drawing. Whitespace around it belongs to whoever places the image — the label
# layout already spaces the image from the text — and a margin baked in here would
# also shrink the drawing, since the app scales the whole box into a fixed slot.
# The exporter still pads by half a line width (fit_to_stroke) so the outermost
# stroke is not clipped in half.
_MARGIN_MM = 0.0

_SEGMENTS = 72  # per-edge discretization; smooth enough for label-size icons


def _to_polylines(edges, n=_SEGMENTS):
    """Discretize edges into polylines to avoid ExportSVG's closed-ellipse assert."""
    out = []
    for e in edges:
        pts = []
        for i in range(n + 1):
            p = e @ (i / n)
            v = (round(p.X, 4), round(p.Y, 4), round(p.Z, 4))
            if not pts or v != pts[-1]:
                pts.append(v)
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


def _chain_dashes(start, end):
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

    long_dash, short_dash, gap = _CENTER_LONG_MM, _CENTER_SHORT_MM, _CENTER_DASH_GAP_MM
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
    centerlines = [
        Polyline((a[0], a[1], 0), (b[0], b[1], 0))
        for start, end in center_coords
        for a, b in _chain_dashes(start, end)
    ]

    exporter = ExportSVG(unit=Unit.MM, precision=4, margin=_MARGIN_MM)
    exporter.add_layer("Visible", line_weight=VISIBLE_WEIGHT_MM, line_type=LineType.CONTINUOUS)
    exporter.add_layer(
        "Hidden", line_color=HIDDEN_COLOR, line_weight=HIDDEN_WEIGHT_MM,
        line_type=LineType.ISO_DASH,
    )
    exporter.add_layer(
        "Center", line_color=CENTERLINE_COLOR, line_weight=CENTERLINE_WEIGHT_MM,
        line_type=LineType.CONTINUOUS,  # the chain pattern is geometry, not a dasharray
    )
    exporter.add_shape(_to_polylines(v_front + v_side), layer="Visible")
    exporter.add_shape(_to_polylines(h_front + h_side), layer="Hidden")
    exporter.add_shape(centerlines, layer="Center")
    exporter.write(out_path)
