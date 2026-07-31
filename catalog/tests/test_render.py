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


def test_center_layer_holds_the_symmetry_axis_lines_as_a_dashed_chain(tmp_path: Path):
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
    # A chain-line dash pattern is what makes it read as an engineering centerline.
    assert center.get("stroke-dasharray")
    lines = [c for c in center if strip(c.tag) == "line"]
    # Each axis is two half-lines from the center: face-view cross (4) + profile
    # rotation axis (2) = 6.
    assert len(lines) == 6


def _printed_dots(svg_text: str, layer: str) -> float:
    """Width in printer dots that `layer` reaches once the drawing fits the label slot."""
    import re

    from catalog.render import LABEL_SLOT_MM, PRINT_DPI

    w, h = (
        float(v)
        for v in re.search(
            r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"', svg_text
        ).groups()
    )
    group = re.search(r'<g[^>]*id="%s"[^>]*>' % layer, svg_text).group(0)
    stroke = float(re.search(r'stroke-width="([\d.]+)"', group).group(1))
    return stroke * (LABEL_SLOT_MM / max(w, h)) / (25.4 / PRINT_DPI)


def _ring_svg(radius: float, tmp_path: Path) -> str:
    from build123d import BuildPart, Cylinder, Mode

    from catalog.render import render_two_views, DEFAULT_AXIS_Z

    with BuildPart() as bp:
        Cylinder(radius=radius, height=radius / 2)
        Cylinder(radius=radius / 2, height=radius / 2, mode=Mode.SUBTRACT)
    out = tmp_path / f"ring{radius:g}.svg"
    render_two_views(bp.part, DEFAULT_AXIS_Z, str(out))
    return out.read_text()


def test_line_weights_print_the_same_width_whatever_the_drawing_size(tmp_path: Path):
    # A drawing five times larger is scaled down five times harder to fit the same
    # label slot, so its lines must be five times thicker in drawing units to reach
    # the paper at the target width. Anything else prints thin on large drawings.
    from catalog.render import VISIBLE_DOTS, THIN_DOTS

    small = _ring_svg(6.0, tmp_path)
    large = _ring_svg(30.0, tmp_path)

    for svg in (small, large):
        assert _printed_dots(svg, "Visible") == pytest.approx(VISIBLE_DOTS, abs=0.02)
        assert _printed_dots(svg, "Hidden") == pytest.approx(THIN_DOTS, abs=0.02)
        assert _printed_dots(svg, "Center") == pytest.approx(THIN_DOTS, abs=0.02)


def test_dash_patterns_are_shortened_for_miniature_reproduction(tmp_path: Path):
    # The exporter's ISO pattern (dash 12d) is built for a full-size sheet and
    # leaves one or two marks per edge at label size.
    import re

    from catalog.render import CENTER_DASH_DOTS, HIDDEN_DASH_DOTS, LABEL_SLOT_MM, PRINT_DPI

    svg = _ring_svg(10.0, tmp_path)
    w, h = (
        float(v)
        for v in re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"', svg).groups()
    )
    to_dots = (LABEL_SLOT_MM / max(w, h)) / (25.4 / PRINT_DPI)

    for layer, expected in (("Hidden", HIDDEN_DASH_DOTS), ("Center", CENTER_DASH_DOTS)):
        group = re.search(r'<g[^>]*id="%s"[^>]*>' % layer, svg).group(0)
        dashes = [
            float(v) * to_dots
            for v in re.search(r'stroke-dasharray="([^"]*)"', group).group(1).split()
        ]
        assert dashes == pytest.approx(list(expected), abs=0.02)


def test_rewrite_dash_patterns_fails_loudly_when_a_layer_is_missing(tmp_path: Path):
    from catalog.render import _rewrite_dash_patterns

    stub = tmp_path / "stub.svg"
    stub.write_text('<svg><g id="Hidden" stroke-dasharray="1 1"></g></svg>')

    with pytest.raises(RuntimeError, match="Center"):
        _rewrite_dash_patterns(str(stub), 40.0)


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
