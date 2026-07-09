"""Copy reviewed SVGs into static/ and repoint image-mappings.json per standard."""
import json
import shutil
from pathlib import Path


def apply(manifest_path, out_dir, static_dir, image_mappings_path) -> list[str]:
    standards = json.loads(Path(manifest_path).read_text())["standards"]
    mappings = json.loads(Path(image_mappings_path).read_text())
    static = Path(static_dir)
    static.mkdir(parents=True, exist_ok=True)

    changed = []
    for sid, meta in standards.items():
        src = Path(out_dir) / meta["svg"]
        shutil.copyfile(src, static / meta["svg"])
        entry = mappings.setdefault(sid, {})
        entry["image"] = f"/images/standards/{meta['svg']}"
        changed.append(sid)

    Path(image_mappings_path).write_text(json.dumps(mappings, indent="\t") + "\n")
    return sorted(changed)


if __name__ == "__main__":
    changed = apply("catalog/out/manifest.json", "catalog/out",
                    "static/images/standards", "data/image-mappings.json")
    print(f"migrated {len(changed)} standards")
