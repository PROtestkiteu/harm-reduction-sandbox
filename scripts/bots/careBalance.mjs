/** Deterministic domain and simulation regression checks, without a browser or renderer. */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

registerHooks({
  resolve(specifier, context, next) {
    if ((specifier.startsWith('.') || specifier.startsWith('/')) && context.parentURL?.endsWith('.ts') && !/\.[a-z]+$/i.test(specifier)) {
      const base = new URL(specifier, context.parentURL);
      const candidate = [`${base.href}.ts`, `${base.href}/index.ts`].find((url) => existsSync(fileURLToPath(url)));
      if (candidate) return { url: candidate, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
  },
});

/** Fast deterministic capacity/quality bot against production domain code; no renderer or clinical claims. */
const { RecipientCare, visitScore, careUrgency, patience } = await import('../../src/sim/recipientCare.ts');
const { RECIPIENT_NEED_IDS, RECIPIENT_NEEDS, CARE } = await import('../../src/config/recipientNeeds.ts');
const { mkdirSync, writeFileSync } = await import('node:fs');
const out=process.argv[2]??'/tmp/hrs-care-cohorts';mkdirSync(out,{recursive:true});
const results=[];
for(const arrivalMinutes of [6,15,20]) for(const distribution of ['uniform','weighted']) for(const strategy of ['volunteers','generalists','specialists','triaged','noSupplies']) for(const seed of [77,777,7777]) {
  let rng=seed;const random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/2**32);
  const care=new RecipientCare();
  const sites=['specialists','triaged'].includes(strategy)?['outreach','dropIn','clinic','drugChecking','shelter']:['outreach'];
  const workers=Array.from({length:5},(_,i)=>({id:i+1,name:`Worker ${i+1}`,paid:strategy!=='volunteers',traits:['specialists','triaged'].includes(strategy)?[['social'],['psychologist'],['nurse'],['chemist'],['social']][i]:[],energy:1,workingAt:sites[i%sites.length]}));
  const used={kits:0,leaflets:0};
  const env={workers,open:s=>sites.includes(s),equipment:['specialists','triaged'].includes(strategy),checking:true,has:()=>strategy!=='noSupplies',use:s=>{used[s]++;return true;},timeFactor:()=>1};
  let arrivals=0,finished=0,unrated=0,points=0,duration=0,scoreSum=0,queuePeak=0;const ratings={none:0,bronze:0,silver:0,gold:0};const born=new Map();
  let nextArrival=0;const n=240;const minutes=n*arrivalMinutes+1440;const start=performance.now();
  function end(v,now) { const score=visitScore(v);const rating=care.finish(v.visitor);ratings[rating]++;finished++;if(rating==='none')unrated++;scoreSum+=score;duration+=now-born.get(v.visitor); }
  for(let now=0;now<minutes;now+=.5){
    if(now>=nextArrival && arrivals<n){
      const id=++arrivals;const r=random();const count=distribution==='uniform'?1+Math.floor(r*5):r<.45?1:r<.7?2:r<.85?3:r<.95?4:5;
      const ids=[];while(ids.length<count){const candidate=RECIPIENT_NEED_IDS[Math.floor(random()*RECIPIENT_NEED_IDS.length)];if(!ids.includes(candidate))ids.push(candidate);}
      const urgent=ids.slice().sort((a,b)=>RECIPIENT_NEEDS[b].urgency-RECIPIENT_NEEDS[a].urgency)[0];const entry=strategy==='triaged'?(workers.find(w=>w.traits.includes(RECIPIENT_NEEDS[urgent].specialist))?.workingAt??'outreach'):'outreach';care.ensure(id,entry,ids);born.set(id,now);nextArrival=now+arrivalMinutes;
    }
    for(const site of sites){
      for(const id of care.tick(site,.5,env)) {const v=care.visits.get(id);if(v.phase==='transfer'&&v.destination){care.arrive(id,v.destination);}else end(v,now);}
      const capacity=workers.filter(w=>w.workingAt===site).length;
      let active=[...care.visits.values()].filter(v=>v.site===site&&v.phase==='active').length;
      const queue=[...care.visits.values()].filter(v=>v.site===site&&v.phase==='queued').sort((a,b)=>careUrgency(b)-careUrgency(a)||a.visitor-b.visitor);
      queuePeak=Math.max(queuePeak,queue.length);
      for(const v of queue){if(active<capacity){care.activate(v.visitor);active++;}else{v.waited+=.5;if(v.waited>=patience(v)){v.escalated=true;end(v,now);}}}
    }
  }
  const row={arrivalMinutes,distribution,strategy,seed,arrivals,finished,unfinished:care.visits.size,ratings,score:+(scoreSum/finished).toFixed(2),visitMinutes:+(duration/finished).toFixed(1),queuePeak,used,cpuMs:+(performance.now()-start).toFixed(1)};
  assert.equal(finished,n,'all visits must terminate');assert.equal(care.visits.size,0,'no stranded transfers');
  results.push(row);
}
writeFileSync(`${out}/cohorts.json`,JSON.stringify(results,null,2));
console.table(results.map(r=>({...r,ratings:JSON.stringify(r.ratings),used:JSON.stringify(r.used)})));
console.log(`Full results: ${out}/cohorts.json`);
