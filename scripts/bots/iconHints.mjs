// Isolated input contract checks: compile the real UI module without loading the 3D game.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { build } from 'vite';
import { drive } from './chrome.mjs';

const out = '/tmp/hrs-icon-hints-qa';
mkdirSync(out, { recursive: true });
await build({ configFile: false, build: { lib: { entry: new URL('../../src/ui/iconHints.ts', import.meta.url).pathname, formats: ['es'], fileName: () => 'hints.js', cssFileName: 'hints' }, outDir: `${out}/assets`, emptyOutDir: true, minify: false } });
const html = `<!doctype html><title>Icon hint input checks</title><link rel="stylesheet" href="/hints.css">
<style>:root{--fade:20,18,16;--text:#eee;--muted:#aaa;--body:Arial}body{background:#242424;color:#eee;font:16px Arial}.tile{position:absolute;top:40px;width:70px;height:40px;background:#444;color:white;border:0}#info{left:20px}#action{left:120px}#nested{left:220px}#other{left:20px;top:120px}#disabled{left:120px;top:120px}</style>
<span id="info" class="tile" tabindex="0" data-icon-hint="Informational icon" aria-describedby="existing">i</span>
<button id="action" class="tile" data-icon-hint="Action explanation" onclick="window.actions++">Action</button>
<button id="nested" class="tile" onclick="window.actions++"><span id="nested-icon" data-icon-hint="Nested icon meaning">+</span></button>
<span id="other" class="tile" data-icon-hint="Another icon">?</span>
<button id="disabled" class="tile" disabled data-icon-hint="Why unavailable">Disabled</button>
<label style="position:absolute;top:200px"><span id="label-icon" data-icon-hint="Checkbox explanation">Flag</span><input id="checkbox" type="checkbox"></label>
<script type="module">import{installIconHints}from'/hints.js';installIconHints();installIconHints();window.actions=0;window.hintsReady=true;</script>`;
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/hints.js' || path === '/hints.css') {
    res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css');
    res.end(readFileSync(`${out}/assets${path}`));
  } else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const results = await drive(`http://127.0.0.1:${server.address().port}/`, [
    { eval: `(async()=>{while(!window.hintsReady)await new Promise(r=>setTimeout(r,20));return true})()` },
    { cdp: 'Input.dispatchTouchEvent', params: { type: 'touchStart', touchPoints: [{ x: 40, y: 60 }] } }, { wait: 60 },
    { cdp: 'Input.dispatchTouchEvent', params: { type: 'touchEnd', touchPoints: [] } },
    { eval: `(()=>{if(document.getElementById('icon-hint').hidden)throw Error('Real touch did not open informational hint');return true})()` },
    // Any tap closes an open hint, including tapping its own trigger again.
    { cdp: 'Input.dispatchTouchEvent', params: { type: 'touchStart', touchPoints: [{ x: 40, y: 60 }] } },
    { cdp: 'Input.dispatchTouchEvent', params: { type: 'touchEnd', touchPoints: [] } },
    { eval: `(()=>{if(!document.getElementById('icon-hint').hidden)throw Error('Same-icon tap reopened hint');return true})()` },
    { cdp: 'Input.dispatchTouchEvent', params: { type: 'touchStart', touchPoints: [{ x: 140, y: 60 }] } },
    { cdp: 'Input.dispatchTouchEvent', params: { type: 'touchEnd', touchPoints: [] } },
    { eval: `(async()=>{
      await new Promise(r=>setTimeout(r,100));
      const box=document.getElementById('icon-hint'), info=document.getElementById('info');
      const check=(v,m)=>{if(!v)throw Error(m)};
      check(actions===1&&box.hidden,'Action tap changed or opened a hint');
      const pointer=(el,type,x=25,y=60,extra={})=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',pointerId:20,clientX:x,clientY:y,button:0,...extra}));
      const tap=el=>{pointer(el,'pointerdown');pointer(el,'pointerup')};
      const over=el=>el.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
      tap(info); check(!box.hidden,'Informational tap');
      tap(document.getElementById('other')); check(box.hidden,'Any tap must close without reopening another hint');
      tap(info); tap(document.body); check(box.hidden,'Outside tap');
      over(document.getElementById('action')); check(box.textContent==='Action explanation'&&!box.hidden,'Action hover');
      document.getElementById('action').dispatchEvent(new PointerEvent('pointerout',{bubbles:true,pointerType:'mouse',relatedTarget:document.body})); check(box.hidden,'Unhover');
      tap(document.getElementById('nested-icon'));check(box.hidden,'Nested actionable icon must not intercept tap');
      over(document.getElementById('nested-icon')); check(box.textContent==='Nested icon meaning','Specific nested hover explanation');
      tap(document.body);
      tap(document.getElementById('label-icon'));check(box.hidden,'Label control keeps its tap action');
      tap(document.getElementById('disabled'));check(!box.hidden&&box.textContent==='Why unavailable','Disabled non-action explains itself');
      tap(document.body);
      pointer(info,'pointerdown');pointer(info,'pointerup',70,100);check(box.hidden,'Drag must not open hint');
      tap(info); info.dataset.iconHint='Updated explanation';await new Promise(requestAnimationFrame);check(box.textContent==='Updated explanation','Live hint text');
      check(info.getAttribute('aria-describedby').includes('existing'),'Existing accessibility description lost');
      document.dispatchEvent(new Event('scroll'));check(box.hidden&&info.getAttribute('aria-describedby')==='existing','Navigation dismissal and ARIA cleanup');
      tap(info);pointer(info,'pointercancel');check(box.hidden,'Pointer cancellation');
      info.focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check(box.hidden,'Escape');
      info.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));check(!box.hidden,'Keyboard informational hint');
      tap(document.body);
      info.click();check(!box.hidden,'Assistive activation opens informational hint');
      document.getElementById('other').click();check(box.hidden,'Assistive activation dismisses open hint');
      document.getElementById('action').click();check(actions===2&&box.hidden,'Assistive action keeps original behavior');
      const dialog=document.createElement('dialog'),modalInfo=document.createElement('span');modalInfo.dataset.iconHint='Modal icon';modalInfo.textContent='i';dialog.append(modalInfo);document.body.append(dialog);dialog.showModal();tap(modalInfo);check(box.parentElement===dialog&&!box.hidden,'Hint must render in modal top layer');tap(dialog);dialog.close();dialog.remove();
      const added=document.createElement('span');added.dataset.iconHint='Dynamic icon';added.textContent='i';document.body.append(added);tap(added);check(box.textContent==='Dynamic icon'&&!box.hidden,'Dynamic indicators use delegated hints');tap(document.body);added.remove();
      tap(info);info.remove();await new Promise(r=>setTimeout(r,100));check(box.hidden,'Removed indicator left stale hint');
      check(document.querySelectorAll('#icon-hint').length===1,'Duplicate installation');
      check(!window.__qaErrors.length,window.__qaErrors.join(';'));
      return {checks:24,actions,errors:window.__qaErrors};
    })()` },
  ], { out, size: '393x852', touch: true, diagnostics: true, settle: 100 });
  assert.equal(results.at(-1).checks, 24);
  console.log(JSON.stringify(results.at(-1)));
  console.log('Icon hint hover, tap, action preservation, dismissal, live data and accessibility: passed');
} finally { await new Promise(resolve => server.close(resolve)); }
