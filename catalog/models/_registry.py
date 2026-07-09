"""Map family names to generator callables and dispatch."""
from catalog.models.washer import (
    flat_washer, spring_washer, helical_spring_washer, curved_washer,
)
from catalog.models.hex_nut import hex_nut

KNOWN_FAMILIES = {
    "flat_washer": flat_washer,
    "spring_washer": spring_washer,
    "helical_spring_washer": helical_spring_washer,
    "curved_washer": curved_washer,
    "hex_nut": hex_nut,
}


def build_part(family: str, shape: dict):
    if family not in KNOWN_FAMILIES:
        raise ValueError(f"unknown family '{family}'")
    return KNOWN_FAMILIES[family](**shape)
