# Permanent Marker, with Polish letters

`PermanentMarker-PL.woff2` is Permanent Marker by Font Diner (Apache License 2.0,
see `PermanentMarker-LICENSE.txt`), taken from github.com/google/fonts.

Changed for this game: 14 glyphs added (Ą ą Ć ć Ę ę Ń ń Ś ś Ź ź Ż ż), each built
from the font's own base letter and accent (acute, dot above, ogonek), with the
base letter's kerning. Nothing else in the font was altered. Rebuild with:

    pip install fonttools brotli
    python scripts/build-marker-pl.py PermanentMarker-Regular.ttf src/fonts/PermanentMarker-PL.woff2
