/** Ukrainian menu, game and startup-failure regression using the shared Chrome driver. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive } from './chrome.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:5202/';
const url = new URL(base); url.searchParams.set('lang','uk'); url.searchParams.set('scenario','tutorial'); url.searchParams.set('packs','none'); url.searchParams.set('quality','low');
const out = process.argv[3] ?? '/tmp/hrs-uk-qa';
mkdirSync(out, { recursive: true });
const click = text => `new Promise((resolve,reject)=>{const end=Date.now()+30000;const poll=()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent.trim()===${JSON.stringify(text)});if(b){b.click();resolve(true);}else if(Date.now()>end)reject(Error('Missing '+${JSON.stringify(text)}+': '+document.body.innerText));else setTimeout(poll,100);};poll();})`;

const snapshot = `(()=>{const selectors=['.main-menu','.main-menu-page','#hud','.hud-header','.tutorial-guide','.sandbox-body:not([hidden])'];return {lang:document.documentElement.lang,text:document.body.innerText,errors:window.__qaErrors,overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,rects:Object.fromEntries(selectors.map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return [s,r&&e.getClientRects().length?{left:r.left,right:r.right,width:r.width,scroll:e.scrollWidth,client:e.clientWidth}:null]}))};})()`;
if (!process.argv.includes('--failure-only')) {
const results = await drive(url.href,[
  {eval:`new Promise((resolve,reject)=>{const end=Date.now()+30000;const poll=()=>document.querySelector('.main-menu')?resolve(true):Date.now()>end?reject(Error('Menu not ready: '+document.body.innerText)):setTimeout(poll,100);poll();})`},
  {eval:snapshot},{shot:'menu.png'},
  {eval:click('Налаштування')},
  {eval:`({options:[...document.querySelectorAll('option')].map(o=>[o.value,o.textContent,o.selected])})`},
  {shot:'settings.png'},
  {eval:`(()=>{const s=document.querySelector('select');s.value='uk';s.dispatchEvent(new Event('change'));return true;})()`},{wait:6000},
  {eval:`({stored:localStorage.getItem('hrp-lang'),url:location.href})`},
  {eval:click('Нова гра')},{shot:'scenarios.png'},
  {eval:click('Почати гру')},{eval:`new Promise((resolve,reject)=>{const end=Date.now()+60000;const poll=()=>document.querySelector('#hud')&&!document.querySelector('#loading')?resolve(true):Date.now()>end?reject(Error('Game not ready')):setTimeout(poll,100);poll();})`},{wait:1000},
  {eval:`document.querySelectorAll('dialog[open]').forEach(d=>d.close());true`},
  {eval:snapshot},{shot:'game-desktop.png'},
  {cdp:'Emulation.setDeviceMetricsOverride',params:{width:393,height:852,deviceScaleFactor:1,mobile:true}},{wait:400},
  {cdp:'Emulation.setEmulatedMedia',params:{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]}},
  {eval:snapshot},{shot:'game-mobile-light.png'}
],{menu:true,diagnostics:true,colorScheme:'dark',size:'1440x900',out,settle:9000,log:()=>{}});
const views=results.filter(r=>r?.rects);
for(const view of views){assert.equal(view.lang,'uk');assert.equal(view.errors.length,0);assert(!view.overflow,'Page overflow');for(const [name,r]of Object.entries(view.rects)){if(!r||name==='.hud-header')continue;assert(r.left>=-1&&r.right<=view.width+1,`${name}: outside viewport`);assert(r.scroll<=r.client+1,`${name}: horizontal overflow`);}}
assert(/головне меню/i.test(views[0].text));
assert(results.some(r=>r?.options?.some(([id,name,selected])=>id==='uk'&&name==='Українська'&&selected)));
assert(results.some(r=>r?.stored==='uk'&&r.url.includes('lang=uk')));
assert(views.some(r=>r.rects['#hud']));
}
const failure = await drive(url.href,[
  {cdp:'Network.enable'},
  {cdp:'Network.setBlockedURLs',params:{urls:['*src/ui/mainMenu.ts*','*assets/mainMenu-*.js*']}},
  {cdp:'Page.reload',params:{ignoreCache:true}},{wait:6000},
  {eval:`({text:document.querySelector('#loading')?.innerText,alert:document.querySelector('#loading')?.getAttribute('role')})`},{shot:'failure.png'},
  {cdp:'Network.setBlockedURLs',params:{urls:[]}},
  {eval:click('Спробувати ще раз')},{wait:6000},
  {eval:`({recovered:/головне меню/i.test(document.body.innerText)})`}
],{menu:true,size:'393x852',out,settle:9000,log:()=>{}});
assert(failure.some(r=>r?.alert==='alert'&&r.text.includes('Не вдалося запустити гру.')));
assert(failure.some(r=>r?.recovered));
console.log(process.argv.includes('--failure-only') ? 'Ukrainian startup module failure/retry passed' : 'Ukrainian menu, settings persistence, desktop/mobile layout, light/dark theme, reduced motion and startup failure/retry passed');
