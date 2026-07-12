from pathlib import Path


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


def test_centerline_coords_cross_gives_horizontal_and_vertical_through_center():
    from catalog.render import _centerline_coords

    # A 20 x 10 box centered at (5, 5); ext overhang of 2.
    coords = _centerline_coords((-5.0, 0.0, 15.0, 10.0), ext=2.0, cross=True)
    assert len(coords) == 2

    (hx1, hy1), (hx2, hy2) = coords[0]  # horizontal axis at center y = 5
    assert hy1 == hy2 == 5.0
    assert hx1 == -7.0 and hx2 == 17.0  # spans full width + ext on both ends

    (vx1, vy1), (vx2, vy2) = coords[1]  # vertical axis at center x = 5
    assert vx1 == vx2 == 5.0
    assert vy1 == -2.0 and vy2 == 12.0


def test_centerline_coords_without_cross_gives_horizontal_axis_only():
    from catalog.render import _centerline_coords

    coords = _centerline_coords((-5.0, 0.0, 15.0, 10.0), ext=2.0, cross=False)
    assert len(coords) == 1
    (_, hy1), (_, hy2) = coords[0]
    assert hy1 == hy2 == 5.0


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
    # Full cross on the round face view (2 lines) + rotation axis on the profile (1).
    assert len(lines) == 3
