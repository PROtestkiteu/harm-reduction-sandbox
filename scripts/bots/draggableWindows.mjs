// Native mouse/touch contracts against the shared production drag controller.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { build } from 'vite';
import { drive } from './chrome.mjs';
const out='/tmp/hrs-draggable-windows-qa';mkdirSync(out,{recursive:true});
await build({configFile:false,build:{lib:{entry:new URL('../../src/ui/draggableWindow.ts',import.meta.url).pathname,formats:['es'],fileName:()=> 'drag.js',cssFileName:'drag'},outDir:`${out}/assets`,emptyOutDir:true,minify:false}});
const html=`<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/drag.css"><style>
body{margin:0;background:#222;color:#eee;font:16px Arial}section,dialog{box-sizing:border-box;width:min(400px,calc(100% - 32px));padding:20px;border:1px solid #bbb;background:#333;color:#eee}section{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}h2{margin:0 0 16px}.heading{width:100%;text-align:left;touch-action:none;min-height:44px;background:#444;color:#eee}button{min-height:44px}p{height:70px;overflow:auto}dialog{max-height:calc(100% - 32px)}
</style><section id="panel"><h2><button class="heading" onclick="window.foldClicks++">Tutorial title</button></h2><p>Scrollable text<br>Text<br>Text<br>Text<br>Text<br>Text<br>Text<br>Text</p><button id="action" onclick="window.actions++">Action</button></section><dialog id="modal"><h2>Event title</h2><p>Event details</p><button onclick="this.closest('dialog').close()">Close</button></dialog>
<script type="module">import{draggableWindow}from'/drag.js';window.foldClicks=0;window.actions=0;window.panelDrag=draggableWindow(document.getElementById('panel'),'.heading');window.modalDrag=draggableWindow(document.getElementById('modal'));window.ready=true;</script>`;
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;if(['/drag.js','/drag.css'].includes(path)){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(`${out}/assets${path}`));}else{res.setHeader('Content-Type','text/html');res.end(html);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const steps=[{eval:`(async()=>{for(let i=0;i<100&&!window.ready;i++)await new Promise(r=>setTimeout(r,50));if(!window.ready)throw Error('Fixture not ready');window.before=document.getElementById('panel').getBoundingClientRect().toJSON();return true})()`}];
function mouse(selector,dx,dy){steps.push({eval:`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();window.point={x:r.left+Math.min(30,r.width/2),y:r.top+Math.min(20,r.height/2)};return true})()`},{cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mousePressed',...window.point,button:'left',buttons:1,clickCount:1})`},{cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mouseMoved',x:point.x+${dx},y:point.y+${dy},button:'left',buttons:1})`},{cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mouseReleased',x:point.x+${dx},y:point.y+${dy},button:'left',buttons:0,clickCount:1})`},{wait:50});}
mouse('.heading',60,30);
steps.push({eval:`(()=>{const r=document.getElementById('panel').getBoundingClientRect();if(Math.abs(r.left-before.left-60)>1||Math.abs(r.top-before.top-30)>1||foldClicks)throw Error('Mouse drag or click suppression failed');return 'mouse drag and heading click suppression'})()`});
mouse('.heading',0,0);steps.push({eval:`if(foldClicks!==1)throw Error('Heading tap lost');true`});
mouse('#action',0,0);steps.push({eval:`if(actions!==1)throw Error('Action button lost');true`});
steps.push({eval:`(()=>{window.before=document.getElementById('panel').getBoundingClientRect().toJSON();const r=document.querySelector('.heading').getBoundingClientRect();window.point={x:r.left+30,y:r.top+20};return true})()`},
{cdp:'Input.dispatchTouchEvent',paramsEval:`({type:'touchStart',touchPoints:[point]})`},
{cdp:'Input.dispatchTouchEvent',paramsEval:`({type:'touchMove',touchPoints:[{x:point.x-45,y:point.y+35}]})`},
{cdp:'Input.dispatchTouchEvent',params:{type:'touchEnd',touchPoints:[]}},{wait:80},
{eval:`(()=>{const r=document.getElementById('panel').getBoundingClientRect();if(Math.abs(r.left-before.left+45)>1||Math.abs(r.top-before.top-35)>1||foldClicks!==1)throw Error('Native touch drag failed');return 'touch drag'})()`});
for(const edge of ['top','right','bottom','left']) {
  steps.push({eval:`window.before=document.getElementById('panel').getBoundingClientRect().toJSON();true`});
  mouse(`#panel .window-drag-margin[data-edge="${edge}"]`,12,8);
  steps.push({eval:`(()=>{const r=document.getElementById('panel').getBoundingClientRect();if(Math.abs(r.left-before.left-12)>1||Math.abs(r.top-before.top-8)>1)throw Error('Margin drag failed: ${edge}');return true})()`});
}
steps.push({eval:`(()=>{window.before=document.getElementById('panel').getBoundingClientRect().toJSON();const r=document.querySelector('#panel .window-drag-margin[data-edge="top"]').getBoundingClientRect();window.point={x:r.left+24,y:r.top+5};return true})()`},
{cdp:'Input.dispatchTouchEvent',paramsEval:`({type:'touchStart',touchPoints:[point]})`},
{cdp:'Input.dispatchTouchEvent',paramsEval:`({type:'touchMove',touchPoints:[{x:point.x-15,y:point.y-10}]})`},
{cdp:'Input.dispatchTouchEvent',params:{type:'touchEnd',touchPoints:[]}},{wait:80},
{eval:`(()=>{const r=document.getElementById('panel').getBoundingClientRect();if(Math.abs(r.left-before.left+15)>1||Math.abs(r.top-before.top+10)>1)throw Error('Native touch margin drag failed');return true})()`});
mouse('#panel p',20,10);
steps.push({eval:`(()=>{const r=document.getElementById('panel').getBoundingClientRect();if(Math.abs(r.left-before.left+15)>1||Math.abs(r.top-before.top+10)>1)throw Error('Content text dragged window');return true})()`},
{cdp:'Input.dispatchMouseEvent',paramsEval:`(()=>{const r=document.querySelector('#panel p').getBoundingClientRect();return {type:'mouseWheel',x:r.left+30,y:r.top+20,deltaX:0,deltaY:60}})()`},{wait:150},
{eval:`if(document.querySelector('#panel p').scrollTop<=0)throw Error('Content scrolling lost');true`});
mouse('.heading',-1500,-1500);steps.push({eval:`(()=>{const r=document.getElementById('panel').getBoundingClientRect();if(r.left<7||r.top<7)throw Error('Escaped bounds');return 'viewport clamp'})()`},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:320,height:568,deviceScaleFactor:1,mobile:true}},{wait:120},
{eval:`(()=>{const r=document.getElementById('panel').getBoundingClientRect();if(r.left<7||r.right>313||r.top<7||r.bottom>561)throw Error('Resize lost panel');window.panelDrag.reset();document.getElementById('modal').showModal();window.before=document.getElementById('modal').getBoundingClientRect().toJSON();return 'resize clamp'})()`});
steps.push({cdp:'Input.dispatchMouseEvent',params:{type:'mousePressed',x:4,y:4,button:'left',buttons:1,clickCount:1}},
{cdp:'Input.dispatchMouseEvent',params:{type:'mouseMoved',x:24,y:24,button:'left',buttons:1}},
{cdp:'Input.dispatchMouseEvent',params:{type:'mouseReleased',x:24,y:24,button:'left',buttons:0,clickCount:1}},
{eval:`(()=>{const r=document.getElementById('modal').getBoundingClientRect();if(Math.abs(r.top-before.top)>1||Math.abs(r.left-before.left)>1)throw Error('Backdrop dragged modal');return true})()`});
mouse('#modal h2',10,20);steps.push({eval:`(async()=>{const d=document.getElementById('modal'),r=d.getBoundingClientRect();if(!d.open||Math.abs(r.top-before.top-20)>1)throw Error('Modal drag failed');const closed=new Promise(resolve=>d.addEventListener('close',resolve,{once:true}));d.close();await closed;d.showModal();if(d.style.getPropertyValue('--window-drag-x'))throw Error('Reopen did not reset');d.close();document.getElementById('action').focus();return 'modal drag and reopen reset'})()`},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'ArrowRight',code:'ArrowRight',modifiers:1}},{wait:40},
{eval:`if(document.getElementById('panel').style.getPropertyValue('--window-drag-x')==='')throw Error('Keyboard move failed');true`},
{eval:`(()=>{window.panelDrag.reset();const r=document.querySelector('.heading').getBoundingClientRect();window.point={x:r.left+30,y:r.top+20};return true})()`},
{cdp:'Input.dispatchTouchEvent',paramsEval:`({type:'touchStart',touchPoints:[point]})`},
{cdp:'Input.dispatchTouchEvent',paramsEval:`({type:'touchMove',touchPoints:[{x:point.x+15,y:point.y+15}]})`},
{cdp:'Input.dispatchTouchEvent',params:{type:'touchCancel',touchPoints:[]}},{wait:50},
{eval:`if(document.querySelector('[data-dragging]'))throw Error('Cancel left drag active');window.panelDrag.reset();true`},
{eval:`(()=>{const modal=document.getElementById('modal');modal.replaceChildren(Object.assign(document.createElement('h2'),{textContent:'New report'}));window.modalDrag.refresh();window.modalDrag.refresh();if(modal.querySelectorAll('.window-drag-margin').length!==4)throw Error('Rebuilt report lost or duplicated margins');return true})()`},
{shot:'phone-reset.png'});
try{const results=await drive(`http://127.0.0.1:${server.address().port}/`,steps,{out,size:'1000x800',settle:500,touch:true,diagnostics:true,log:()=>{}});assert(results.every(Boolean));console.log('Native mouse/touch title and margin drag, content scrolling, heading taps, action clicks, bounds, resize, modal reset, keyboard and cancellation: passed');}finally{server.close();}
