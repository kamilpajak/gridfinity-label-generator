"""Validate a dimension entry against the JSON Schema and the known family registry."""
import json
from pathlib import Path

from jsonschema import Draft7Validator

from catalog.models._registry import KNOWN_FAMILIES

_SCHEMA = json.loads((Path(__file__).parent / "dimensions" / "_schema.json").read_text())
_VALIDATOR = Draft7Validator(_SCHEMA)


def validate_entry(standard_id: str, entry: dict) -> list[str]:
    problems = [f"{standard_id}: {e.message}" for e in _VALIDATOR.iter_errors(entry)]
    fam = entry.get("family")
    if fam is not None and fam not in KNOWN_FAMILIES:
        problems.append(f"{standard_id}: unknown family '{fam}'")
    return problems
