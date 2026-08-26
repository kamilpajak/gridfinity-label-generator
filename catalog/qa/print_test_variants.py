"""Render a few drawings at several pen weights, for a printed calibration test.

The catalog targets VISIBLE_DOTS dots of ink on the paper, but the only way to
find the right number is to print it: below about one dot a thermal label
printer drops the line entirely, and above two or three the detail fills in.
This renders the same standards at a range of weights so one tape settles it.

The three weights scale together, so each variant keeps the 5:4:3 ratio between
visible, hidden and centre lines. Scaling VISIBLE_DOTS on its own would not:
`_weights_for_geometry` derives the other two as `visible * DOTS / VISIBLE_DOTS`,
which cancels out and pins them at 1.2 and 0.9 dots whatever the visible pen is.

Usage (inside the pinned container):
    ./catalog/run python -m catalog.qa.print_test_variants
"""
import json
from pathlib import Path

from catalog import render
from catalog.build_catalog import _load_dimensions
from catalog.models._registry import build_part
from catalog.render import preset_for_hardware_type, render_two_views

# Multipliers applied to the current pen. 1.0 is what the catalog ships today.
FACTORS = (0.67, 1.0, 1.33, 1.67, 2.0)

# Drawings to render. Everything listed here lands on disk; the JS composer picks
# which of them reach the tape, so leaving extras in costs nothing but build time.
#
#   din125   flat washer, almost nothing but two concentric circles
#   din127   spring lock washer, a split ring with an offset gap
#   din316   wing nut, the most irregular outline in the catalog
#   din7991  countersunk socket screw, a shallow cone meeting a shaft
#   din936   thin hexagon nut, a short section between two flats
#   din912   plain socket cap screw, the most common shape in the catalog
#   din934   hexagon nut, two views with a chamfer arc
#   din2093  disc spring, a thin section where the two faces nearly touch
#   iso4014  long hex bolt, the widest drawing, so the smallest scale factor
#   din472   retaining ring, the densest outline in the catalog
STANDARDS = (
    "din125",
    "din127",
    "din316",
    "din7991",
    "din936",
    "din912",
    "din934",
    "din2093",
    "iso4014",
    "din472",
)


def main() -> None:
    out = Path("catalog/out/print-test")
    out.mkdir(parents=True, exist_ok=True)
    entries = _load_dimensions("catalog/dimensions")

    base_visible = render.VISIBLE_DOTS
    base_hidden = render.HIDDEN_DOTS
    base_center = render.CENTER_DOTS

    index = {"factors": [], "standards": list(STANDARDS)}
    try:
        for factor in FACTORS:
            render.VISIBLE_DOTS = base_visible * factor
            render.HIDDEN_DOTS = base_hidden * factor
            render.CENTER_DOTS = base_center * factor
            tag = f"{factor:.2f}".replace(".", "_")
            for sid in STANDARDS:
                entry = entries[sid]
                if "alias_of" in entry:
                    entry = entries[entry["alias_of"]]
                part = build_part(entry["family"], entry["shape"])
                render_two_views(
                    part,
                    preset_for_hardware_type(entry["hardwareType"]),
                    str(out / f"{sid}__{tag}.svg"),
                )
            index["factors"].append(
                {
                    "factor": factor,
                    "tag": tag,
                    "visible_dots": round(render.VISIBLE_DOTS, 3),
                    "hidden_dots": round(render.HIDDEN_DOTS, 3),
                    "center_dots": round(render.CENTER_DOTS, 3),
                }
            )
    finally:
        render.VISIBLE_DOTS = base_visible
        render.HIDDEN_DOTS = base_hidden
        render.CENTER_DOTS = base_center

    (out / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    print(json.dumps(index, indent=2))


if __name__ == "__main__":
    main()
