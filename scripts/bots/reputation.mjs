// Mobile reputation regression checks. Pass the dev-server URL as the first argument.
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drive, SKIP_WELCOME } from './chrome.mjs';
import assert from 'node:assert/strict';
const out = join(tmpdir(), 'hrs-reputation');
mkdirSync(out, { recursive: true });
const results=await drive(process.argv[2] ?? 'http://localhost:5199/?packs=none',[...SKIP_WELCOME,
{eval:`(()=>{const sim=window.__sandbox.sim;sim.favours=0;window.__sandbox.syncEvents();const before=document.querySelector('.favour-count').getBoundingClientRect();document.querySelector('.favour-count').click();return {collapsed:!document.querySelector('.reputation-disclosure').open,fold:document.querySelector('.org-favours-fold').open,disabled:document.querySelector('.favour-count').disabled,hudWidth:before.width};})()`},
{eval:`document.querySelector('.reputation-disclosure').open=true;1`},{wait:100},{shot:'reputation-390.png'},
...['390x844','320x740','844x390'].flatMap(size=>{const [width,height]=size.split('x').map(Number);return [{cdp:'Emulation.setDeviceMetricsOverride',params:{width,height,deviceScaleFactor:1,mobile:true}},{wait:100},{eval:`(()=>{const nodes=[...document.querySelectorAll('.reputation-tree>details')];return {size:'${size}',nodes:nodes.length,overflow:document.documentElement.scrollWidth>innerWidth,treeOverflow:document.querySelector('.reputation-tree').scrollWidth>document.querySelector('.reputation-tree').clientWidth,targets:nodes.every(e=>e.querySelector('summary').getBoundingClientRect().height>=44)};})()`},{shot:`reputation-${size}.png`}]}),
{cdp:'Emulation.setEmulatedMedia',params:{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]}},{wait:100},{shot:'reputation-light-landscape.png'},
{eval:`(()=>{const summary=document.querySelector('.reputation-tree summary');summary.focus();return {focused:document.activeElement===summary};})()`},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',text:'\r',key:'Enter',code:'Enter',windowsVirtualKeyCode:13}},{cdp:'Input.dispatchKeyEvent',params:{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13}},{wait:100},{eval:`({keyboardOpened:document.querySelector('.reputation-tree>details').open})`},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:' ',code:'Space',text:' ',windowsVirtualKeyCode:32}},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32}},
{wait:100},{eval:`({spaceClosed:!document.querySelector('.reputation-tree>details').open})`}
],{size:'390x844',out,settle:1000,log:()=>{},touch:true,colorScheme:'dark'});
console.log(JSON.stringify(results,null,2));
assert(results[1].collapsed);assert(results[1].fold);assert(!results[1].disabled);
for(const r of results.filter(r=>r?.size)){assert.equal(r.nodes,7);assert(!r.overflow);assert(!r.treeOverflow);assert(r.targets)}assert(results.some(r=>r?.keyboardOpened));assert(results.at(-1).spaceClosed);
