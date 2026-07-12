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


def test_preset_for_family_selects_the_nut_preset():
    from catalog.render import preset_for_family, NUT_PRESET, DEFAULT_AXIS_Z

    assert preset_for_family("nut") is NUT_PRESET
    assert preset_for_family("flat_washer") is DEFAULT_AXIS_Z
    assert preset_for_family("anything-else") is DEFAULT_AXIS_Z


def test_nut_preset_renders_two_height_aligned_views(tmp_path):
    import re
    from catalog.models.hex_nut import hex_nut
    from catalog.render import render_two_views, NUT_PRESET

    part = hex_nut(s=18.0, m=10.8, bore=10.2)
    out = tmp_path / "nut.svg"
    render_two_views(part, NUT_PRESET, str(out))

    text = out.read_text()
    assert out.exists()
    assert "Visible" in text and "Hidden" in text and "Center" in text
    # Two views side by side: wider than a single face view of an 18mm-across-flats nut.
    vb = re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+"', text)
    assert vb is not None and float(vb.group(1)) > 20.0
