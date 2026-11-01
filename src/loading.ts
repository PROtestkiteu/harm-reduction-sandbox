/**
 * The page's entry: the loading screen (the PROtestkit logo and an absurd
 * little phrase that changes every moment), then the game itself, loaded as
 * its own chunk. So the phrases turn while the game downloads, which on a
 * slow connection takes a while. Stops itself once the loading screen is gone.
 */
// The stylesheet comes with this first, tiny script, so the loading screen is styled (and themed) at once.
import './style.css';
import { LANG, loadCatalogue } from './i18n';

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
