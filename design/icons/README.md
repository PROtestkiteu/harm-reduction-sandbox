# Game icon

Design sources for the game icon. This folder is not served or bundled; the
shipped files live in `public/` (`favicon.svg`, `favicon-16.png`,
`favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`).

All icons letter "HR" in Permanent Marker (Font Diner, Apache License 2.0,
see `src/fonts/PermanentMarker-LICENSE.txt`), converted to outlines so the SVGs
render without the font. The accent is the PROtestkit gold `#edb300`.

In use:

- `hr-dusk-gold.svg`: gold letters with a dark offset shadow and a cream
  underline over the dusk sky and a lit skyline. Source of the favicon and
  the 192 and 512 px app icons.
- `hr-dusk-gold-square.svg`: the same without rounded corners, for
  `apple-touch-icon.png` (iOS rounds the corners itself).

Backup options:

- `hr-cream-gold-underline.svg`: cream letters, gold underline, night skyline.
- `hr-gold-night-moon.svg`: gold letters, cream underline, crescent moon.
- `hr-gold-glow.svg`: glowing gold letters over a dark skyline.
- `hr-gold-card-ink-skyline.svg`: ink letters and skyline on a gold tile.
- `hr-cream-gold-shadow.svg`: cream letters with an offset gold shadow.

To export PNGs from a source, render the SVG at the target size with a
transparent background (for example headless Chrome with
`--default-background-color=00000000`), using the square variant for the
Apple touch icon.
