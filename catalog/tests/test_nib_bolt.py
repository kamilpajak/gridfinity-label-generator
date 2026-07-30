import pytest
from build123d import Box, Pos, Compound

from catalog.models.nib_bolt import nib_bolt

# M12 fixtures: DIN 604 flat countersunk (dk/k/g/i from fasteners.eu + Fuller + boltingspecialist)
# and DIN 607 cup head (dk/k/g/i from Fuller + fasten.it). nib_l / length / tip_chamfer are the
# REPRESENTATIVE values of the data file.
D_SHANK = 12.0
LENGTH = 50.0
DK = 24.65
K_CSK = 7.0          # DIN 604 head height (max)
K_CUP = 9.65         # DIN 607 head height (max)
NIB_W = 3.6          # nib width g (max), both standards
NIB_L = 9.0          # radial nib reach, REPRESENTATIVE (not tabulated)
NIB_D_CSK = 5.7      # DIN 604 nib depth i (min)
NIB_D_CUP = 3.2      # DIN 607 nib depth i (min)
TIP_CHAMFER = 1.2


def _csk(**over):
    cfg = dict(d_shank=D_SHANK, length=LENGTH, dk=DK, k=K_CSK, head_style="countersunk",
               nib_w=NIB_W, nib_l=NIB_L, nib_d=NIB_D_CSK, tip_chamfer=TIP_CHAMFER)
    cfg.update(over)
    return nib_bolt(**cfg)


def _cup(**over):
    cfg = dict(d_shank=D_SHANK, length=LENGTH, dk=DK, k=K_CUP, head_style="cup",
               nib_w=NIB_W, nib_l=NIB_L, nib_d=NIB_D_CUP, tip_chamfer=TIP_CHAMFER)
    cfg.update(over)
    return nib_bolt(**cfg)


def _solid_at(part, x, y, z, probe=0.4):
    """True when the part has material in a small box centred at (x, y, z)."""
    return part.intersect(Pos(x, y, z) * Box(probe, probe, probe)) is not None


def test_envelope_countersunk():
    part = _csk()
    bb = part.bounding_box()
    assert round(bb.size.X, 2) == round(DK, 2)          # cone top rim is the widest feature
    assert round(bb.size.Y, 2) == round(DK, 2)          # nib (3.6 wide) never widens Y
    assert round(bb.max.Z, 2) == round(K_CSK, 2)        # flat head top at z=k
    assert round(bb.min.Z, 1) == round(-LENGTH, 1)      # shank free end at -length


def test_envelope_cup():
    part = _cup()
    bb = part.bounding_box()
    assert round(bb.size.X, 2) == round(DK, 2)          # dome base circle is the widest feature
    assert round(bb.max.Z, 2) == round(K_CUP, 2)        # dome apex at z=k
    assert round(bb.min.Z, 1) == round(-LENGTH, 1)


def test_countersunk_cone_narrow_at_bearing_plane_wide_at_top():
    # probe at radius 10 (between d_shank/2=6 and dk/2=12.325): the cone radius is
    # 6 + 0.9036*z, so x=10 is void near z=0 and material near the top rim.
    part = _csk()
    assert not _solid_at(part, 10.0, 0.0, 0.5)
    assert _solid_at(part, 10.0, 0.0, K_CSK - 0.5)


def test_cup_dome_wide_at_base_curving_off_above():
    # spherical cap R=12.696, centre z=-3.046: at x=10 the dome surface is at z=4.78,
    # so x=10 is material near the base and void at z=6.
    part = _cup()
    assert _solid_at(part, 10.0, 0.0, 0.5)
    assert not _solid_at(part, 10.0, 0.0, 6.0)
    assert _solid_at(part, 0.0, 0.0, K_CUP - 0.5)       # solid up to the apex on the axis


@pytest.mark.parametrize("build,nib_d", [(_csk, NIB_D_CSK), (_cup, NIB_D_CUP)])
def test_nib_lug_below_bearing_plane_on_plus_x_only(build, nib_d):
    part = build()
    x_mid = (D_SHANK / 2.0 + NIB_L) / 2.0               # 7.5: past the shank, inside the nib
    assert _solid_at(part, x_mid, 0.0, -nib_d / 2.0)    # nib material beyond the shank wall
    assert not _solid_at(part, -x_mid, 0.0, -nib_d / 2.0)   # one-sided: nothing on -X
    assert not _solid_at(part, NIB_L + 0.5, 0.0, -nib_d / 2.0)  # nib ends at nib_l
    assert not _solid_at(part, x_mid, 0.0, -nib_d - 0.5)        # nothing below the nib


def test_nib_width_reads_nib_w():
    # a thin column through the nib (past the shank, above the nib floor) spans exactly nib_w in Y
    part = _csk()
    x_mid = (D_SHANK / 2.0 + NIB_L) / 2.0
    col = part.intersect(Pos(x_mid, 0.0, -NIB_D_CSK / 2.0) * Box(0.4, 50.0, 0.4))
    assert col is not None
    assert round(Compound(col).bounding_box().size.Y, 2) == round(NIB_W, 2)


def test_shank_below_bearing_plane_with_lead_chamfer():
    part = _cup()
    r = D_SHANK / 2.0
    assert _solid_at(part, r - 0.6, 0.0, -LENGTH / 2.0)        # solid to the shank wall
    assert not _solid_at(part, r + 0.6, 0.0, -LENGTH / 2.0)    # void beyond the shank
    assert not _solid_at(part, r - 0.2, 0.0, -LENGTH + 0.2)    # 45-deg lead trims the corner
    assert not _solid_at(part, 0.0, 0.0, -LENGTH - 0.6)        # nothing below the tip


def test_shank_without_chamfer_is_flat_bottomed():
    part = _csk(tip_chamfer=None)
    r = D_SHANK / 2.0
    assert _solid_at(part, r - 0.2, 0.0, -LENGTH + 0.2)        # corner intact (no lead chamfer)
    assert round(part.bounding_box().min.Z, 1) == round(-LENGTH, 1)


@pytest.mark.parametrize("build", [_csk, _cup])
def test_single_fused_solid(build):
    part = build()
    assert len(part.solids()) == 1
    assert part.volume > 0


def test_guards():
    with pytest.raises(ValueError):
        _csk(nib_w=0.0)                      # non-positive dim
    with pytest.raises(ValueError):
        _cup(length=-1.0)                    # non-positive dim (shank param)
    with pytest.raises(ValueError):
        _csk(head_style="dome")              # unknown head style
    with pytest.raises(ValueError):
        _csk(d_shank=DK)                     # shank not narrower than the head
    with pytest.raises(ValueError):
        _cup(nib_l=D_SHANK / 2.0)            # nib does not protrude past the shank
    with pytest.raises(ValueError):
        _cup(nib_l=DK)                       # nib reaches past the head outline
    with pytest.raises(ValueError):
        _csk(nib_w=D_SHANK)                  # nib as wide as the shank (not a lug)
    with pytest.raises(ValueError):
        _csk(nib_d=LENGTH)                   # nib as deep as the whole shank
    with pytest.raises(ValueError):
        _cup(tip_chamfer=D_SHANK)            # rejected by _screw_shank (chamfer >= radius)
