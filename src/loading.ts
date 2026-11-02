/**
 * The page's entry: the loading screen (the game's HR mark over a dusk skyline
 * and an absurd little phrase that changes every moment), then the game itself, loaded as
 * its own chunk. So the phrases turn while the game downloads, which on a
 * slow connection takes a while. Stops itself once the loading screen is gone.
 */
// The stylesheet comes with this first, tiny script, so the loading screen is styled (and themed) at once.
import './style.css';
import { LANG, loadCatalogue } from './i18n';
import skylineSvg from './assets/loading-skyline.svg?raw';

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

const ES = [
  'Enseñando a las palomas a leer el horario',
  'Echando hormigón para los charcos de mañana',
  'Desenredando los cables del tranvía',
  'Contando las farolas dos veces, por si acaso',
  'Convenciendo al río de que baje',
  'Doblando la noche en cuadrados',
  'Dando a la luna un permiso de aparcamiento',
  'Planchando los pasos de cebra',
  'Calentando el neón del kebab',
  'Negociando con una grúa muy cansada',
  'Reticulando los callejones',
  'Preguntando a las alcantarillas qué han visto',
  'Inflando la colina',
  'Regando las plantas de plástico',
  'Sobornando a la torre del reloj con galletas',
  'Enseñando a los tranvías a hacer cola',
];
const PT = [
  'A ensinar os pombos a ler o horário',
  'A deitar betão para as poças de amanhã',
  'A desenredar os fios do elétrico',
  'A contar os candeeiros duas vezes, por via das dúvidas',
  'A convencer o rio a correr para baixo',
  'A dobrar a noite em quadrados',
  'A dar à lua uma licença de estacionamento',
  'A passar a ferro as passadeiras',
  'A aquecer o néon do kebab',
  'A negociar com uma grua muito cansada',
  'A reticular os becos',
  'A perguntar aos esgotos o que viram',
  'A encher a colina',
  'A regar as plantas de plástico',
  'A subornar a torre do relógio com bolachas',
  'A ensinar os elétricos a fazer fila',
];

const line = document.querySelector<HTMLElement>('#loading .loading-line');
if (line) {
  const phrases = { en: EN, pl: PL, es: ES, pt: PT }[LANG];
  let i = Math.floor(Math.random() * phrases.length);
  const show = () => { line.textContent = `${phrases[i % phrases.length]}…`; i++; };
  show();
  const timer = window.setInterval(() => {
    if (!document.getElementById('loading')) { clearInterval(timer); return; }
    show();
  }, 1400);
}

/**
 * The skyline's windows switching on and off, a few at a time at random moments, for as long as the
 * loading screen is up. The skyline itself is the screen's background (styled before any script
 * runs); this lays a layer of lit windows over the same tiles. A change only swaps a few attributes
 * now and then, so nothing is redrawn between changes and the download never waits on it. Under
 * reduced motion a window changes only every few seconds. Stops once the loading screen is gone.
 */
function lightWindows(screen: HTMLElement): void {
  const TILE = 960;
  const HEIGHT = 240;
  const windows = [...skylineSvg.matchAll(/<g class="w[^"]*">(.*?)<\/g>/gs)].flatMap((g) =>
    [...g[1].matchAll(/<rect x="([\d.]+)" y="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const));
  if (!windows.length) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'loading-lights');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'xMinYMax meet');
  screen.append(svg);
  let lit: SVGRectElement[] = [];
  // As many tiles as the background repeats across the screen's width, each with its own windows.
  const layout = () => {
    const h = svg.clientHeight;
    if (!h) return;
    const width = (screen.clientWidth / h) * HEIGHT;
    const tiles = Math.ceil(width / TILE);
    svg.setAttribute('viewBox', `0 0 ${width} ${HEIGHT}`);
    if (lit.length === tiles * windows.length) return;
    lit = [];
    const frag = document.createDocumentFragment();
    for (let t = 0; t < tiles; t++) for (const [x, y] of windows) {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(x + t * TILE));
      r.setAttribute('y', String(y));
      r.setAttribute('width', '5');
      r.setAttribute('height', '7');
      if (Math.random() < 0.4) r.setAttribute('class', 'on');
      lit.push(r);
      frag.append(r);
    }
    svg.replaceChildren(frag);
  };
  layout();
  const resized = new ResizeObserver(layout);
  resized.observe(screen);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const tick = () => {
    if (!screen.isConnected) { resized.disconnect(); return; }
    // One to three windows each time, anywhere along the skyline; about as many go out as come on.
    for (let n = 1 + Math.floor(Math.random() * (still.matches ? 1 : 3)); n > 0 && lit.length; n--) lit[Math.floor(Math.random() * lit.length)].classList.toggle('on');
    window.setTimeout(tick, still.matches ? 3000 : 70 + Math.random() * 180);
  };
  window.setTimeout(tick, 200);
}
const screen = document.getElementById('loading');
if (screen) lightWindows(screen);

// Safari on iPhone ignores user-scalable=no: its own pinch gesture events are cancelled, so a pinch on the
// panel cannot zoom the page (the scene handles its own pinch through pointer events).
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

// The offline worker (built as sw.js, see vite.config.ts): an installed game starts without the
// network, and on a slow one without waiting for it. Registered once the page has loaded, so it
// never competes with the game's own first download; not in development.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI), { scope: './' }).catch(() => { /* not allowed here: the game plays online */ });
  });
}

// The game: its own chunk, fetched once the language's text is in (t() reads it as modules load).
void loadCatalogue().catch(() => { /* offline mid-load: English */ }).then(() => import('./main'));
