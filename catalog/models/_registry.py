"""Map family names to generator callables and dispatch."""
from catalog.models.washer import (
    flat_washer, spring_washer, helical_spring_washer, curved_washer,
    toothed_lock_washer, toothed_lock_washer_internal, countersunk_toothed_washer,
    square_washer, tab_washer, spherical_seating_washer, wave_washer,
)
from catalog.models.hex_nut import hex_nut
from catalog.models.flange_nut import flange_nut
from catalog.models.cap_nut import cap_nut

KNOWN_FAMILIES = {
    "flat_washer": flat_washer,
    "spring_washer": spring_washer,
    "helical_spring_washer": helical_spring_washer,
    "curved_washer": curved_washer,
    "toothed_lock_washer": toothed_lock_washer,
    "toothed_lock_washer_internal": toothed_lock_washer_internal,
    "countersunk_toothed_washer": countersunk_toothed_washer,
    "square_washer": square_washer,
    "tab_washer": tab_washer,
    "spherical_seating_washer": spherical_seating_washer,
    "wave_washer": wave_washer,
    "hex_nut": hex_nut,
    "flange_nut": flange_nut,
    "cap_nut": cap_nut,
}


def build_part(family: str, shape: dict):
    if family not in KNOWN_FAMILIES:
        raise ValueError(f"unknown family '{family}'")
    return KNOWN_FAMILIES[family](**shape)
