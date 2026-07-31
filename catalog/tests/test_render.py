from pathlib import Path

import pytest


def test_render_two_views_writes_svg_with_all_layers(tmp_path: Path):
    from build123d import BuildPart, Cylinder, Mode
    from catalog.render import render_two_views, DEFAULT_AXIS_Z

    with BuildPart() as bp:
        Cylinder(radius=10, height=4)
        Cylinder(radius=4, height=4, mode=Mode.SUBTRACT)  # through hole
    part = bp.part

    out = tmp_path / "ring.svg"
    render_two_views(part, DEFAULT_AXIS_Z, str(out))

    text = out.read_text()
    assert out.exists()
    assert "Visible" in text and "Hidden" in text
    # Symmetry axes (engineering centerlines) are drawn on their own layer.
    assert "Center" in text
    # Two views => the drawing is wider than a single view of a 20mm-diameter ring.
    # Parse viewBox width and assert it exceeds one diameter.
    import re
    vb = re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+"', text)
    assert vb is not None and float(vb.group(1)) > 20.0


def test_centerline_coords_cross_emits_four_half_axes_from_the_center():
    from catalog.render import _centerline_coords

    # A 20 x 10 box centered at (5, 5); ext overhang of 2.
    coords = _centerline_coords((-5.0, 0.0, 15.0, 10.0), ext=2.0, cross=True)

    # Each axis is two half-lines, so a cross is four segments, every one of them
    # starting at the center (5, 5) and running outward past the outline by ext.
    assert len(coords) == 4
    assert all(start == (5.0, 5.0) for start, _ in coords)
    ends = sorted(end for _, end in coords)
    assert ends == [(-7.0, 5.0), (5.0, -2.0), (5.0, 12.0), (17.0, 5.0)]


def test_centerline_coords_without_cross_emits_two_horizontal_half_axes():
    from catalog.render import _centerline_coords

    coords = _centerline_coords((-5.0, 0.0, 15.0, 10.0), ext=2.0, cross=False)
    assert len(coords) == 2
    assert all(start == (5.0, 5.0) for start, _ in coords)
    ends = sorted(end for _, end in coords)
    assert ends == [(-7.0, 5.0), (17.0, 5.0)]


def test_center_layer_holds_the_symmetry_axes_as_a_chain_of_drawn_dashes(tmp_path: Path):
    import xml.etree.ElementTree as ET
    from build123d import BuildPart, Cylinder, Mode
    from catalog.render import render_two_views, DEFAULT_AXIS_Z

    with BuildPart() as bp:
        Cylinder(radius=10, height=4)
        Cylinder(radius=4, height=4, mode=Mode.SUBTRACT)  # through hole
    out = tmp_path / "ring.svg"
    render_two_views(bp.part, DEFAULT_AXIS_Z, str(out))

    root = ET.fromstring(out.read_text())
    strip = lambda tag: tag.rsplit("}", 1)[-1]  # noqa: E731 - drop the SVG namespace
    center = next(
        g for g in root.iter() if strip(g.tag) == "g" and g.get("id") == "Center"
    )
    # The chain pattern is geometry, so that every arm can end on a dash; a
    # stroke-dasharray would run out wherever the arm happens to stop.
    assert center.get("stroke-dasharray") is None
    lines = [c for c in center if strip(c.tag) == "line"]
    # Six arms (face-view cross + profile rotation axis), each broken into dashes.
    assert len(lines) > 6


def test_chain_dashes_start_and_end_the_arm_on_a_dash():
    # ISO 128: a chain line begins and ends with a long dash, never in a gap.
    from catalog.render import _chain_dashes

    segments = _chain_dashes((0.0, 0.0), (45.0, 0.0), box_extent_mm=100.0)

    assert segments[0][0] == pytest.approx((0.0, 0.0))
    assert segments[-1][1] == pytest.approx((45.0, 0.0))
    # long, short, long, short, ... long: an odd number of dashes.
    assert len(segments) % 2 == 1
    first_len = segments[0][1][0] - segments[0][0][0]
    second_len = segments[1][1][0] - segments[1][0][0]
    assert first_len > second_len  # long dash, then short
    assert segments[-1][1][0] - segments[-1][0][0] == pytest.approx(first_len)
    # dashes stay inside the arm and never overlap
    assert all(a[0] < b[0] for a, b in segments)
    assert all(segments[i][1][0] < segments[i + 1][0][0] for i in range(len(segments) - 1))


def test_chain_dashes_collapse_to_one_stroke_on_a_short_arm():
    # Too short for a full long dash: a solid stroke reads better than a fragment.
    from catalog.render import _chain_dashes

    segments = _chain_dashes((0.0, 0.0), (3.0, 0.0), box_extent_mm=100.0)

    assert segments == [((0.0, 0.0), (3.0, 0.0))]


def _stroke_width(svg_text: str, layer: str) -> float:
    import re

    group = re.search(r'<g[^>]*id="%s"[^>]*>' % layer, svg_text).group(0)
    return float(re.search(r'stroke-width="([\d.]+)"', group).group(1))


def _box_extent(svg_text: str) -> float:
    import re

    w, h = (
        float(v)
        for v in re.search(
            r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"', svg_text
        ).groups()
    )
    return max(w, h)


def _printed_dots(svg_text: str, layer: str) -> float:
    """Width in printer dots that `layer` reaches once the drawing fits the slot."""
    from catalog.render import LABEL_SLOT_MM, PRINT_DPI

    scale = LABEL_SLOT_MM / _box_extent(svg_text)
    return _stroke_width(svg_text, layer) * scale / (25.4 / PRINT_DPI)


def _ring_svg(radius: float, tmp_path: Path) -> str:
    from build123d import BuildPart, Cylinder, Mode

    from catalog.render import render_two_views, DEFAULT_AXIS_Z

    with BuildPart() as bp:
        Cylinder(radius=radius, height=radius / 2)
        Cylinder(radius=radius / 2, height=radius / 2, mode=Mode.SUBTRACT)
    out = tmp_path / f"ring{radius:g}.svg"
    render_two_views(bp.part, DEFAULT_AXIS_Z, str(out))
    return out.read_text()


def test_every_drawing_prints_the_same_line_widths(tmp_path: Path):
    # A drawing five times larger is scaled down five times harder to fit the same
    # slot, so its lines must be five times thicker in drawing units to land on the
    # paper at the same width. A width fixed in drawing units cannot do that.
    from catalog.render import CENTER_DOTS, HIDDEN_DOTS, VISIBLE_DOTS

    small = _ring_svg(6.0, tmp_path)
    large = _ring_svg(30.0, tmp_path)
    assert _stroke_width(large, "Visible") > 3 * _stroke_width(small, "Visible")

    for svg in (small, large):
        assert _printed_dots(svg, "Visible") == pytest.approx(VISIBLE_DOTS, abs=0.02)
        assert _printed_dots(svg, "Hidden") == pytest.approx(HIDDEN_DOTS, abs=0.02)
        assert _printed_dots(svg, "Center") == pytest.approx(CENTER_DOTS, abs=0.02)


def test_dash_patterns_print_the_same_whatever_the_drawing_size(tmp_path: Path):
    # Uniform weights are only half of a uniform look: an axis whose dashes scaled
    # with the drawing would read as a chain line on one and as dots on another.
    import re

    from catalog.render import (
        HIDDEN_DOTS,
        LABEL_SLOT_MM,
        PRINT_DPI,
        _CENTER_LONG_DOTS,
    )

    dot_mm = 25.4 / PRINT_DPI
    for svg in (_ring_svg(6.0, tmp_path), _ring_svg(30.0, tmp_path)):
        to_dots = (LABEL_SLOT_MM / _box_extent(svg)) / dot_mm
        hidden = re.search(r'<g[^>]*id="Hidden"[^>]*>', svg).group(0)
        dash = float(re.search(r'stroke-dasharray="([\d.]+)', hidden).group(1))
        assert dash * to_dots == pytest.approx(12 * HIDDEN_DOTS, abs=0.05)

        longest = max(
            abs(float(m.group(3)) - float(m.group(1)))
            for m in re.finditer(
                r'x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)"', svg
            )
        )
        assert longest * to_dots == pytest.approx(_CENTER_LONG_DOTS, rel=0.35)


def test_view_box_hugs_the_drawing_with_no_margin(tmp_path: Path):
    # Whitespace around the image belongs to whoever places it: the label layout
    # already spaces the image from the text, and padding baked in here would only
    # shrink the drawing inside the fixed slot.
    import re

    svg = _ring_svg(10.0, tmp_path)
    box_x, box_w = (
        float(v)
        for v in re.search(
            r'viewBox="([-\d.]+) [-\d.]+ ([\d.]+) [\d.]+"', svg
        ).groups()
    )
    xs = [
        float(m.group(1))
        for m in re.finditer(r"[ML] ([-\d.]+),[-\d.]+", svg)
    ] + [float(m.group(1)) for m in re.finditer(r'x[12]="([-\d.]+)"', svg)]

    # The only padding is the half line width ExportSVG adds at each side so the
    # outermost stroke is not clipped.
    stroke = float(
        re.search(r'stroke-width="([\d.]+)"', re.search(r'<g[^>]*id="Visible"[^>]*>', svg).group(0)).group(1)
    )
    assert min(xs) - box_x == pytest.approx(stroke / 2, abs=0.01)
    assert (box_x + box_w) - max(xs) == pytest.approx(stroke / 2, abs=0.01)


def test_centerlines_are_drawn_thinner_than_the_outline(tmp_path: Path):
    # A chain line crossing the whole drawing would compete with the outline if it
    # carried the same weight.
    from catalog.render import CENTER_DOTS, VISIBLE_DOTS

    assert CENTER_DOTS < VISIBLE_DOTS
    svg = _ring_svg(10.0, tmp_path)
    assert _stroke_width(svg, "Center") < _stroke_width(svg, "Visible")


def test_every_layer_is_pure_black(tmp_path: Path):
    # The label printer is monochrome, so a gray hidden line would only dither.
    import re

    svg = _ring_svg(10.0, tmp_path)
    strokes = set(re.findall(r'stroke="(rgb\([^)]*\))"', svg))
    assert strokes == {"rgb(0,0,0)"}


def test_preset_for_hardware_type_selects_the_nut_preset():
    from catalog.render import preset_for_hardware_type, NUT_PRESET, DEFAULT_AXIS_Z

    assert preset_for_hardware_type("nut") is NUT_PRESET
    assert preset_for_hardware_type("washer") is DEFAULT_AXIS_Z
    assert preset_for_hardware_type("screw") is DEFAULT_AXIS_Z


def test_nut_preset_renders_two_height_aligned_views(tmp_path):
    import re
    from catalog.models.hex_nut import hex_nut
    from catalog.render import render_two_views, NUT_PRESET

    part = hex_nut(s=18.0, m=10.8, bore=10.2)
    out = tmp_path / "nut.svg"
    render_two_views(part, NUT_PRESET, str(out))

    text = out.read_text()
    assert "Visible" in text and "Hidden" in text and "Center" in text
    # Two views side by side: wider than a single face view of an 18mm-across-flats nut.
    vb = re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+"', text)
    assert vb is not None and float(vb.group(1)) > 20.0
