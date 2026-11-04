// Venue label rendering, narrow-screen layout and tap-accessible detail checks.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const out = join(tmpdir(), 'hrs-venue-status');
mkdirSync(out, { recursive: true });
const fixture = `(() => {
  const s = window.__sandbox;
  const snapshot = structuredClone(s.hud.lastSnapshot);
  const states = {
    dropIn: ['green', false, false, null],
    outreach: ['normal', true, false, 'route'],
    club: ['yellow', false, false, 'queue', 4],
    footPatrol: ['orange', true, false, 'staff'],
    drugChecking: ['red', true, false, 'lock'],
    shelter: ['muted', true, true, 'pause'],
    clinic: ['muted', true, false, 'pause'],
  };
  for (const [id, [tone, faded, crossed, indicator, count]] of Object.entries(states)) {
    snapshot.locations[id].venue = { tone, faded, crossed, indicator, count, message: id + ': fixture status' };
  }
  // Hold only the renderer's input stable; the real status derivation is tested in venueStatus.mjs.
  const update = s.hud.update.bind(s.hud);
  s.hud.update = () => update(snapshot);
  s.hud.update();
  return Object.fromEntries([...document.querySelectorAll('.loc-label')].map(label => {
    const name = label.querySelector('.loc-name'), css = getComputedStyle(name);
    return [label.dataset.location, { tone: label.dataset.tone, faded: label.dataset.faded,
      crossed: css.textDecorationLine.includes('line-through'), opacity: Number(css.opacity),
      icon: label.dataset.indicator, count: label.querySelector('.venue-cue-count').textContent,
      colour: css.color, visible: label.getClientRects().length > 0, minTarget: parseFloat(getComputedStyle(label).minHeight), target: label.getBoundingClientRect().height, accessible: label.getAttribute('aria-label') }];
  }));
})()`;
const inspect = `(() => ({
  overflow: document.documentElement.scrollWidth > innerWidth,
  dots: document.querySelectorAll('.loc-label .dot').length,
  mapBars: document.querySelectorAll('.loc-label progress, .loc-label .level-bar').length,
  labels: document.querySelectorAll('.loc-label').length,
  healthyIconHidden: document.querySelector('[data-location="dropIn"] .venue-cue').hidden,
  cardProgress: !document.querySelector('.venue-investment').hidden,
  explanation: document.querySelector('.venue-investment p').textContent,
}))()`;
const steps = [...SKIP_WELCOME, { eval: fixture },
  { eval: `window.__sandbox.interaction.selectLocation('dropIn'); 1` }, { wait: 200 },
  ...[[390, 844], [320, 740], [844, 390]].flatMap(([width, height]) => [
    { cdp: 'Emulation.setDeviceMetricsOverride', params: { width, height, deviceScaleFactor: 1, mobile: true } },
    { wait: 100 }, { eval: inspect }, { shot: `venue-${width}x${height}-dark.png` },
  ]),
  { cdp: 'Emulation.setEmulatedMedia', params: { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] } },
  { wait: 100 }, { eval: inspect }, { shot: 'venue-light.png' },
];
const results = await drive(process.argv[2] ?? 'http://localhost:5199/?packs=none', steps,
  { out, size: '390x844', settle: 1000, touch: true, colorScheme: 'dark', log: () => {} });
console.log(JSON.stringify(results, null, 2));
const states = results[1];
assert.equal(states.clinic.tone, 'muted'); assert(!states.clinic.crossed); assert(states.clinic.opacity < 1);
assert(states.shelter.crossed); assert(states.drugChecking.opacity < 1); assert.equal(states.club.count, '4');
assert.equal(new Set(Object.values(states).map(s => s.colour)).size, 6);
for (const s of Object.values(states)) { assert(s.minTarget >= 44); if (s.visible) assert(s.target >= 44); assert(s.accessible.includes('fixture status')); }
for (const r of results.filter(r => r && typeof r === 'object' && 'overflow' in r)) {
  assert(!r.overflow); assert.equal(r.dots, 0); assert.equal(r.mapBars, 0); assert.equal(r.labels, 7);
  assert(r.healthyIconHidden); assert(r.cardProgress); assert(r.explanation.includes('reserve'));
}
console.log('Venue label rendering, fading, six colours, queue count, accessible descriptions, detail progress and viewports passed');
