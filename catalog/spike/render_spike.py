"""Phase 0 spike: render DIN 431 (pipe nut) and DIN 125 (flat washer) to SVG."""
import sys
from pathlib import Path

# Ensure the repo root is on sys.path so `catalog.*` is importable when this
# script is executed directly (python adds the script directory, not cwd).
_repo_root = str(Path(__file__).parents[2])
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from catalog.models.hex_nut import hex_nut
from catalog.models.washer import flat_washer
from catalog.render import render_two_views, DEFAULT_AXIS_Z

OUT = Path("catalog/spike/out")
OUT.mkdir(parents=True, exist_ok=True)

render_two_views(hex_nut(s=34.0, m=8.5, bore=20.96), DEFAULT_AXIS_Z, str(OUT / "din431.svg"))
render_two_views(flat_washer(13.0, 24.0, 2.5), DEFAULT_AXIS_Z, str(OUT / "din125.svg"))
print("wrote", list(OUT.glob("*.svg")))
