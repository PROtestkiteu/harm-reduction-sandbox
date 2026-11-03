import { LOCALE } from '../i18n';

/**
 * A gold coin: the large yellow circle emoji (Unicode 12), drawn as a shiny gold disc on every system
 * (the coin emoji itself is silver on Apple's), where the device draws it in colour; a plain dot where
 * it would come out as an empty box. Checked once, by drawing it on a tiny canvas. The page is told
 * which, so the money in the top bar wears the same mark.
 */
function coinMark(): string {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (g) {
      g.textBaseline = 'top';
      g.font = '14px sans-serif';
      g.fillText('\u{1F7E1}', 0, 0);
      const d = g.getImageData(0, 0, 16, 16).data;
      // A colour glyph has pixels that are not grey; a missing one draws a grey or black box, or nothing.
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && (Math.abs(d[i] - d[i + 2]) > 30)) {
        document.documentElement.dataset.coin = 'gold';
        return '\u{1F7E1}';
      }
    }
  } catch { /* no canvas: the dot */ }
  return '●';
}

/** The mark the money display uses; every price shows it, so money always reads the same. */
export const COIN = coinMark();

/** A price or an amount of money: the coin mark and a rounded number. */
export const price = (n: number): string => `${COIN} ${Math.round(n).toLocaleString(LOCALE)}`;
