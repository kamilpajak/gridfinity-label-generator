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
from catalog.models.knurled_nut import knurled_nut
from catalog.models.slotted_round_nut import slotted_round_nut
from catalog.models.slotted_face_nut import slotted_face_nut
from catalog.models.cross_hole_nut import cross_hole_nut
from catalog.models.tslot_nut import tslot_nut
from catalog.models.retaining_ring import retaining_ring
from catalog.models.hex_bolt import hex_bolt
from catalog.models.socket_screw import socket_screw
from catalog.models.set_screw import set_screw

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
    "knurled_nut": knurled_nut,
    "slotted_round_nut": slotted_round_nut,
    "slotted_face_nut": slotted_face_nut,
    "cross_hole_nut": cross_hole_nut,
    "tslot_nut": tslot_nut,
    "retaining_ring": retaining_ring,
    "hex_bolt": hex_bolt,
    "socket_screw": socket_screw,
    "set_screw": set_screw,
}


def build_part(family: str, shape: dict):
    if family not in KNOWN_FAMILIES:
        raise ValueError(f"unknown family '{family}'")
    return KNOWN_FAMILIES[family](**shape)
