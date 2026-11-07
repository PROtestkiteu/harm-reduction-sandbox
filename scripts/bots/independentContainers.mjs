import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const out = '/tmp/hrs-independent-containers';
mkdirSync(out, { recursive: true });
const both = `(() => {
  const s = window.__sandbox;
  const left = document.getElementById('selection-details');
  const right = document.getElementById('services-management');
  if (!s.hud.isSelectionOpen || !left.getClientRects().length || right.hidden || !right.getClientRects().length) throw Error('Both containers must remain open');
  if (document.querySelector('.services-toggle')?.getAttribute('aria-expanded') === 'false') throw Error('Management disclosure mismatch');
  if (right.querySelectorAll('.svc-row').length !== 7) throw Error('Management lost service rows');
  if (![...left.querySelectorAll('.options > li')].some(x=>!x.hidden&&x.getClientRects().length)) throw Error('Selected actions disappeared');
  const l=left.getBoundingClientRect(),r=right.getBoundingClientRect();
  if(l.left<r.right&&l.right>r.left&&l.top<r.bottom&&l.bottom>r.top) throw Error('Containers overlap');
  if(l.top<0||l.bottom>innerHeight||r.top<0||r.bottom>innerHeight) throw Error('Container outside viewport');
  return true;
})()`;
const results = await drive(process.argv[2] ?? 'http://127.0.0.1:5217/?packs=none&quality=low', [
  ...SKIP_WELCOME,
  { eval: `window.__sandbox.interaction.selectLocation('dropIn');document.querySelector('.service-module-toggle').click();true` }, { wait: 1100 }, { eval: both }, { shot: 'desktop-both.png' },
  { eval: `(()=>{const s=window.__sandbox;s.hud.setFolded(true);if(document.getElementById('services-management').hidden)throw Error('Folding left closed right');document.querySelector('.portrait').click();if(!s.hud.isSelectionOpen)throw Error('Portrait did not reopen left');s.hud.setServicesOpen(false);if(!s.hud.isSelectionOpen)throw Error('Closing right closed left');s.hud.setServicesOpen(true);return true})()` }, { eval: both },
  { eval: `(()=>{const right=document.getElementById('services-management');right.querySelector('[data-tutorial-service="clubHr"] .opt').click();return true})()` }, { wait: 1100 }, { eval: both },
  { eval: `(()=>{const right=document.querySelector('#services-management [data-tutorial-service="clubHr"] [role="switch"]');const left=document.querySelector('#selection-details [data-tutorial-service="clubHr"] [role="switch"]');if(!left||left.getAttribute('aria-checked')!==right.getAttribute('aria-checked'))throw Error('Switch state mismatch');return true})()` },
  { eval: `(()=>{let p;window.__sandbox.crowd.forEachVisible(x=>{p??=x});window.__sandbox.interaction.select({kind:'person',id:p.id});return true})()` }, { wait: 1100 }, { eval: both },
  { cdp: 'Emulation.setDeviceMetricsOverride', params: { width: 393, height: 852, deviceScaleFactor: 1, mobile: true } }, { wait: 400 }, { eval: both }, { shot: 'phone-both.png' },
  { cdp: 'Emulation.setDeviceMetricsOverride', params: { width: 320, height: 568, deviceScaleFactor: 1, mobile: true } }, { wait: 400 }, { eval: both }, { shot: 'small-phone-both.png' },
  { cdp: 'Emulation.setDeviceMetricsOverride', params: { width: 852, height: 393, deviceScaleFactor: 1, mobile: true } }, { wait: 400 }, { eval: both }, { shot: 'landscape-both.png' },
  { eval: `if(window.__qaErrors.length)throw Error(window.__qaErrors.join(';'));true` },
], { out, size: '1440x900', diagnostics: true, log: () => {} });
assert(results.every(Boolean));
console.log('Independent selection and Services containers: simultaneous visibility, independent folding, service/person selection, synchronized switches, four viewport bounds and runtime errors passed');
