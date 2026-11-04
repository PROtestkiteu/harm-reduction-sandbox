import dutchFlag from '../assets/scenario-flags/nl.svg';
import portugueseFlag from '../assets/scenario-flags/pt.svg';
import polishFlag from '../assets/scenario-flags/pl.svg';
import colombianFlag from '../assets/scenario-flags/co.svg';
import americanFlag from '../assets/scenario-flags/us.svg';

/** Local vectors keep the national scenarios crisp without raster downloads or emoji fallback. */
const FLAGS: Readonly<Record<string, string>> = {
  netherlands: dutchFlag, portugal: portugueseFlag, poland: polishFlag, us: americanFlag, colombia: colombianFlag,
};
const SYMBOLS: Readonly<Record<string, string>> = {
  tutorial: '<path d="M48 38h24c10 0 16 5 16 11v43c-5-5-10-7-18-7H48zM128 38h-24c-10 0-16 5-16 11v43c5-5 10-7 18-7h24z"/>',
  first: '<path d="M48 94V55l40-29 40 29v39M39 58l49-36 49 36M75 94V69h26v25"/><path d="M56 55h9m46 0h9"/>',
  sandbox: '<circle cx="88" cy="62" r="35"/><ellipse cx="88" cy="62" rx="16" ry="35"/><path d="M53 62h70M60 43h56M60 81h56"/>',
};

export function scenarioIllustration(id: string): string {
  if (FLAGS[id]) return FLAGS[id];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="32 8 112 104"><g fill="none" stroke="#b79c62" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${SYMBOLS[id] ?? SYMBOLS.sandbox}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
