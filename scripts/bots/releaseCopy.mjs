// Production menu, scenario launch, localization and save-contract regression.
import assert from 'node:assert/strict';
import { drive } from './chrome.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:5202/';
const waitForMenu = `(async()=>{const end=Date.now()+120000;while(!document.querySelector('.main-menu-actions')&&Date.now()<end)await new Promise(r=>setTimeout(r,100));const start=document.querySelectorAll('.main-menu-actions button')[1];if(!start)throw new Error('Menu unavailable: '+document.body.innerText.slice(0,500));start.click();return true;})()`;
const waitForGame = `(async()=>{const end=Date.now()+120000;while((!document.querySelector('#hud')||document.getElementById('loading'))&&Date.now()<end)await new Promise(r=>setTimeout(r,100));if(!document.querySelector('#hud')||document.getElementById('loading'))throw new Error('Game did not start');return true;})()`;
const gameSnapshot = `(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());dispatchEvent(new Event('pagehide'));const save=JSON.parse(localStorage.getItem('hrp-continue')??'null');return {ready:!!document.querySelector('#hud')&&!document.getElementById('loading'),scenario:save?.more?.goals?.scenario,model:new URL(location.href).searchParams.get('model'),failureRules:save?.more?.stakes?.hardcore,errors:window.__qaErrors,legacy:/hardcore/i.test(document.body.textContent),overflow:document.documentElement.scrollWidth>innerWidth+1};})()`;
function address(lang) {
  const url = new URL(base);
  for (const [key, value] of Object.entries({lang, quality:'low', packs:'none'})) url.searchParams.set(key,value);
  return url.href;
}
function select(title) {
  return `(()=>{const tile=[...document.querySelectorAll('.scenario-tile')].find(e=>e.querySelector('strong').textContent===${JSON.stringify(title)});if(!tile)throw new Error('Missing localized scenario');tile.click();return {title:document.querySelector('.scenario-detail h3').textContent,art:tile.querySelector('img').getAttribute('src'),legacy:/hardcore/i.test(document.querySelector('.main-menu').textContent),overflow:document.documentElement.scrollWidth>innerWidth+1};})()`;
}
function checkGame(game,id,model) {
  assert(game.ready);
  assert.equal(game.scenario,id);
  assert.equal(game.model,model);
  assert.equal(game.failureRules,true);
  assert.equal(game.legacy,false);
  assert.equal(game.overflow,false);
  assert.deepEqual(game.errors,[]);
}
if (!process.argv.includes('--regional-only')) {
  for (const [lang,title] of [['en','Running on volunteers'],['pl','Siłą wolontariuszy'],['es','A fuerza de voluntariado'],['pt','À força do voluntariado'],['uk','Силами волонтерів']]) {
    const steps=[{eval:waitForMenu},{eval:select(title)}];
    if(lang==='en') steps.push({eval:`document.querySelector('.scenario-detail .menu-primary').click();true`},{eval:waitForGame},{wait:20000},{eval:gameSnapshot});
    const result=await drive(address(lang),steps,{menu:true,diagnostics:true,log:()=>{}});
    const menu=result[1];
    assert.equal(menu.title,title);assert.equal(menu.legacy,false);assert.equal(menu.overflow,false);
    const art=decodeURIComponent(menu.art);
    assert(/co(?:-[^/]*)?\.svg/.test(art)||['#fcd116','#003893','#ce1126'].every(color=>art.includes(color)),'Colombian flag stays');
    if(lang==='en')checkGame(result.at(-1),'colombia','mx-latam');
    console.log(lang,JSON.stringify(lang==='en'?result.at(-1):{title:menu.title,overflow:menu.overflow}));
  }
}
for (const [id,title,model] of [['new-zealand','A licence, a volunteer team','nz'],['australia','Prove the pilot','au'],['ukraine','Beyond the dancefloor','ua']]) {
  const result=await drive(address('en'),[
    {eval:waitForMenu},{eval:select(title)},
    {eval:`document.querySelector('.scenario-detail .menu-primary').click();true`},
    {eval:waitForGame},{eval:gameSnapshot},
  ],{menu:true,diagnostics:true,size:id==='new-zealand'?'393x852':'1440x900',log:()=>{}});
  assert.equal(result[1].title,title);assert.equal(result[1].overflow,false);
  checkGame(result.at(-1),id,model);
  console.log(id,JSON.stringify(result.at(-1)));
}
console.log('Production scenario launches, saved failure rules, localized titles, retained save ID/art and overflow checks passed');
