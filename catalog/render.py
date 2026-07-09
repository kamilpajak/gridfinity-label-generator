"""Project a 3D Part to a two-view (front + side) monochrome SVG technical drawing."""
from dataclasses import dataclass

from build123d import ExportSVG, Unit, LineType, Location, Polyline

VISIBLE_WEIGHT_MM = 0.4
HIDDEN_WEIGHT_MM = 0.3
HIDDEN_COLOR = (110, 110, 110)

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

    fx_min, _, fx_max, _ = _edges_bbox(v_front + h_front)
    sx_min, _, sx_max, _ = _edges_bbox(v_side + h_side)
    # Place the side view to the right of the front view with a fixed gap.
    dx = (fx_max + gap_mm) - sx_min
    move = Location((dx, 0, 0))
    v_side = [move * e for e in v_side]
    h_side = [move * e for e in h_side]

    exporter = ExportSVG(unit=Unit.MM, precision=4, margin=2.0)
    exporter.add_layer("Visible", line_weight=VISIBLE_WEIGHT_MM, line_type=LineType.CONTINUOUS)
    exporter.add_layer(
        "Hidden", line_color=HIDDEN_COLOR, line_weight=HIDDEN_WEIGHT_MM, line_type=LineType.ISO_DASH
    )
    exporter.add_shape(_to_polylines(v_front + v_side), layer="Visible")
    exporter.add_shape(_to_polylines(h_front + h_side), layer="Hidden")
    exporter.write(out_path)
