// Shared presentation regression: real modules, domain data and CSS without scene startup.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,basename,extname} from 'node:path';
import {build} from 'vite';
import {drive} from './chrome.mjs';
const out=mkdtempSync(join(tmpdir(),'hrs-roster-')),source=resolve('src');
let original=execFileSync('git',['show','HEAD:apps/harm-reduction-sandbox/src/ui/orgPanel.ts'],{encoding:'utf8'});
original=original.replace(/from '(\.[^']+)'/g,(_,p)=>`from '${resolve(source,'ui',p)}'`).replace(/import '(\.[^']+)'/g,(_,p)=>`import '${resolve(source,'ui',p)}'`);
writeFileSync(join(out,'baseline.ts'),original);
writeFileSync(join(out,'entry.ts'),`
import '${source}/style.css';import '${source}/ui/panelControls.css';import '${source}/ui/uiIndicators.css';
import {loadCatalogue} from '${source}/i18n';
(async()=>{await loadCatalogue();const [{OrgPanel},{Team},{SERVICE_IDS},{Sheet},{OrgPanel:Baseline},{PersonSupportView}]=await Promise.all([import('${source}/ui/orgPanel'),import('${source}/sim/team'),import('${source}/sim/types'),import('${source}/ui/sheet'),import('./baseline'),import('${source}/ui/personSupport')]);
const team=new Team(777);team.sync(6,0);const assignments=[];const callbacks=new Proxy({onAssign(id,to){assignments.push([id,to]);team.members.find(m=>m.id===id).assignment=to;}},{get:(t,k)=>t[k]??(()=>{})});
const org=new OrgPanel(callbacks as any);org.setTeamAccess(SERVICE_IDS,true);org.showTeam();
const render=()=>org['updateTeam'](team);render();const sheet=new Sheet(document.getElementById('hud')!,org.section,{label:'Team'});sheet.setOpen(true);
const inspector=new PersonSupportView();document.getElementById('inspector')!.append(inspector.root);
Object.assign(window,{team,org,sheet,render,assignments,inspector,ready:true,benchmark(){const sample=new Team(123);sample.sync(60,40);const baseline=new Baseline(callbacks as any);baseline.setTeamAccess(SERVICE_IDS,true);const current=new OrgPanel(callbacks as any);current.setTeamAccess(SERVICE_IDS,true);for(let i=0;i<3;i++){baseline['updateTeam'](sample);current['updateTeam'](sample)}const measure=panel=>{const start=performance.now();for(let i=0;i<50;i++)panel['updateTeam'](sample);return performance.now()-start};return {members:100,iterations:50,beforeMs:measure(baseline),afterMs:measure(current)}}});})();`);
await build({configFile:false,build:{target:'es2022',lib:{entry:join(out,'entry.ts'),formats:['es'],fileName:()=> 'entry.js',cssFileName:'roster'},outDir:join(out,'assets'),emptyOutDir:true,minify:false}});
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const asset=path.startsWith('/indicators/')||path.startsWith('/portraits/')?join(resolve('public'),path):join(out,'assets',basename(path));
 if(path!=='/'&&existsSync(asset)){res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'})[extname(asset)]??'application/octet-stream');res.end(readFileSync(asset));return;}
 if(path!=='/'){res.statusCode=404;res.end();return;}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/roster.css"><div id="hud"></div><div id="inspector" hidden></div><script type="module" src="/entry.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 for(const lang of (process.env.ROSTER_LANGS??'en,pl,es,pt').split(','))for(const theme of (process.env.ROSTER_THEMES??'dark,light').split(',')){
  const steps=[{eval:`(async()=>{for(let i=0;i<3000&&!window.ready;i++)await new Promise(r=>setTimeout(r,20));if(!window.ready)throw Error('Fixture not ready: '+JSON.stringify(window.__qaErrors??[]));await document.fonts.ready;for(const image of document.querySelectorAll('.compact-member img'))image.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));return true})()`}];
  if(lang==='en'&&theme==='dark')steps.push({eval:`(()=>{const heads=[...document.querySelectorAll('.member-disclosure')];heads[0].click();heads[1].click();if(heads[0].getAttribute('aria-expanded')!=='false'||heads[1].getAttribute('aria-expanded')!=='true')throw Error('Only one worker may expand');const select=document.querySelector('.team-assign');select.focus();const row=select.closest('li');team.members[0].traits.push('new');render();if(document.querySelector('.team-assign')!==select||!row.isConnected)throw Error('Live update rebuilt row');select.value='rest';select.dispatchEvent(new Event('change'));render();if(assignments.length!==1)throw Error('Assignment action');team.members[0].traits=team.members[0].traits.filter(t=>t!=='new');render();if(row.querySelector('[data-indicator="trait:new"]'))throw Error('Stale learning badge');const image=row.querySelector('.indicator img');image.dispatchEvent(new Event('error'));const label=image.parentElement.querySelector('.indicator-label');if(!image.hidden||!label.getClientRects().length)throw Error('Missing image fallback');image.dispatchEvent(new Event('load'));heads[1].click();const originalName=team.members[0].name;team.members[0].name='Aleksandra de Albuquerque van der Wouden';render();if(document.querySelector('.sheet .sandbox-body').scrollWidth>document.querySelector('.sheet .sandbox-body').clientWidth+1)throw Error('Long name overflow');team.members[0].name=originalName;const energy=team.members[0].energy,morale=team.members[0].morale;team.members[0].energy=0;team.members[0].morale=0;render();if(row.querySelectorAll('.condition-strip [data-low=true]').length!==2)throw Error('Low condition lost');team.members[0].energy=energy;team.members[0].morale=morale;render();return benchmark()})()`});
  for(const [width,height]of [[320,568],[393,852],[430,932],[852,393],[768,1024],[1440,900]])steps.push(
   {cdp:'Emulation.setDeviceMetricsOverride',params:{width,height,deviceScaleFactor:1,mobile:width<768}},{cdp:'Emulation.setTouchEmulationEnabled',params:{enabled:width<1100}}, {wait:100},
   {eval:`(()=>{const rows=[...document.querySelectorAll('.compact-member')],body=document.querySelector('.sheet .sandbox-body');const rect=body.getBoundingClientRect();const heights=rows.slice(0,3).map(r=>r.getBoundingClientRect().height);const visible=rows.filter(r=>{const b=r.getBoundingClientRect();return b.top>=rect.top&&b.bottom<=rect.bottom}).length;if(document.documentElement.scrollWidth>innerWidth||body.scrollWidth>body.clientWidth+1)throw Error('Overflow '+innerWidth);if(innerWidth===393&&visible<3)throw Error('Fewer than three summaries '+JSON.stringify({heights,rect,visible}));if(Math.max(...heights)> (matchMedia('(pointer:coarse)').matches?144:116))throw Error('Roster too tall '+JSON.stringify({heights,size:innerWidth}));return {size:[innerWidth,innerHeight],heights,visible}})()`},
   {shot:`${lang}-${theme}-${width}x${height}.png`}
  );
  steps.push({eval:`(()=>{sheet.setOpen(false);document.getElementById('inspector').hidden=false;inspector.set({substance:'opioid',injects:true,needs:['housing','wound'],skills:['care','coordination']},{service:'Drop-in',matches:'Alex',crew:'Alex'});const needs=document.querySelectorAll('.support-strip .indicator');if(needs.length!==3)throw Error('Support needs lost');if(document.querySelector('.person-summary .person-team'))throw Error('Duplicate unnumbered action');const detail=document.querySelector('.person-support-details');if(detail.open)throw Error('Details should start folded');detail.open=true;team.members.length=0;render();if(document.querySelectorAll('.compact-member').length)throw Error('Empty roster stale');return {support:needs.length,empty:true}})()`});
  const result=await drive(`http://127.0.0.1:${server.address().port}/?lang=${lang}`,steps,{out,size:'393x852',settle:1000,touch:true,colorScheme:theme,diagnostics:true,log:(...args)=>{if(args.join(' ').toLowerCase().includes('error'))console.error(...args)}});
  for(const r of result)if(r?.beforeMs) {console.log('benchmark',JSON.stringify(r));assert(r.afterMs<r.beforeMs*1.5+5,'Steady update regression');}
  console.log(lang,theme,JSON.stringify(result.filter(r=>r?.size)));
 }
 console.log('Roster, inspector, assignment, fallback layouts: passed. Artifacts:',out);
}finally{server.close();}
