"""Project a 3D Part to a two-view (front + side) monochrome SVG technical drawing."""
import re
from dataclasses import dataclass
from pathlib import Path

from build123d import ExportSVG, Unit, LineType, Location, Polyline

# --- Line style, expressed in PRINTED dots rather than drawing millimetres ---
#
# Drawing standards treat line width as an absolute width on the finished output
# chosen for the format (ISO 128-2; ASME Y14.2 thin/thick 0.3/0.6mm), not as a
# fraction of the object drawn — the same way CAD plots lineweights in paper
# space regardless of viewport scale. Our drawings are the opposite case: they
# span 20mm to 133mm in their own coordinates but every one of them is scaled to
# fit the same small image slot on a label, so a constant width in drawing
# millimetres reaches the paper at wildly different widths (measured: 0.8 to 4.1
# dots, with 59 of 125 drawings under the 2-dot floor where a thermal head starts
# dropping lines).
#
# So the weights below are derived per drawing: pick the printed width first,
# then convert it back into drawing units through the drawing's own extent.
# All layers print pure black — a gray would dither away on a 1-bit head; the
# hidden and center layers stay distinguishable by dash pattern and weight alone.
PRINT_DPI = 360
_DOT_MM = 25.4 / PRINT_DPI
# The image slot the app scales a drawing into, measured off the rendered label
# canvas (12mm tape): ~8.9 x 9.4mm, so a drawing's longest side lands on ~9.15mm.
LABEL_SLOT_MM = 9.15
# 2 dots is the practical minimum for a solid line on a maintained thermal head.
# 3 dots is the safer print recommendation, but at the ~128 dots a drawing gets on
# the label it swallows the detail: a socket head or a washer's chamfer merges into
# a blob. Outline and hidden edges therefore sit on the floor. Centerlines carry no
# geometry, only the symmetry reading, so they go below it — they are the densest
# layer at this size (a chain line crossing the whole drawing) and would otherwise
# compete with the outline.
VISIBLE_DOTS = 2.0
HIDDEN_DOTS = 2.0
CENTER_DOTS = 1.5

# Dash patterns, also in printed dots. The ISO 128-2 pattern (dash 12d, gap 3d)
# is built for a full-size sheet; at ~130 dots across it leaves one or two marks
# per edge, so these are the shortened patterns used for miniature reproduction.
HIDDEN_DASH_DOTS = (6.0, 3.0)
CENTER_DASH_DOTS = (11.0, 3.0, 3.0, 3.0)

HIDDEN_COLOR = (0, 0, 0)
CENTERLINE_COLOR = (0, 0, 0)
_CENTER_EXT_FRAC = 0.08  # overhang past the outline, as a fraction of view size
_CENTER_MIN_EXT_MM = 1.5  # floor so small drawings still get a visible overhang

_MARGIN_MM = 2.0

_SEGMENTS = 72  # per-edge discretization; smooth enough for label-size icons


def dots_to_drawing_mm(dots: float, extent_mm: float) -> float:
    """Width in drawing units that prints as `dots` once fitted to the label slot."""
    return dots * _DOT_MM * extent_mm / LABEL_SLOT_MM


def _weights_for_extent(geometry_extent_mm: float) -> tuple[float, float, float]:
    """Visible, hidden and centerline weights for a drawing of the given extent.

    The exported viewBox is the geometry plus the fixed margins plus (because
    ExportSVG fits the view box to the strokes) about one visible line width, and
    it is that whole box the app scales into the slot. Solving for the width that
    is a fixed share `k` of the final box keeps the printed result on target
    instead of a few percent thin.
    """
    box_without_stroke = geometry_extent_mm + 2 * _MARGIN_MM
    k = VISIBLE_DOTS * _DOT_MM / LABEL_SLOT_MM
    visible = round(k * box_without_stroke / (1 - k), 4)
    hidden = round(visible * HIDDEN_DOTS / VISIBLE_DOTS, 4)
    center = round(visible * CENTER_DOTS / VISIBLE_DOTS, 4)
    return visible, hidden, center


def _rewrite_dash_patterns(path: str, extent_mm: float) -> None:
    """Replace the exporter's sheet-scale dash patterns with the miniature ones.

    ExportSVG derives its dash array from the layer's line weight and a full-size
    ISO/AutoCAD pattern, which is far too long here, and it exposes no hook for a
    custom pattern — so the two dashed layers are rewritten in the written file.
    """
    text = Path(path).read_text()
    patterns = {
        "Hidden": HIDDEN_DASH_DOTS,
        "Center": CENTER_DASH_DOTS,
    }
    rewritten = set()

    def fix_group(match: re.Match) -> str:
        tag = match.group(0)
        for layer, dots in patterns.items():
            if f'id="{layer}"' not in tag:
                continue
            values = " ".join(
                f"{dots_to_drawing_mm(d, extent_mm):.4f}".rstrip("0").rstrip(".")
                for d in dots
            )
            tag, count = re.subn(
                r'stroke-dasharray="[^"]*"', f'stroke-dasharray="{values}"', tag
            )
            if count:
                rewritten.add(layer)
        return tag

    text = re.sub(r"<g\b[^>]*>", fix_group, text)
    missing = set(patterns) - rewritten
    if missing:
        raise RuntimeError(f"no dash pattern rewritten for layer(s): {sorted(missing)}")
    Path(path).write_text(text)


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
    centerlines = [Polyline((a[0], a[1], 0), (b[0], b[1], 0)) for a, b in center_coords]

    # Everything the drawing occupies: both views plus the centerline overhang.
    geometry_extent = max(
        (side_bbox[2] + ext) - (front_bbox[0] - ext),
        max(front_bbox[3] + ext, side_bbox[3]) - min(front_bbox[1] - ext, side_bbox[1]),
    )
    visible_weight, hidden_weight, center_weight = _weights_for_extent(geometry_extent)
    dash_extent = geometry_extent + 2 * _MARGIN_MM + visible_weight

    exporter = ExportSVG(unit=Unit.MM, precision=4, margin=_MARGIN_MM)
    exporter.add_layer("Visible", line_weight=visible_weight, line_type=LineType.CONTINUOUS)
    exporter.add_layer(
        "Hidden", line_color=HIDDEN_COLOR, line_weight=hidden_weight, line_type=LineType.ISO_DASH
    )
    exporter.add_layer(
        "Center", line_color=CENTERLINE_COLOR, line_weight=center_weight,
        line_type=LineType.CENTER,
    )
    exporter.add_shape(_to_polylines(v_front + v_side), layer="Visible")
    exporter.add_shape(_to_polylines(h_front + h_side), layer="Hidden")
    exporter.add_shape(centerlines, layer="Center")
    exporter.write(out_path)
    _rewrite_dash_patterns(out_path, dash_extent)
