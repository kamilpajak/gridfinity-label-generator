"""Iterate dimension entries -> validate -> model -> render SVG -> manifest."""
import hashlib
import json
from importlib.metadata import version, PackageNotFoundError
from pathlib import Path

from catalog.schema import validate_entry
from catalog.models._registry import build_part
from catalog.render import render_two_views, preset_for_hardware_type


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

    # Pass 1: render every entry that defines its own geometry.
    for sid, entry in entries.items():
        if "alias_of" in entry:
            continue
        problems = validate_entry(sid, entry)
        if problems:
            report["failed"].append({"id": sid, "reason": "; ".join(problems)})
            continue
        try:
            part = build_part(entry["family"], entry["shape"])
            svg_path = out / f"{sid}.svg"
            render_two_views(part, preset_for_hardware_type(entry["hardwareType"]), str(svg_path))
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

    # Pass 2: resolve aliases against the base drawings rendered in pass 1. An alias
    # is a standard whose geometry is identical to a base (e.g. a plated variant), so it
    # points at the base's SVG rather than duplicating the file. The target must be a
    # rendered base, not another alias, so a single pass over the already-built manifest
    # suffices.
    for sid, entry in entries.items():
        if "alias_of" not in entry:
            continue
        problems = validate_entry(sid, entry)
        if problems:
            report["failed"].append({"id": sid, "reason": "; ".join(problems)})
            continue
        target = entry["alias_of"]
        base = manifest["standards"].get(target)
        if target not in entries:
            reason = f"alias_of '{target}' does not exist in the data"
        elif base is None:
            reason = f"alias_of '{target}' exists but failed to build — fix its geometry first"
        elif "alias_of" in base:
            reason = f"alias_of '{target}' is itself an alias (chains are not resolved)"
        else:
            reason = None
        if reason is not None:
            report["failed"].append({"id": sid, "reason": reason})
            continue
        manifest["standards"][sid] = {
            "svg": base["svg"],
            "sha256": base["sha256"],
            "source": entry["source"],
            "family": base["family"],
            "alias_of": target,
        }
        report["ok"].append(sid)

    Path(manifest_path).write_text(json.dumps(manifest, indent=2, sort_keys=True))
    return report


if __name__ == "__main__":
    r = build("catalog/dimensions", "catalog/out", "catalog/out/manifest.json")
    print(json.dumps({k: (v if k != "ok" else len(v)) for k, v in r.items()}, indent=2))
