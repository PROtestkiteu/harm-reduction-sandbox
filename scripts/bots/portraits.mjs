// Canonical portrait regression: real browser decoding, cancellation and selection.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';

const base = process.argv[2] ?? 'http://localhost:5199/';
assert.ok((await fetch(base)).ok, 'Portrait regression needs a running dev server');
const out = process.argv[3] ?? '/tmp/hrp-portrait-qa';
mkdirSync(out, { recursive: true });
const check = async () => {
  const { PortraitLibrary, portraitId, portraitUrl, playerPortraitUrl, setPlayerPortrait, COORDINATOR_IDS } = await import('/src/render/portraitLibrary.ts');
  const ok = (condition, message) => { if (!condition) throw new Error(message); };
  const wait = async (f, attempts = 200) => { for (let n = 0; n < attempts; n++) { if (f()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error('Portrait timeout'); };
  await wait(() => !!window.__sandbox, 6000);
  const ids = ['coordinator','everyday','raver','tourist','worker','office','student','older','unhoused','techno-black','punk','goth','hiphop','queer-rave','metal','outreach','police','seller','cleaner','bouncer'];
  for (const id of ids) {
    const res = await fetch(portraitUrl(id));
    ok(res.ok, `Missing asset: ${id}`);
    const b = await createImageBitmap(await res.blob());
    ok(b.width === 480 && b.height === 600, `Wrong dimensions: ${id}`);
    b.close();
  }
  setPlayerPortrait('nobody');
  ok(playerPortraitUrl().endsWith('coordinator.webp') && COORDINATOR_IDS.includes('coordinator'), 'Coordinator choice ignores unknown ids');
  ok(portraitId({ role: 'staff', archetype: 'punk' }) === 'outreach', 'Staff matching');
  ok(portraitId({ role: 'passerby', archetype: 'punk' }) === 'punk', 'Style matching');
  ok(portraitId({ role: 'visitor', archetype: 'goth' }) === 'goth', 'Visitors retain clothing group');
  const canvas = Object.assign(document.createElement('canvas'), { width: 240, height: 300 });
  const library = new PortraitLibrary(canvas);
  const fetchOriginal = window.fetch;
  const pending = new Map();
  const blob = await (await fetchOriginal(playerPortraitUrl())).blob();
  try {
    // Deliberately ignore abort in this transport: late completions must still be rejected.
    window.fetch = (url) => new Promise(resolve => pending.set(url, resolve));
    library.show('/old'); library.show('/new');
    pending.get('/new')(new Response(blob));
    await wait(() => canvas.dataset.state === 'ready');
    pending.get('/old')(new Response(blob));
    await new Promise(r => setTimeout(r, 100));
    ok(canvas.dataset.asset === '/new', 'Stale portrait replaced newer selection');
    library.show('/missing');
    pending.get('/missing')(new Response('', { status: 404 }));
    await wait(() => canvas.dataset.state === 'error');
    ok(!canvas.dataset.asset, 'Failure retained previous face');
    library.show('/cancelled'); library.show(null);
    pending.get('/cancelled')(new Response(blob));
    await new Promise(r => setTimeout(r, 100));
    ok(canvas.dataset.state === 'idle' && !canvas.dataset.asset, 'Cleared selection repainted');
  } finally { window.fetch = fetchOriginal; }
  library.show(playerPortraitUrl());
  await wait(() => canvas.dataset.state === 'ready');
  ok(canvas.getAttribute('aria-busy') === 'false', 'Busy state stuck');
  library.show(null); library.show(playerPortraitUrl());
  ok(canvas.dataset.state === 'ready', 'Cached portrait not immediate');
  library.dispose();
  ok(canvas.dataset.state === 'idle', 'Disposal failed');
  const X = window.__sandbox;
  X.interaction.select(null);
  await wait(() => document.querySelector('.portrait-view').dataset.state === 'ready');
  ok(document.querySelector('.portrait-view').dataset.asset.endsWith('coordinator.webp'), 'Player portrait integration');
  let p;
  for (let id = 1; id < 1000 && !p; id++) p = X.crowd.person(id);
  ok(p, 'No selectable person');
  X.interaction.select({ kind: 'person', id: p.id });
  await wait(() => document.querySelector('.portrait-view').dataset.asset?.endsWith(`${portraitId(p)}.webp`));
  X.interaction.select({ kind: 'location', id: 'dropIn' });
  await wait(() => document.querySelector('.portrait').hidden);
  X.interaction.select(null);
  await wait(() => document.querySelector('.portrait-view').dataset.asset?.endsWith('coordinator.webp'));
  X.interaction.select({ kind: 'person', id: p.id });
  await wait(() => document.querySelector('.portrait-view').dataset.asset?.endsWith(`${portraitId(p)}.webp`));
  return JSON.stringify({ assets: ids.length, cancellation: true, staleResponse: true, recovery: true, cache: true, selection: true });
};
const results = await drive(base, [
  ...SKIP_WELCOME,
  { eval: `(${check.toString()})().catch(e => JSON.stringify({ error: e.stack ?? String(e) }))` },
  { shot: 'portraits-desktop.png' },
], { out, seed: 777, size: process.argv[4] ?? '1280x800' });
const raw = results.at(-1);
assert.equal(typeof raw, 'string', `Browser returned no check result: ${JSON.stringify(raw)}`);
const result = JSON.parse(raw);
assert.equal(result.assets, 20, JSON.stringify(result));
console.log(JSON.stringify(result));
