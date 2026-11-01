"""Adds the Polish letters Permanent Marker lacks (Ą ą Ć ć Ę ę Ń ń Ś ś Ź ź Ż ż)
as composites of its own base letters and accents, then writes WOFF2."""
import sys
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent

src, out = sys.argv[1], sys.argv[2]
f = TTFont(src)
glyf, hmtx, cmap = f['glyf'], f['hmtx'], f['cmap']

def centre(n):
    g = glyf[n]; g.recalcBounds(glyf)
    return (g.xMin + g.xMax) / 2, g

def comp(name, x, y):
    c = GlyphComponent(); c.glyphName = name; c.x = round(x); c.y = round(y); c.flags = 0x4  # ROUND_XY_TO_GRID
    return c

# (new glyph, codepoint, base, accent)
NEW = [
    ('Aogonek', 0x104, 'A', 'ogonek'), ('aogonek', 0x105, 'a', 'ogonek'),
    ('Cacute', 0x106, 'C', 'acute'), ('cacute', 0x107, 'c', 'acute'),
    ('Eogonek', 0x118, 'E', 'ogonek'), ('eogonek', 0x119, 'e', 'ogonek'),
    ('Nacute', 0x143, 'N', 'acute'), ('nacute', 0x144, 'n', 'acute'),
    ('Sacute', 0x15A, 'S', 'acute'), ('sacute', 0x15B, 's', 'acute'),
    ('Zacute', 0x179, 'Z', 'acute'), ('zacute', 0x17A, 'z', 'acute'),
    ('Zdotaccent', 0x17B, 'Z', 'dotaccent'), ('zdotaccent', 0x17C, 'z', 'dotaccent'),
]
# Offsets read off the font's own Oacute/oacute/Eacute: the acute sits 90 units right of
# centre (it slants), 328 up over capitals and about 200 over lower case.
ACUTE_UP = {True: 328, False: 200}
order = f.getGlyphOrder()
for name, cp, base, acc in NEW:
    if name in glyf: continue
    upper = base.isupper()
    bc, bg = centre(base)
    ac, ag = centre(acc)
    if acc == 'acute':
        dx, dy = bc - ac + 90, ACUTE_UP[upper]
    elif acc == 'dotaccent':
        # Bottom of the dot where the acute's bottom lands.
        dy = (glyf['acute'].yMin + ACUTE_UP[upper]) - ag.yMin + (0 if upper else 10)
        dx = bc - ac + 40
    else:  # ogonek: hangs from the right foot, its top just over the baseline
        dx = (bg.xMax - (95 if upper else 80)) - ac
        dy = -10
    g = Glyph(); g.numberOfContours = -1
    g.components = [comp(base, 0, 0), comp(acc, dx, dy)]
    glyf[name] = g
    hmtx[name] = hmtx[base]
    for t in cmap.tables:
        if t.isUnicode(): t.cmap[cp] = name
f.setGlyphOrder(glyf.glyphOrder)
for n, *_ in NEW: glyf[n].recalcBounds(glyf)

# Kerning: each new letter kerns like its base.
if 'kern' in f:
    for st in f['kern'].kernTables:
        pairs = st.kernTable
        add = {}
        for (l, r), v in pairs.items():
            for n, _, base, _ in NEW:
                if l == base: add[(n, r)] = v
                if r == base: add[(l, n)] = v
        for (l, r), v in list(add.items()):
            for n, _, base, _ in NEW:
                if r == base: add[(l, n)] = v
        pairs.update(add)

f['maxp'].recalc(f)
names = f['name']
for rec in names.names:
    if rec.nameID == 5:
        rec.string = str(rec.toUnicode()) + '; Polish letters added for PROtestkit.eu'
f.flavor = 'woff2'
f.save(out)
print('ok', len(NEW), 'glyphs added')
