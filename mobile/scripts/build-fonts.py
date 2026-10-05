"""
Static font instances for the app, from the site's variable fonts.

React Native can't set a variable font's axes (no font-stretch, no arbitrary
weights), so each face the site uses is cut here as its own file:

  AtmosHeading-Black   Orbitron 900                 (`t-heading`)
  AtmosDisplay-Bold    Anybody, width 135, 700      (`t-label`)
  AtmosDisplay-Heavy   Anybody, width 135, 800      (`t-display`)
  AtmosBody-Regular    Archivo 400                  (body copy)
  AtmosBody-SemiBold   Archivo 600

Neither Orbitron nor Anybody draws te reo macrons well, so, as the site does
with its `unicode-range` face, the Latin Extended glyphs in the heading and
display files come from wide Archivo at the matching weight.

Every name in the name table is the file name, so `fontFamily` is the same
string on iOS and Android.

Usage (needs `pip install fonttools`, sources from github.com/google/fonts):
  python scripts/build-fonts.py <dir with Orbitron[wght].ttf,
    Anybody[wdth,wght].ttf, Archivo[wdth,wght].ttf>
"""

import sys
from pathlib import Path

from fontTools.merge import Merger
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.ttLib.scaleUpem import scale_upem
from fontTools.varLib.instancer import instantiateVariableFont

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "assets" / "fonts"
OUT.mkdir(parents=True, exist_ok=True)

# The site's latin-ext unicode-range, minus anything outside the BMP blocks
# these fonts cover.
EXT = [
    *range(0x0100, 0x02BB),
    *range(0x02BD, 0x02C6),
    *range(0x02C7, 0x02CD),
    *range(0x02CE, 0x02D8),
    *range(0x02DD, 0x0300),
    *range(0x1E00, 0x1EA0),
    *range(0x1EF2, 0x1F00),
]

ORBITRON = SRC / "Orbitron[wght].ttf"
ANYBODY = SRC / "Anybody[wdth,wght].ttf"
ARCHIVO = SRC / "Archivo[wdth,wght].ttf"


def instance(path: Path, **axes: float) -> TTFont:
    return instantiateVariableFont(TTFont(path), axes, updateFontNames=False)


def subset(font: TTFont, unicodes: list[int]) -> TTFont:
    options = Options()
    options.layout_features = ["*"]
    options.notdef_outline = True
    options.name_IDs = ["*"]
    sub = Subsetter(options)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    return font


def without_ext(font: TTFont) -> TTFont:
    keep = [cp for cp in font.getBestCmap() if cp not in set(EXT)]
    return subset(font, keep)


def with_ext(base: TTFont, weight: int, name: str) -> TTFont:
    """Base glyphs everywhere except Latin Extended, which comes from Archivo."""
    tmp = OUT / f".{name}"
    base_path, ext_path = tmp.with_suffix(".base.ttf"), tmp.with_suffix(".ext.ttf")
    without_ext(base).save(base_path)
    ext = subset(instance(ARCHIVO, wght=weight, wdth=125), EXT)
    # Merging needs one em size; Anybody is drawn on 2000, Archivo on 1000.
    scale_upem(ext, base["head"].unitsPerEm)
    ext.save(ext_path)
    merged = Merger().merge([str(base_path), str(ext_path)])
    base_path.unlink()
    ext_path.unlink()
    return merged


def rename(font: TTFont, name: str) -> TTFont:
    table = font["name"]
    for record_id in (16, 17, 21, 22, 25):
        table.removeNames(nameID=record_id)
    for record_id, value in {1: name, 2: "Regular", 3: name, 4: name, 6: name}.items():
        table.setName(value, record_id, 3, 1, 0x409)
        table.setName(value, record_id, 1, 0, 0)
    # Every file is its own family to the OS: no bold/italic linking.
    font["OS/2"].fsSelection = (font["OS/2"].fsSelection & ~0b1100001) | 0b1000000
    font["head"].macStyle = 0
    return font


def save(font: TTFont, name: str) -> None:
    for table in ("STAT", "fvar", "gvar", "avar", "HVAR", "MVAR"):
        if table in font:
            del font[table]
    rename(font, name).save(OUT / f"{name}.ttf")
    print(f"{name}.ttf")


save(with_ext(instance(ORBITRON, wght=900), 900, "AtmosHeading-Black"), "AtmosHeading-Black")
save(with_ext(instance(ANYBODY, wdth=135, wght=700), 700, "AtmosDisplay-Bold"), "AtmosDisplay-Bold")
save(with_ext(instance(ANYBODY, wdth=135, wght=800), 800, "AtmosDisplay-Heavy"), "AtmosDisplay-Heavy")
save(instance(ARCHIVO, wght=400, wdth=100), "AtmosBody-Regular")
save(instance(ARCHIVO, wght=600, wdth=100), "AtmosBody-SemiBold")
