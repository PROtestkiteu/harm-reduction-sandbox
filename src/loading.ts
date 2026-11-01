/**
 * The page's entry: the loading screen (the PROtestkit logo and an absurd
 * little phrase that changes every moment), then the game itself, loaded as
 * its own chunk. So the phrases turn while the game downloads, which on a
 * slow connection takes a while. Stops itself once the loading screen is gone.
 */
// The stylesheet comes with this first, tiny script, so the loading screen is styled (and themed) at once.
import './style.css';

const EN = [
  'Teaching pigeons to read the timetable',
  'Pouring concrete for tomorrow’s puddles',
  'Untangling the tram wires',
  'Counting the streetlights twice, to be sure',
  'Persuading the river to flow downhill',
  'Folding the night into neat squares',
  'Giving the moon a parking permit',
  'Ironing the zebra crossings',
  'Warming up the kebab shop’s neon',
  'Negotiating with a very tired crane',
  'Reticulating the back alleys',
  'Asking the drains what they have seen',
  'Inflating the hill',
  'Watering the plastic plants',
  'Bribing the clock tower with biscuits',
  'Teaching the trams to queue',
];
const PL = [
  'Uczymy gołębie czytać rozkład jazdy',
  'Wylewamy beton pod jutrzejsze kałuże',
  'Rozplątujemy trakcję tramwajową',
  'Liczymy latarnie drugi raz, na wszelki wypadek',
  'Namawiamy rzekę, żeby płynęła w dół',
  'Składamy noc w równą kostkę',
  'Wydajemy księżycowi abonament parkingowy',
  'Prasujemy przejścia dla pieszych',
  'Rozgrzewamy neon w budce z kebabem',
  'Negocjujemy z bardzo zmęczonym dźwigiem',
  'Siatkujemy podwórka',
  'Pytamy studzienki, co widziały',
  'Pompujemy wzgórze',
  'Podlewamy plastikowe kwiatki',
  'Przekupujemy wieżę zegarową herbatnikami',
  'Uczymy tramwaje stać w kolejce',
];

function lang(): 'pl' | 'en' {
  const forced = new URLSearchParams(location.search).get('lang');
  if (forced) return forced.toLowerCase().startsWith('pl') ? 'pl' : 'en';
  return (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

const line = document.querySelector<HTMLElement>('#loading .loading-line');
if (line) {
  const phrases = lang() === 'pl' ? PL : EN;
  let i = Math.floor(Math.random() * phrases.length);
  const show = () => { line.textContent = `${phrases[i % phrases.length]}…`; i++; };
  show();
  const timer = window.setInterval(() => {
    if (!document.getElementById('loading')) { clearInterval(timer); return; }
    show();
  }, 1400);
}

// The game: its own chunk, fetched now.
void import('./main');
