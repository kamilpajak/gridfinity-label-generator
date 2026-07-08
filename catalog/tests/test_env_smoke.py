"""Proves the container has a working build123d + OCP + SVG export toolchain."""
import xml.etree.ElementTree as ET
from pathlib import Path


def test_project_to_viewport_exports_svg_with_two_layers(tmp_path: Path):
    from build123d import BuildPart, Box, ExportSVG, Unit, LineType

    with BuildPart() as bp:
        Box(40, 30, 10)
    part = bp.part

    visible, hidden = part.project_to_viewport(
        viewport_origin=(0, -100, 0), viewport_up=(0, 0, 1), look_at=(0, 0, 0)
    )
    assert len(visible) > 0

    exporter = ExportSVG(unit=Unit.MM, precision=4)
    exporter.add_layer("Visible", line_weight=0.4, line_type=LineType.CONTINUOUS)
    exporter.add_layer("Hidden", line_weight=0.3, line_type=LineType.ISO_DASH)
    exporter.add_shape(visible, layer="Visible")
    exporter.add_shape(hidden, layer="Hidden")
    out = tmp_path / "smoke.svg"
    exporter.write(str(out))

    assert out.exists()
    root = ET.parse(out).getroot()
    # SVG groups carry the layer names; at least the visible layer must be present.
    text = out.read_text()
    assert "Visible" in text
    assert root.tag.endswith("svg")
