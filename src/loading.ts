/**
 * The page's entry: the loading screen (the game's HR mark over a dusk skyline
 * and an absurd little phrase that changes every moment), then the game itself, loaded as
 * its own chunk. So the phrases turn while the game downloads, which on a
 * slow connection takes a while. Stops itself once the loading screen is gone.
 */
// The stylesheet comes with this first, tiny script, so the loading screen is styled (and themed) at once.
import './style.css';
import { LANG, loadCatalogue } from './i18n';
import { loadCompat } from './compat';
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
    if (!line.isConnected) { clearInterval(timer); return; }
    show();
  }, 1400);
}

/**
 * The skyline's windows switching on and off for as long as the loading screen is up, from its first
 * frames. The skyline itself is the screen's background (styled before any script runs). Over it lie
 * a few layers of lit windows, the windows dealt among them at random, each layer the skyline's own
 * tile (same size, fit and tiling, so a lit window always sits on its drawn one), and each blinks on and off by a CSS
 * animation of its opacity at its own pace and phase. Opacity animations of their own layers run in
 * the compositor, so they keep going while the game's start-up holds the main thread; nothing here
 * runs again after this. Under reduced motion they stand still, about half of them lit. They go with
 * the loading screen.
 */
function lightWindows(screen: HTMLElement): void {
  const TILE = 960;
  const HEIGHT = 240;
  const LAYERS = 14;
  const windows = [...skylineSvg.matchAll(/<g class="w[^"]*">(.*?)<\/g>/gs)].flatMap((g) =>
    [...g[1].matchAll(/<rect x="([\d.]+)" y="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const));
  if (!windows.length) return;
  const rects: string[][] = Array.from({ length: LAYERS }, () => []);
  for (const [x, y] of windows) {
    // About two in five windows take part; the rest stay dim, as in a real block at night.
    if (Math.random() > 0.4) continue;
    rects[Math.floor(Math.random() * LAYERS)].push(`<rect x="${x}" y="${y}" width="5" height="7"/>`);
  }
  const frag = document.createDocumentFragment();
  rects.forEach((list, i) => {
    if (!list.length) return;
    // The skyline's own tile: the same box, size and fit, so the browser lays both out and rounds them alike.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${HEIGHT}" width="${TILE}" height="${HEIGHT}" preserveAspectRatio="xMidYMax slice"><g fill="#edb300" fill-opacity="0.85">${list.join('')}</g></svg>`;
    const layer = document.createElement('div');
    layer.className = 'loading-lit';
    layer.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    // Each its own pace (2.5 to 8 s) and phase, so windows come and go all along the skyline.
    layer.style.animationDuration = `${(2.5 + Math.random() * 5.5).toFixed(2)}s`;
    layer.style.animationDelay = `${(-Math.random() * 8).toFixed(2)}s`;
    if (i % 2) layer.dataset.still = 'on';
    frag.append(layer);
  });
  screen.append(frag);
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

/**
 * What the loading screen says when the game cannot start: the game's chunk failed to download, to
 * parse (a browser older than the build supports) or to run (no WebGL 2). Written here, not in the
 * catalogue, because the catalogue may be what failed. The screen never hangs on its phrases.
 */
const FAILED = {
  en: { title: 'The game could not start.', webgl: 'This browser has no WebGL 2, which the game needs to draw the city.', hint: 'Check the connection and try again. If it keeps happening, updating the browser or the system may help.', retry: 'Try again' },
  pl: { title: 'Nie udało się uruchomić gry.', webgl: 'Ta przeglądarka nie ma WebGL 2, którego gra potrzebuje do rysowania miasta.', hint: 'Sprawdź połączenie i spróbuj ponownie. Jeśli to się powtarza, pomóc może aktualizacja przeglądarki lub systemu.', retry: 'Spróbuj ponownie' },
  es: { title: 'No se pudo iniciar el juego.', webgl: 'Este navegador no tiene WebGL 2, que el juego necesita para dibujar la ciudad.', hint: 'Comprueba la conexión y vuelve a intentarlo. Si sigue pasando, actualizar el navegador o el sistema puede ayudar.', retry: 'Reintentar' },
  pt: { title: 'Não foi possível iniciar o jogo.', webgl: 'Este navegador não tem WebGL 2, de que o jogo precisa para desenhar a cidade.', hint: 'Verifique a ligação e tente de novo. Se continuar a acontecer, atualizar o navegador ou o sistema pode ajudar.', retry: 'Tentar de novo' },
}[LANG];

function showStartFailure(error: unknown): void {
  const box = document.getElementById('loading');
  if (!box) return;
  // The phrases stop (their line is replaced) and the screen becomes an alert.
  box.classList.add('loading-failed');
  box.setAttribute('role', 'alert');
  const noWebgl = typeof WebGL2RenderingContext === 'undefined';
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const msg = document.createElement('div');
  msg.className = 'loading-error';
  const title = document.createElement('p');
  title.className = 'loading-error-title';
  title.textContent = FAILED.title;
  const why = document.createElement('p');
  why.textContent = noWebgl ? FAILED.webgl : FAILED.hint;
  const code = document.createElement('code');
  code.textContent = detail.slice(0, 240);
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'loading-retry';
  retry.textContent = FAILED.retry;
  retry.addEventListener('click', () => location.reload());
  msg.append(title, why, code, retry);
  box.querySelector('.loading-line')?.replaceWith(msg);
  retry.focus();
  console.error('Game start failed', error);
}

// The game: its own chunk, fetched once the language's text is in (t() reads it as modules load) and
// any stand-ins this browser needs are installed (compat/: none on current browsers). A chunk that
// cannot load, parse or run rejects here; the loading screen then explains instead of hanging.
const text = loadCatalogue().catch(() => { /* offline mid-load: English */ });
void Promise.all([text, loadCompat()]).then(() => import('./main')).catch(showStartFailure);
