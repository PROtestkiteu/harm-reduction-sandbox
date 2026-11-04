import assert from 'node:assert/strict';
import { drive } from './chrome.mjs';
// Run against a production preview, where development launch shortcuts are disabled.
const url = new URL(process.argv[2] ?? 'http://127.0.0.1:5237/');
url.search = '?play=1&scenario=tutorial&g=0123456789abcdef01234567';
const results=await drive(url.href,[
{eval:`({home:document.querySelector('.main-menu')?.dataset.screen,errors:window.__qaErrors,worldLoaded:performance.getEntriesByType('resource').some(r=>new URL(r.name).pathname.includes('/main-'))})`},
{eval:`document.querySelectorAll('.main-menu-actions button')[2].click(); ({link:document.querySelector('.menu-link').value})`},
{eval:`document.querySelector('.main-menu-page>.menu-button:last-child').click(); document.querySelectorAll('.main-menu-actions button')[1].click(); document.querySelector('.scenario-detail .menu-primary').click(); true`},
{wait:20000},
{eval:`(()=>{dispatchEvent(new Event('pagehide'));const save=localStorage.getItem('hrp-continue');sessionStorage.setItem('hrp-resume',save);setTimeout(()=>location.reload(),50);return {saved:!!save,playing:!document.getElementById('loading')};})()`},
{wait:12000},
{eval:`({home:document.querySelector('.main-menu')?.dataset.screen,enabled:!document.querySelector('.main-menu-actions button').disabled,session:!!sessionStorage.getItem('hrp-resume'),errors:window.__qaErrors})`},
{eval:`document.querySelector('.main-menu-actions button').click();true`},
{wait:15000},
{eval:`({playing:!document.getElementById('loading'),consumed:!sessionStorage.getItem('hrp-resume'),errors:window.__qaErrors})`}
],{menu:true,diagnostics:true,log:()=>{}});
console.log(JSON.stringify(results,null,2));
assert.equal(results[0].home,'home'); assert.equal(results[0].worldLoaded,false); assert.equal(results[0].errors.length,0);
assert(results[1].link.includes('g=0123456789abcdef01234567'));
assert(results[3].saved && results[3].playing);
assert.equal(results[4].home,'home'); assert(results[4].enabled && results[4].session);assert.equal(results[4].errors.length,0);
assert(results[6].playing && results[6].consumed);assert.equal(results[6].errors.length,0);
console.log('Production menu-first, deferred world loading, explicit new game, reload and Continue passed');
