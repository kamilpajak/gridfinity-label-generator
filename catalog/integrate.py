"""Copy reviewed SVGs into static/ and repoint image-mappings.json per standard."""
import json
import os
import shutil
import tempfile
from pathlib import Path

# hardwareType for mapping entries created from scratch; existing entries keep theirs.
FAMILY_TO_HARDWARE_TYPE = {
    "flange_nut": "nut",
    "hex_nut": "nut",
    "lock_nut": "nut",
    "set_screw": "screw",
    "socket_screw": "screw",
}


def apply(manifest_path, out_dir, static_dir, image_mappings_path) -> list[str]:
    """Integrate every manifest standard, or none of them.

    Both checks below used to run inside the copy loop, so a manifest that
    tripped one of them left the SVGs already copied into static/ while
    image-mappings.json was never written — the two out of step, with nothing
    saying so. Everything that can fail is therefore resolved first, against the
    in-memory mappings, and the filesystem is only touched once it cannot.
    """
    standards = json.loads(Path(manifest_path).read_text())["standards"]
    mappings = json.loads(Path(image_mappings_path).read_text())

    planned = []
    for sid, meta in standards.items():
        src = Path(out_dir) / meta["svg"]
        if not src.exists():
            raise FileNotFoundError(f"generated SVG missing for {sid}: {src}")
        entry = dict(mappings.get(sid, {}))
        entry["image"] = f"/images/standards/{meta['svg']}"
        if "hardwareType" not in entry:
            hardware_type = FAMILY_TO_HARDWARE_TYPE.get(meta.get("family"))
            if hardware_type is None:
                raise KeyError(
                    f"no hardwareType for new mapping entry {sid} "
                    f"(family {meta.get('family')!r}) — extend FAMILY_TO_HARDWARE_TYPE"
                )
            entry["hardwareType"] = hardware_type
        planned.append((sid, src, entry))

    static = Path(static_dir)
    static.mkdir(parents=True, exist_ok=True)
    for sid, src, entry in planned:
        shutil.copyfile(src, static / src.name)
        mappings[sid] = entry

    _write_atomically(Path(image_mappings_path), json.dumps(mappings, indent="\t") + "\n")
    return sorted(sid for sid, _, _ in planned)


def _write_atomically(path: Path, text: str) -> None:
    """Replace `path` in one step, so a crash cannot leave it half-written."""
    handle, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=path.name, suffix=".tmp")
    try:
        with os.fdopen(handle, "w") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


if __name__ == "__main__":
    changed = apply("catalog/out/manifest.json", "catalog/out",
                    "static/images/standards", "data/image-mappings.json")
    print(f"migrated {len(changed)} standards")
