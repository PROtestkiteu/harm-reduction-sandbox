// Real welcome UI: reading/dragging never dismisses it; only explicit completion or Escape.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive } from './chrome.mjs';
const base=process.argv[2]??'http://127.0.0.1:5217/';
const out=process.argv[3]??'/tmp/hrs-welcome-clicks-qa';mkdirSync(out,{recursive:true});
const url=new URL(base);url.search='?menu=1&lang=en&packs=none&quality=low';
const steps=[{eval:`(async()=>{window.waitWelcome=async(test,label)=>{const end=Date.now()+120000;while(!test()&&Date.now()<end)await new Promise(r=>setTimeout(r,100));if(!test())throw Error(label)};localStorage.removeItem('hrp-tutorials-hidden');await waitWelcome(()=>document.querySelector('.main-menu-actions'),'menu');document.querySelectorAll('.main-menu-actions button')[1].click();[...document.querySelectorAll('.scenario-tile')].find(t=>t.querySelector('strong').textContent==='Tutorial').click();document.querySelector('.scenario-detail .menu-primary').click();await waitWelcome(()=>document.querySelector('dialog.intro[open]')&&!document.getElementById('loading'),'welcome');window.welcomeStep=document.querySelector('.intro-step').textContent;return true})()`}];
const check={eval:`if(!document.querySelector('dialog.intro[open]'))throw Error('Reading click dismissed welcome');true`};
function click(selector){steps.push({cdp:'Input.dispatchMouseEvent',paramsEval:`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {type:'mousePressed',x:r.left+Math.min(30,r.width/2),y:r.top+Math.min(12,r.height/2),button:'left',buttons:1,clickCount:1}})()`},{cdp:'Input.dispatchMouseEvent',paramsEval:`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {type:'mouseReleased',x:r.left+Math.min(30,r.width/2),y:r.top+Math.min(12,r.height/2),button:'left',buttons:0,clickCount:1}})()`},check);}
for(const selector of ['.intro h2','.intro .welcome-lead','.intro li','.intro .intro-step','.intro .window-drag-margin[data-edge=left]','.intro .window-drag-margin[data-edge=bottom]'])click(selector);
steps.push({eval:`(()=>{const d=document.querySelector('dialog.intro'),r=d.getBoundingClientRect();let point;for(let y=r.top+2;y<r.bottom-2&&!point;y+=3)for(let x=r.left+2;x<r.right-2;x+=5)if(document.elementFromPoint(x,y)===d){point={x,y};break;}if(!point)throw Error('No direct dialog padding to test');window.blankPoint=point;return true})()`},
{cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mousePressed',...blankPoint,button:'left',buttons:1,clickCount:1})`},
{cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mouseReleased',...blankPoint,button:'left',buttons:0,clickCount:1})`},check,
{cdp:'Input.dispatchMouseEvent',params:{type:'mousePressed',x:2,y:2,button:'left',buttons:1,clickCount:1}},
{cdp:'Input.dispatchMouseEvent',params:{type:'mouseReleased',x:2,y:2,button:'left',buttons:0,clickCount:1}},check,
{eval:`(()=>{const d=document.querySelector('dialog.intro');d.querySelector('.intro-nav button:last-child').click();if(!d.open||d.querySelector('.intro-step').textContent===welcomeStep)throw Error('Next failed');d.querySelector('.intro-back').click();if(!d.open||d.querySelector('.intro-step').textContent!==welcomeStep)throw Error('Back failed');return true})()`},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:393,height:852,deviceScaleFactor:1,mobile:true}},{wait:200},
{eval:`(()=>{const d=document.querySelector('dialog.intro'),r=d.querySelector('.window-drag-margin[data-edge=left]').getBoundingClientRect();window.touchPoint={x:r.left+5,y:r.top+30};window.welcomeBefore=d.getBoundingClientRect().toJSON();return true})()`},
{cdp:'Input.dispatchTouchEvent',paramsEval:`({type:'touchStart',touchPoints:[touchPoint]})`},
{cdp:'Input.dispatchTouchEvent',paramsEval:`({type:'touchMove',touchPoints:[{x:touchPoint.x+5,y:touchPoint.y+15}]})`},
{cdp:'Input.dispatchTouchEvent',params:{type:'touchEnd',touchPoints:[]}},{wait:150},check,
{eval:`(()=>{const r=document.querySelector('dialog.intro').getBoundingClientRect();if(Math.abs(r.top-welcomeBefore.top-15)>1)throw Error('Touch margin drag failed');return true})()`},
{shot:'welcome-phone.png'},
{eval:`(()=>{const d=document.querySelector('dialog.intro');for(let i=0;i<5&&d.open;i++)d.querySelector('.intro-nav button:last-child').click();if(d.open)throw Error('Explicit completion failed');return true})()`},
{wait:150},
{eval:`(()=>{document.querySelector('.sandbox-toggle').click();const help=[...document.querySelectorAll('.sandbox:not(.sheet) button')].find(b=>b.textContent.trim().startsWith('How it works'));if(!help)throw Error('Help entry missing');help.click();if(!document.querySelector('dialog.intro[open]'))throw Error('Help did not reopen welcome');return true})()`},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}},{wait:150},
{eval:`if(document.querySelector('dialog.intro[open]'))throw Error('Escape did not close welcome');({errors:window.__qaErrors,passed:true})`});
const results=await drive(url.href,steps,{menu:true,diagnostics:true,touch:true,size:'1280x900',out,log:()=>{}});
assert(results.every(Boolean));assert.deepEqual(results.at(-1).errors,[]);
console.log('Welcome reading, padding, margin and backdrop clicks stay open; Next/Back, touch dragging, completion, Help and Escape passed');
