// Persistent selection identity, asynchronous face fallback and independent detail placement.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const out = '/tmp/hrs-selection-portrait';
mkdirSync(out, { recursive: true });
const bounds = `(() => {
  const portrait = document.querySelector('.portrait');
  const r = portrait.getBoundingClientRect();
  const panel = document.getElementById('selection-details');
  const p = panel.getBoundingClientRect();
  if (portrait.hidden || r.width < 44 || r.height < 44 || r.left < 0 || r.bottom > innerHeight + 1) throw Error('Portrait bounds');
  if (r.left > 32 || innerHeight - r.bottom > 50) throw Error('Portrait left its bottom-left anchor');
  const management = document.querySelector('.column').getBoundingClientRect();
  if (r.left < management.right && r.right > management.left && r.top < management.bottom && r.bottom > management.top) throw Error('Management overlaps portrait');
  if (!panel.hidden && panel.dataset.collapsed !== 'true' && panel.dataset.subject === 'true') {
    if (p.left < management.right && p.right > management.left && p.top < management.bottom && p.bottom > management.top) throw Error('Management overlaps selection details');
    if (p.left > 32 || p.top < 0 || p.bottom > r.top || p.right > innerWidth) throw Error('Detail bounds or portrait overlap: '+JSON.stringify({p:p.toJSON(),r:r.toJSON()}));
  }
  return { kind: portrait.dataset.who, portrait: r.toJSON(), panel: p.toJSON() };
})()`;
const steps = [...SKIP_WELCOME,
  { cdp: 'Emulation.setFocusEmulationEnabled', params: { enabled: true } },
  { eval: `window.__sandbox.interaction.selectLocation('outreach');true` }, { wait: 1100 }, { eval: bounds },
  { eval: `(()=>{const b=document.querySelector('.portrait');if(b.dataset.who!=='location'||!b.querySelector('.portrait-object:not([hidden])'))throw Error('Venue portrait missing');b.click();if(window.__sandbox.hud.isSelectionOpen)throw Error('Close failed');if(!b.getClientRects().length)throw Error('Closed details hid portrait');b.click();if(!window.__sandbox.hud.isSelectionOpen)throw Error('Reopen failed');return true})()` },
  { shot: 'desktop-venue.png' },
  { eval: `window.__sandbox.interaction.select({kind:'building',id:window.__sandbox.world.camps.park});true` }, { wait: 1100 }, { eval: bounds },
  { eval: `(()=>{if(document.querySelector('.portrait').dataset.who!=='building')throw Error('Building portrait missing');const s=window.__sandbox;s.hud.setServicesOpen(true);if(!s.hud.isSelectionOpen)throw Error('Services closed selection');document.querySelector('.portrait').click();if(s.hud.isSelectionOpen||document.getElementById('services-management').hidden)throw Error('Portrait closed management');document.querySelector('.portrait').click();if(!s.hud.isSelectionOpen)throw Error('Selection did not reopen');return true})()` },
  { cdp: 'Network.enable', params: {} },
  { cdp: 'Network.setBlockedURLs', params: { urls: ['*portraits/dusk-v3/*'] } },
  { eval: `(()=>{const s=window.__sandbox;let p;s.crowd.forEachVisible(x=>{p??=x});if(!p)throw Error('No person');s.interaction.select({kind:'person',id:p.id});return true})()` }, { wait: 1200 }, { eval: bounds },
  { eval: `(()=>{const b=document.querySelector('.portrait');if(b.dataset.who!=='person'||!b.getClientRects().length)throw Error('Face failure hid shortcut');return true})()` },
  { cdp: 'Emulation.setDeviceMetricsOverride', params: { width: 393, height: 852, deviceScaleFactor: 1, mobile: true } }, { wait: 300 }, { eval: bounds }, { shot: 'phone-person.png' },
  { eval: `(()=>{const r=document.querySelector('.portrait').getBoundingClientRect();window.portraitPoint={x:r.left+r.width/2,y:r.top+r.height/2};return true})()` },
  { cdp: 'Input.dispatchTouchEvent', paramsEval: `({type:'touchStart',touchPoints:[window.portraitPoint]})` },
  { cdp: 'Input.dispatchTouchEvent', params: { type: 'touchEnd', touchPoints: [] } }, { wait: 100 },
  { eval: `if(window.__sandbox.hud.isSelectionOpen)throw Error('Touch close failed');true` },
  { eval: `(()=>{const s=window.__sandbox;s.interaction.selectLocation('club');s.interaction.select(null);s.interaction.selectLocation('dropIn');return true})()` }, { wait: 1200 }, { eval: bounds },
  { cdp: 'Emulation.setDeviceMetricsOverride', params: { width: 320, height: 568, deviceScaleFactor: 1, mobile: true } }, { wait: 300 }, { eval: bounds }, { shot: 'small-phone-venue.png' },
  { eval: `(()=>{const heading=document.querySelector('.selection-heading');heading.focus();heading.click();if(document.activeElement!==document.querySelector('.portrait'))throw Error('Fold focus return failed');return true})()` },
  { cdp: 'Input.dispatchKeyEvent', params: { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 } },
  { eval: `if(!window.__sandbox.hud.isSelectionOpen)throw Error('Keyboard reopen failed');true` },
  { cdp: 'Emulation.setDeviceMetricsOverride', params: { width: 852, height: 393, deviceScaleFactor: 1, mobile: true } }, { wait: 300 }, { eval: bounds }, { shot: 'landscape-venue.png' },
  { eval: `(()=>{const s=window.__sandbox;const vehicle=s.world.vehicles()[0];if(!vehicle)throw Error('No vehicle');s.interaction.select({kind:'vehicle',id:vehicle.id});return true})()` }, { wait: 1100 }, { eval: bounds },
  { eval: `if(document.querySelector('.portrait').dataset.who!=='vehicle')throw Error('Vehicle portrait missing');if(window.__qaErrors.length)throw Error(window.__qaErrors.join(';'));true` },
];
const results = await drive(process.argv[2] ?? 'http://127.0.0.1:5217/?packs=none&quality=low', steps,
  { out, size: '1440x900', touch: true, diagnostics: true, log: () => {} });
assert(results.every(Boolean));
console.log('Selection portraits: venue, building, person, vehicle, face failure, rapid replacement, touch, detail reopening, desktop/mobile/landscape bounds passed');
console.log(JSON.stringify(results.filter(x=>x?.kind), null, 2));
