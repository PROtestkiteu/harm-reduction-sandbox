// Real HUD controls and styles, isolated from scene/GPU startup.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { drive } from './chrome.mjs';
const out = mkdtempSync(join(tmpdir(), 'hrs-clock-'));
const source = resolve('src');
writeFileSync(join(out, 'fixture.ts'), `
import '${source}/style.css';
import '${source}/ui/panelControls.css';
import {Hud} from '${source}/ui/hud';
import '${source}/ui/uiIndicators.css';
let paused=false;
const callbacks=new Proxy({onPause(){paused=!paused;hud.setPaused(paused)},onSpeed(speed){hud.setSpeed(speed)}},{get(target,key){return target[key]??(()=>{})}});
const hud=new Hud(document.getElementById('hud')!,callbacks as any);
hud.setSpeed(1);hud.setPaused(false);
document.querySelector('.clock-full')!.textContent='czw. 16 wrz · 23:43';
document.querySelector('.clock-short')!.textContent='23:43';
document.querySelector('.money')!.textContent='1,218 +0/h';
document.getElementById('hud')!.classList.add('hud-ready');
Object.assign(window,{hud,clockReady:true});`);
await build({configFile:false,build:{lib:{entry:join(out,'fixture.ts'),formats:['es'],fileName:()=> 'fixture.js',cssFileName:'fixture'},outDir:join(out,'assets'),emptyOutDir:true,minify:false}});
const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/fixture.js'||path==='/fixture.css'){
    res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(join(out,'assets',path)));return;
  }
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="hud"></div><script type="module" src="/fixture.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try {
  const steps=[{eval:`(async()=>{while(!window.clockReady)await new Promise(r=>setTimeout(r,20));await document.fonts.ready;const speed=document.querySelector('.speed-toggle'),pause=document.querySelector('.time-pause');const states=[];for(let i=0;i<3;i++){speed.click();states.push(speed.textContent)}if(states.join(',')!=='4x,16x,1x'||pause.getAttribute('aria-pressed')!=='false')throw Error('Speed cycle must not pause');speed.click();pause.click();speed.click();if(pause.getAttribute('aria-pressed')!=='true'||speed.textContent!=='16x')throw Error('Changing speed must preserve pause');pause.click();if(pause.getAttribute('aria-pressed')!=='false'||speed.textContent!=='16x')throw Error('Resume must preserve speed');return {cycle:states,pausePreserved:true,resumeSpeed:speed.textContent}})()`}];
  for(const [width,height] of [[320,568],[393,852],[430,932],[852,393],[768,1024],[1440,900]]) steps.push(
    {cdp:'Emulation.setDeviceMetricsOverride',params:{width,height,deviceScaleFactor:1,mobile:width<768}}, {wait:80},
    {eval:`(()=>{const bar=document.querySelector('.top-bar'),controls=document.querySelector('.clock-controls'),pause=document.querySelector('.time-pause'),speed=document.querySelector('.speed-toggle'),time=document.querySelector('.column-time');const before=bar.getBoundingClientRect();const buttons=[pause,speed].map(b=>b.getBoundingClientRect());controls.remove();time.append(speed);const baseline=bar.getBoundingClientRect().height;time.append(controls);controls.append(speed);if(before.height>baseline+.5)throw Error(JSON.stringify({size:[innerWidth,innerHeight],height:before.height,baseline,bar:bar.getBoundingClientRect().toJSON(),controls:controls.getBoundingClientRect().toJSON(),time:time.getBoundingClientRect().toJSON(),button:buttons,display:getComputedStyle(controls).display,line:getComputedStyle(controls).lineHeight,clock:getComputedStyle(document.querySelector('.clock')).fontSize}));if(bar.scrollWidth>bar.clientWidth+1)throw Error('Topbar overflow');if(buttons.some(b=>b.left<before.left||b.right>before.right))throw Error('Controls clipped');if(buttons[1].left-buttons[0].right<12)throw Error('Touch targets overlap');return {size:[innerWidth,innerHeight],height:before.height,baseline,noOverflow:true}})()`},
    {shot:`clock-${width}x${height}.png`}
  );
  const results=await drive(`http://127.0.0.1:${server.address().port}/`,steps,{out,size:'393x852',settle:1000,touch:true,log:()=>{}});
  assert.equal(results.length,7);console.log(JSON.stringify({results,artifacts:out}));
  console.log('Independent pause, retained speed, non-overlapping touch controls and unchanged topbar height: passed');
} finally {server.close();}
