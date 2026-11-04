// Chrome layout emulation with injected inset measurements; not physical PWA validation.
import assert from 'node:assert/strict';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const layout=`(()=>{const ids=['#hud','.hud-header','.top-bar','.column','.tutorial-guide','.tutorial-counter'];return {stage:document.querySelector('.tutorial-guide')?.dataset.stage,options:[...document.querySelectorAll('.column .options>li')].filter(e=>!e.hidden&&e.getClientRects().length).map(e=>e.textContent.trim()),size:[innerWidth,innerHeight],errors:window.__qaErrors,rects:Object.fromEntries(ids.map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return[s,{left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:e.scrollHeight,client:e.clientHeight}]})),overflow:document.documentElement.scrollWidth>innerWidth,zoom:window.__sandbox.rig.zoom,canvas:document.getElementById('scene').getBoundingClientRect().toJSON()};})()`;
const result=await drive(process.argv[2] ?? 'http://127.0.0.1:5202/?scenario=tutorial&packs=none',[
...SKIP_WELCOME,
{eval:`document.querySelector('.viewport-safe-area').style.padding='62px 0px 34px';true`},
{eval:"dispatchEvent(new Event('resize'));window.__sandbox.sim.tutorial.state.stage='outreach';window.__sandbox.sim.tutorial.state.reviewedSkills=true;window.__sandbox.syncEvents();true"},{wait:500},{eval:layout},{shot:'portrait.png'},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:852,height:393,deviceScaleFactor:1,mobile:true}},
{eval:`document.querySelector('.viewport-safe-area').style.padding='0px 62px 21px';true`},
{eval:"dispatchEvent(new Event('resize'));true"},{wait:1000},{eval:layout},{shot:'landscape.png'},
{cdp:'Input.dispatchTouchEvent',params:{type:'touchStart',touchPoints:[{x:450,y:180,id:1},{x:450,y:220,id:2}]}},
...[1,2,3,4,5].map(i=>({cdp:'Input.dispatchTouchEvent',params:{type:'touchMove',touchPoints:[{x:450,y:180-i*15,id:1},{x:450,y:220+i*15,id:2}]}})),
{cdp:'Input.dispatchTouchEvent',params:{type:'touchEnd',touchPoints:[]}},{wait:500},{eval:layout},{shot:'landscape-zoom.png'},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:667,height:375,deviceScaleFactor:1,mobile:true}},
{eval:`document.querySelector('.viewport-safe-area').style.padding='0px 44px 21px';dispatchEvent(new Event('resize'));true`},{wait:1000},{eval:layout},{shot:'small-landscape.png'},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:1440,height:900,deviceScaleFactor:1,mobile:false}},
{eval:`document.querySelector('.viewport-safe-area').style.padding='0px';true`},
{eval:"dispatchEvent(new Event('resize'));true"},{wait:1000},{eval:layout},{shot:'desktop.png'}
],{size:'393x852',touch:true,diagnostics:true,out:'/tmp/hrs-viewport-qa',log:()=>{}});
console.log(JSON.stringify(result,null,2));

const views=result.filter(v=>v?.rects);
assert.equal(views.length,5);
for(const v of views){assert(!v.overflow);assert.equal(v.errors.length,0);for(const r of Object.values(v.rects)){assert(r.left>=v.rects['#hud'].left-1);assert(r.right<=v.rects['#hud'].right+1);assert(r.top>=v.rects['#hud'].top-1);assert(r.bottom<=v.rects['#hud'].bottom+1);}}
assert.equal(views[0].rects['#hud'].top,62);assert(views[0].rects['.hud-header'].top>=74);
assert.equal(views[1].rects['#hud'].left,62);assert.equal(views[1].rects['#hud'].right,790);
assert(views[1].rects['.top-bar'].bottom>0);assert(views[2].zoom>views[1].zoom*2);
assert.equal(views[1].stage,'outreach');assert.deepEqual(views[0].options,views[1].options);assert.deepEqual(views[0].options,views[3].options);
console.log('Inset bounds, portrait/landscape control parity, actual touch zoom and desktop checks passed');
