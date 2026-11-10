// Actual rendered contrast and interaction checks for the shared map controls.
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {drive} from './chrome.mjs';
const base=process.argv[2]??'http://127.0.0.1:5272/simulator/';
const out=process.argv[3]??'/tmp/hrs-map-control-contrast';mkdirSync(out,{recursive:true});
const start=`(async()=>{const end=Date.now()+120000;while(!document.querySelector('.main-menu-actions')&&Date.now()<end)await new Promise(r=>setTimeout(r,100));document.querySelectorAll('.main-menu-actions button')[1].click();[...document.querySelectorAll('.scenario-tile')].find(e=>e.querySelector('strong').textContent==='First nights').click();document.querySelector('.scenario-detail .menu-primary').click();while((!document.querySelector('#hud')||document.getElementById('loading'))&&Date.now()<end)await new Promise(r=>setTimeout(r,100));if(document.getElementById('loading'))throw Error('Game not ready');document.querySelectorAll('dialog[open]').forEach(d=>d.close());return true;})()`;
const snapshot=`(()=>{
 const channels=s=>(s.match(/[\\d.]+/g)||[]).map(Number);
 const lum=c=>c.slice(0,3).map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 const composite=(a,b)=>a.slice(0,3).map((v,i)=>v*(a[3]??1)+b[i]*(1-(a[3]??1)));
 const header=document.querySelector('.hud-header'),gear=header.querySelector('.sandbox-toggle'),layers=[...header.querySelectorAll('.map-layer-rail button')].filter(b=>b.getClientRects().length);
 const hs=getComputedStyle(header),gs=getComputedStyle(gear),hb=channels(hs.backgroundColor);
 const contrast=b=>{const s=getComputedStyle(b),bg=channels(s.backgroundColor),fg=channels(s.color);return Math.min(...[0,255].map(n=>ratio(fg,composite(bg,composite(hb,[n,n,n])))));};
 return {width:innerWidth,theme:matchMedia('(prefers-color-scheme: light)').matches?'light':'dark',gearContrast:contrast(gear),gearFilled:(channels(gs.backgroundColor)[3]??1)===1,gearBackground:gs.backgroundColor,headerBackground:hs.backgroundColor,layerContrast:layers.map(contrast),selected:layers.filter(b=>b.getAttribute('aria-pressed')==='true').length,overflow:document.documentElement.scrollWidth>innerWidth+1,errors:window.__qaErrors};
})()`;
const all=[];
for(const theme of ['light','dark']){
 const url=new URL(base);for(const [k,v]of Object.entries({lang:'en',packs:'none',quality:'low'}))url.searchParams.set(k,v);
 const steps=[{eval:start}];
 for(const [width,height]of [[1280,800],[1440,900],[852,393],[393,852]]){
  steps.push({cdp:'Emulation.setDeviceMetricsOverride',params:{width,height,deviceScaleFactor:1,mobile:width<1000}},{wait:250},{eval:snapshot},{shot:`${theme}-${width}x${height}.png`});
 }
 steps.push(
  {cdp:'Emulation.setDeviceMetricsOverride',params:{width:1280,height:800,deviceScaleFactor:1,mobile:false}},{wait:250},
  {eval:`document.querySelector('.map-layer-rail button').click();true`},{eval:snapshot},
  {eval:`document.querySelector('.map-layer-rail button').click();document.querySelector('.hud-header .sandbox-toggle').focus();true`},
  {cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9}},
  {cdp:'Input.dispatchKeyEvent',params:{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9}},
  {eval:`({layerFocus:document.activeElement.matches('.map-layer-rail button'),visible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle})`},
  {cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8}},
  {cdp:'Input.dispatchKeyEvent',params:{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8}},
  {eval:`({gearFocus:document.activeElement.matches('.sandbox-toggle'),visible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle})`},
  {eval:`(()=>{const b=document.querySelector('.hud-header .sandbox-toggle');b.click();return {open:b.getAttribute('aria-expanded')};})()`},{eval:snapshot},
  {eval:`[...document.querySelectorAll('.sandbox-body button')].find(b=>b.getClientRects().length).focus();true`},
  {cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}},
  {cdp:'Input.dispatchKeyEvent',params:{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}},
  {eval:`({closed:document.querySelector('.hud-header .sandbox-toggle').getAttribute('aria-expanded')==='false'})`},
 );
 const results=await drive(url.href,steps,{menu:true,diagnostics:true,colorScheme:theme,out,size:'1280x800',seed:777,log:()=>{}});
 writeFileSync(out+'/'+theme+'-raw.json',JSON.stringify(results,null,2));
 const views=results.filter(r=>r?.gearContrast!==undefined);
 for(const view of views){assert(view.gearContrast>=7,`Settings contrast: ${JSON.stringify(view)}`);assert(view.gearFilled);assert(view.layerContrast.every(r=>r>=4.5),`Layer contrast: ${JSON.stringify(view)}`);assert(!view.overflow);assert.deepEqual(view.errors,[]);}
 assert(views.some(v=>v.selected===1),'Map selection remains functional');
 assert(results.some(r=>r?.layerFocus&&r.visible&&r.outline!=='none'),'Layer keyboard focus');
 assert(results.some(r=>r?.gearFocus&&r.visible&&r.outline!=='none'),'Settings keyboard focus');
 assert(results.some(r=>r?.open==='true')&&results.some(r=>r?.closed),'Settings open and Escape close');
 all.push({theme,views});console.log(theme,JSON.stringify(views));
}
writeFileSync(out+'/results.json',JSON.stringify(all,null,2));
console.log('Map icon contrast, persistent Settings tile, selection, keyboard focus, Escape, themes and responsive checks passed');
