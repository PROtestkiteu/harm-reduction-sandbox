// Player-facing release copy, localization, national art and legacy save compatibility.
import assert from 'node:assert/strict';
import { drive } from './chrome.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:5202/';
for (const [lang, title] of [['en','Latin America'],['pl','Ameryka Łacińska'],['es','América Latina'],['pt','América Latina']]) {
  const url = new URL(base); url.searchParams.set('lang',lang); url.searchParams.set('quality','low'); url.searchParams.set('packs','none');
  const steps = [
    {eval:`document.querySelectorAll('.main-menu-actions button')[1].click();true`},
    {eval:`(()=>{const tile=[...document.querySelectorAll('.scenario-tile')].find(e=>e.querySelector('strong').textContent===${JSON.stringify(title)});if(!tile)throw new Error('Missing localized scenario');tile.click();return {title:document.querySelector('.scenario-detail h3').textContent,art:tile.querySelector('img').getAttribute('src'),legacy:/hardcore/i.test(document.querySelector('.main-menu').textContent)};})()`},
  ];
  if(lang==='en') steps.push(
    {eval:`document.querySelector('.scenario-detail .menu-primary').click();true`},
    {wait:12000,ready:true},
    {eval:`(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());const s=window.__sandbox;return {ready:!document.getElementById('loading'),scenario:s.sim.goals.scenario?.id,legacy:/hardcore/i.test(document.body.textContent),failureRules:s.sim.stakes.hardcore};})()`},
  );
  const result = await drive(url.href,steps,{menu:true,diagnostics:true,log:()=>{}});
  const menu=result[1];assert.equal(menu.title,title);
  const art=decodeURIComponent(menu.art);
  assert(/co(?:-[^/]*)?\.svg/.test(art)||['#fcd116','#003893','#ce1126'].every(color=>art.includes(color)),'Colombian flag stays');
  assert.equal(menu.legacy,false);
  if(lang==='en'){const game=result.at(-1);assert(game.ready);assert.equal(game.scenario,'colombia');assert.equal(game.legacy,false);assert.equal(game.failureRules,true);}
  console.log(lang,JSON.stringify(result));
}
console.log('Localized Latin America name, retained Colombian flag, scenario/save ID and legacy-mode copy checks passed');
