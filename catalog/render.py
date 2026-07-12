"""Project a 3D Part to a two-view (front + side) monochrome SVG technical drawing."""
from dataclasses import dataclass

from build123d import ExportSVG, Unit, LineType, Location, Polyline

VISIBLE_WEIGHT_MM = 0.4
HIDDEN_WEIGHT_MM = 0.3
HIDDEN_COLOR = (110, 110, 110)

# Engineering centerlines (thin chain lines marking the axes of symmetry).
CENTERLINE_WEIGHT_MM = 0.2
CENTERLINE_COLOR = (0, 0, 0)
_CENTER_EXT_FRAC = 0.08  # overhang past the outline, as a fraction of view size
_CENTER_MIN_EXT_MM = 1.5  # floor so small drawings still get a visible overhang

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
DEFAULT_AXIS_Z = CameraPreset(
    front_origin=(0, 0, 1000),
    front_up=(0, 1, 0),
    side_origin=(0, -1000, 0),
    side_up=(1, 0, 0),   # standing: diameter vertical, thickness horizontal
)


def _centerline_coords(bbox, ext, cross):
    """Endpoint pairs for the symmetry axes of a view.

    bbox is (xmin, ymin, xmax, ymax). The horizontal axis runs through the
    vertical center and overhangs the outline by ``ext`` on each end; with
    ``cross`` it is joined by a vertical axis through the horizontal center
    (the full cross a circular face view needs). A profile view, symmetric
    only about its rotation axis, takes the horizontal line alone.
    """
    xmin, ymin, xmax, ymax = bbox
    cx, cy = (xmin + xmax) / 2.0, (ymin + ymax) / 2.0
    coords = [((xmin - ext, cy), (xmax + ext, cy))]
    if cross:
        coords.append(((cx, ymin - ext), (cx, ymax + ext)))
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
    # profile view. Overhang scales with the (larger) face view so both views
    # share one consistent extension length.
    fw, fh = front_bbox[2] - front_bbox[0], front_bbox[3] - front_bbox[1]
    ext = round(max(_CENTER_MIN_EXT_MM, _CENTER_EXT_FRAC * max(fw, fh)), 2)
    center_coords = _centerline_coords(front_bbox, ext, cross=True)
    center_coords += _centerline_coords(side_bbox, ext, cross=False)
    centerlines = [Polyline((a[0], a[1], 0), (b[0], b[1], 0)) for a, b in center_coords]

    exporter = ExportSVG(unit=Unit.MM, precision=4, margin=2.0)
    exporter.add_layer("Visible", line_weight=VISIBLE_WEIGHT_MM, line_type=LineType.CONTINUOUS)
    exporter.add_layer(
        "Hidden", line_color=HIDDEN_COLOR, line_weight=HIDDEN_WEIGHT_MM, line_type=LineType.ISO_DASH
    )
    exporter.add_layer(
        "Center", line_color=CENTERLINE_COLOR, line_weight=CENTERLINE_WEIGHT_MM,
        line_type=LineType.CENTER,
    )
    exporter.add_shape(_to_polylines(v_front + v_side), layer="Visible")
    exporter.add_shape(_to_polylines(h_front + h_side), layer="Hidden")
    exporter.add_shape(centerlines, layer="Center")
    exporter.write(out_path)
