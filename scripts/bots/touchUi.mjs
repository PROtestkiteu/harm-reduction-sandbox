// Touch, compact-window and Fullscreen API regressions. Installed standalone needs physical-device validation.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, call } from './chrome.mjs';

const url = process.argv[2] ?? 'http://127.0.0.1:5202/?packs=none';
const out = process.argv[3] ?? '/tmp/hrs-touch-qa';
mkdirSync(out, { recursive: true });
const cases = [
  ['phone-small', 320, 568, 'browser', 4],
  ['phone-new', 393, 852, 'browser', 1],
  ['phone-landscape', 852, 393, 'fullscreen', 1],
  ['phone-old-landscape', 667, 375, 'browser', 4],
  ['tablet', 768, 1024, 'browser', 1],
  ['desktop', 1440, 900, 'browser', 1],
];
const inspect = `(() => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const click = (q) => { const e = document.querySelector(q); check(e, 'Missing ' + q); e.click(); return e; };
  const shown = (q) => { const e=document.querySelector(q); return e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; };
  const s = window.__sandbox;
  check(document.title === 'Harm Reduction Simulator', 'Wrong page');
  check(!document.querySelector('vite-error-overlay'), 'Vite overlay');
  check(!document.querySelector('.module-toggle'), 'Unexpected extra panel buttons');
  check(!document.querySelector('.configure-opt'), 'Settings must not occupy a separate reply');
  const settings=document.querySelector('.sandbox-toggle');
  if(matchMedia('(max-width:760px), (max-height:520px), (pointer:coarse)').matches) {
    check(settings.closest('.hud-header h1'), 'Settings icon must be beside the title');
    check(getComputedStyle(settings.querySelector('span')).display==='none','Mobile Settings must be icon only');
    const r=settings.getBoundingClientRect();
    check(r.width<=32&&r.height<=32,'Settings icon must remain compact');
    settings.click(); check(settings.getAttribute('aria-expanded')==='true','Settings opens');
    check(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('.sandbox-toggle')===settings,'Settings icon must remain reachable while open');
    settings.click(); check(settings.getAttribute('aria-expanded')==='false','Same Settings icon closes');
  }
  click('.layers-toggle');
  const residents = [...document.querySelectorAll('.action-menu button')].find(b => b.textContent.trim() === 'Residents');
  check(residents, 'Residents menu entry'); residents.click(); s.actionMenu.close(false);
  const legend=document.querySelector('.map-legend');
  check(!legend.hidden && legend.querySelector('.legend-heading').getAttribute('aria-expanded') === 'true', 'Legend opens');
  click('.legend-heading');
  check(legend.querySelector('.legend-heading').getAttribute('aria-expanded') === 'false' && document.querySelector('.layers-toggle').dataset.on === 'true', 'Legend fold preserves overlay');
  click('.legend-heading');
  check(legend.querySelector('.legend-heading').getAttribute('aria-expanded') === 'true' && shown('.map-legend ul'), 'Legend reopens');
  click('.goals-head'); click('.events-heading');
  s.interaction.selectLocation('dropIn');
  check(document.querySelector('.goals-head').getAttribute('aria-expanded') === 'true', 'Selection folded goals');
  check(document.querySelector('.events-heading').getAttribute('aria-expanded') === 'true', 'Goals and events must coexist');
  check(shown('.goals-strip') && shown('.events'), 'Overview hidden by selection');
  check(!document.querySelector('.sheet-handle'), 'Bottom sheet handle must be absent');
  click('.selection-heading');
  check(document.querySelector('.window').dataset.collapsed === 'true', 'Selection heading folds its module');
  check(shown('.goals-strip'), 'Folding selection must leave goals available');
  click('.selection-heading');
  check(document.querySelector('.window').dataset.collapsed === 'false', 'Selection heading reopens');
  const meter=document.querySelector('.stress[data-key="police"]');
  const hit=meter.getBoundingClientRect();
  check(document.elementFromPoint(hit.left+hit.width/2,hit.top+hit.height/2)?.closest('.stress')===meter,'Meter must receive actual touch input');
  meter.click(); check(shown('.meter-causes'), 'Meter hint opens on tap');
  meter.click(); check(!shown('.meter-causes'), 'Same meter closes its hint');
  meter.click();
  document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}));
  check(!shown('.meter-causes'), 'Outside tap closes a pinned meter hint');
  // No gesture is synthesized on the canvas here: the real drag follows over CDP.
  check(document.elementFromPoint(2,innerHeight/2)?.id==='scene','Map gesture must start on the actual canvas');
  window.__touchCamera=s.rig.focus.toArray();
  window.__touchZoom=s.rig.zoom;
  window.__touchSelection=JSON.stringify(s.interaction.selected);
  s.actionMenu.show(50,150,'QA',[{label:'Run',disabled:false,run:()=>window.__touchAction=(window.__touchAction||0)+1}]);
  click('.action-menu button'); check(window.__touchAction===1, 'Menu action must execute once');
  s.actionMenu.show(50,150,'QA',[{label:'Run',disabled:false,run:()=>{}}]);
  return {url:location.href,title:document.title,mode:matchMedia('(display-mode: fullscreen)').matches?'fullscreen':matchMedia('(display-mode: standalone)').matches?'standalone':'browser'};
})()`;
const verify = `(() => {
  const check=(v,m)=>{if(!v)throw new Error(m)};
  check(!window.__sandbox.actionMenu.open,'Outside gesture must dismiss menu');
  check((window.__sandbox.rig.focus.toArray().some((v,i)=>Math.abs(v-window.__touchCamera[i])>0.001)||Math.abs(window.__sandbox.rig.zoom-window.__touchZoom)>0.001),'Map gesture did not move the camera');
  check(JSON.stringify(window.__sandbox.interaction.selected)===window.__touchSelection,'Navigation cleared chosen panel');
  check(document.querySelector('.legend-heading').getAttribute('aria-expanded')==='true','Navigation closed legend');
  const bounds=[];
  for(const q of ['.layers-toggle','.legend-heading','.column .clock','.column .money']) {
    const e=document.querySelector(q); if(!e)continue; const r=e.getBoundingClientRect(); if(!r.width||!r.height)continue;
    check(r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,q+' outside viewport '+JSON.stringify(r.toJSON())); bounds.push(q);
  }
  check(!window.__qaErrors.length,'Runtime errors '+window.__qaErrors.join(';'));
  return {bounds,errors:window.__qaErrors,selection:window.__sandbox.interaction.selected};
})()`;
for (const [name, w, h, mode, cpuThrottle] of cases.filter(c => !process.env.UI_CASE || process.env.UI_CASE.split(',').includes(c[0]))) {
  const touch = name !== 'desktop';
  const cdp = (method, params) => ({ cdp: method, params });
  const steps = [
    cdp('Emulation.setTouchEmulationEnabled', { enabled: touch }),
    { ready: true },
    ...(mode === 'fullscreen' ? [
      {eval: `(() => { const b=Object.assign(document.createElement('button'),{id:'qa-fullscreen'}); b.style.cssText='position:fixed;left:0;top:0;width:20px;height:20px;z-index:99999'; b.onclick=()=>document.documentElement.requestFullscreen().then(()=>window.__fullscreenAttempt='entered',e=>window.__fullscreenAttempt=String(e)).finally(()=>b.remove()); document.body.append(b); return true; })()`},
      cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:5,y:5,button:'left',clickCount:1}),
      cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:5,y:5,button:'left',clickCount:1}),
      {wait: 350},
    ] : []),
    { eval: inspect },
    ...(touch ? [
      cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 2, y: Math.round(h / 2) }] }),
      {wait: 80},
      cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 35, y: Math.round(h / 2) + 15 }] }),
      {wait: 80},
      cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{x:60,y:Math.round(h/2)+25}] }),
      {wait: 80},
      cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    ] : [cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 2, y: h / 2, deltaX: 0, deltaY: 100 })]),
    { wait: 350 }, { eval: verify }, { shot: `${name}.png` },
    { eval: `document.querySelector('.goals-head').click(); document.querySelector('.events-heading').click(); document.querySelector('.selection-heading').click(); true` },
    { shot: `${name}-compact.png` },
    // Toolbar/keyboard-sized shrink, then restore: controls must remain reachable.
    cdp('Emulation.setDeviceMetricsOverride', { width: w, height: Math.max(260, h - 180), deviceScaleFactor: 1, mobile: touch }),
    { wait: 350 }, { eval: verify },
    cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: touch }),
    { wait: 350 }, { eval: verify },
    cdp('Emulation.setDeviceMetricsOverride', { width: h, height: w, deviceScaleFactor: 1, mobile: touch }),
    { wait: 350 }, { eval: verify },
    ...(mode === 'fullscreen' ? [{eval: 'document.fullscreenElement ? document.exitFullscreen() : null'}, {wait: 300}, {eval: '({fullscreen:!!document.fullscreenElement,attempt:window.__fullscreenAttempt})'}] : []),
    ...(process.env.UI_PERF ? [call('./perf.js', 4)] : []),
  ];
  const result = await drive(url, steps, { out, size: `${w}x${h}`, seed: 777, diagnostics: true, touch, cpuThrottle, settle: 1000 });
  if (process.env.UI_PERF) { const sample=result.at(-1); assert(sample.frames>=10 && Number.isFinite(sample.cpuMeanMs),'No valid performance sample'); }
  if (mode !== 'fullscreen') assert.equal(result.find(r => r?.mode).mode, mode, 'Requested display mode did not apply');
  console.log(JSON.stringify({ name, result }));
}
console.log('Touch UI viewport matrix: passed. Fullscreen outcome is reported per case; installed PWA validation remains pending.');
