"""Iterate dimension entries -> validate -> model -> render SVG -> manifest."""
import hashlib
import json
from importlib.metadata import version, PackageNotFoundError
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part
from catalog.render import render_two_views, DEFAULT_AXIS_Z


def _toolchain() -> dict:
    out = {}
    for pkg in ("build123d", "cadquery-ocp-novtk", "jsonschema"):
        try:
            out[pkg] = version(pkg)
        except PackageNotFoundError:
            out[pkg] = "unknown"
    return out


def _load_dimensions(dimensions_dir: str) -> dict:
    entries = {}
    for path in sorted(Path(dimensions_dir).glob("*.json")):
        if path.name.startswith("_"):
            continue
        entries.update(json.loads(path.read_text()))
    return entries


def build(dimensions_dir: str, out_dir: str, manifest_path: str) -> dict:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    entries = _load_dimensions(dimensions_dir)

    report = {"ok": [], "skipped": [], "failed": []}
    manifest = {"toolchain": _toolchain(), "standards": {}}

    for sid, entry in entries.items():
        problems = validate_entry(sid, entry)
        if problems:
            report["failed"].append({"id": sid, "reason": "; ".join(problems)})
            continue
        try:
            part = build_part(entry["family"], entry["shape"])
            svg_path = out / f"{sid}.svg"
            render_two_views(part, DEFAULT_AXIS_Z, str(svg_path))
            sha = hashlib.sha256(svg_path.read_bytes()).hexdigest()
            manifest["standards"][sid] = {
                "svg": f"{sid}.svg",
                "sha256": sha,
                "source": entry["source"],
                "family": entry["family"],
            }
            report["ok"].append(sid)
        except Exception as exc:  # per-standard failure must not abort the batch
            report["failed"].append({"id": sid, "reason": repr(exc)})

    Path(manifest_path).write_text(json.dumps(manifest, indent=2, sort_keys=True))
    return report


if __name__ == "__main__":
    r = build("catalog/dimensions", "catalog/out", "catalog/out/manifest.json")
    print(json.dumps({k: (v if k != "ok" else len(v)) for k, v in r.items()}, indent=2))
