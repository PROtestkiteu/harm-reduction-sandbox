import { drive } from './chrome.mjs';
import { mkdirSync } from 'node:fs';
const out=process.argv[3]??'/tmp/hrs-city-people-release';mkdirSync(out,{recursive:true});
const steps=[
 {eval:`localStorage.setItem('hrp-tutorials-hidden',JSON.stringify(['welcome','guides']));document.querySelectorAll('dialog[open]').forEach(d=>d.close());true`},
 {eval:`(()=>{document.querySelectorAll('.main-menu-actions button')[1].click();document.querySelector('.scenario-tile:last-child').click();document.querySelector('.scenario-detail .menu-primary').click();return true})()`},
 {eval:`(async()=>{const until=performance.now()+120000;while(document.getElementById('loading')&&performance.now()<until)await new Promise(r=>setTimeout(r,250));if(document.getElementById('loading'))throw Error('Game loading timed out');document.querySelectorAll('dialog[open]').forEach(d=>d.close());return true})()`},
 {eval:`(async()=>{if(window.__sandbox)throw Error('Development hook in production');if(document.getElementById('loading'))throw Error('Still loading');const c=document.querySelector('canvas');if(!c)throw Error('Missing map');let point;for(let y=220;y<innerHeight-100&&!point;y+=22)for(let x=390;x<innerWidth-440&&!point;x+=22){if(document.elementFromPoint(x,y)!==c)continue;c.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y,pointerType:'mouse',bubbles:true}));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const t=document.querySelector('.scene-tooltip');if(t&&!t.hidden&&t.dataset.role==='passerby')point={x,y};}if(!point)throw Error('No visible selectable passer-by');window.releasePersonPoint=point;return point})()`},
 {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mousePressed',...releasePersonPoint,button:'left',clickCount:1})`},
 {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mouseReleased',...releasePersonPoint,button:'left',clickCount:1})`},
 {wait:1000},
 {eval:`(()=>{if(document.querySelector('.portrait')?.dataset.who!=='person')throw Error('Public person click failed');const n=document.querySelector('.selection-heading').getBoundingClientRect(),p=document.querySelector('.selection-rename').getBoundingClientRect();if(Math.abs(p.left-n.right)>4)throw Error('Pencil detached from name');if(window.__qaErrors?.length)throw Error(window.__qaErrors.join(';'));return {personSelected:true,pencilGap:p.left-n.right,developmentHook:!!window.__sandbox}})()`},
 {shot:'desktop.png'},
 {cdp:'Emulation.setDeviceMetricsOverride',params:{width:393,height:852,deviceScaleFactor:1,mobile:true}},
 {wait:500},
 {eval:`(()=>{const n=document.querySelector('.selection-heading').getBoundingClientRect(),p=document.querySelector('.selection-rename').getBoundingClientRect();if(Math.abs(p.left-n.right)>4||p.width<44||p.height<44||p.right>innerWidth)throw Error('Phone rename placement');return {phonePencilGap:p.left-n.right,width:p.width,height:p.height}})()`},
 {shot:'phone.png'}
];
console.log(JSON.stringify(await drive(process.argv[2]??'http://127.0.0.1:5299/thegame/?packs=none&quality=low',steps,{out,seed:777,size:'1440x900',settle:12000,menu:true,diagnostics:true}),null,2));
