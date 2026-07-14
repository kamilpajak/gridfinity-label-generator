"""Map family names to generator callables and dispatch."""
from catalog.models.washer import (
    flat_washer, spring_washer, helical_spring_washer, curved_washer,
    toothed_lock_washer, toothed_lock_washer_internal, countersunk_toothed_washer,
    square_washer, tab_washer, spherical_seating_washer, wave_washer,
)
from catalog.models.hex_nut import hex_nut
from catalog.models.flange_nut import flange_nut
from catalog.models.cap_nut import cap_nut
from catalog.models.castle_nut import castle_nut
from catalog.models.collar_nut import collar_nut
from catalog.models.square_nut import square_nut
from catalog.models.wing_nut import wing_nut
from catalog.models.lock_nut import lock_nut

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
    "castle_nut": castle_nut,
    "collar_nut": collar_nut,
    "square_nut": square_nut,
    "wing_nut": wing_nut,
    "lock_nut": lock_nut,
}


def build_part(family: str, shape: dict):
    if family not in KNOWN_FAMILIES:
        raise ValueError(f"unknown family '{family}'")
    return KNOWN_FAMILIES[family](**shape)
