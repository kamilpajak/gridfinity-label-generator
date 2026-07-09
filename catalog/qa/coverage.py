"""Coverage gate: every app-served standard of a hardware type must be generated."""
import json
from pathlib import Path


def check(manifest_path: str, image_mappings_path: str, hardware_type: str) -> list[str]:
    generated = set(json.loads(Path(manifest_path).read_text())["standards"])
    mappings = json.loads(Path(image_mappings_path).read_text())
    expected = {
        sid for sid, m in mappings.items() if m.get("hardwareType") == hardware_type
    }
    return sorted(expected - generated)


if __name__ == "__main__":
    import sys

    missing = check("catalog/out/manifest.json", "data/image-mappings.json", "washer")
    if missing:
        print("COVERAGE GAP (washer):", ", ".join(missing))
        sys.exit(1)
    print("washer coverage: complete")
