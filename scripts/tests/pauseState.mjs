import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
registerHooks({load(url,ctx,next){if(!url.endsWith('/pauseState.ts'))return next(url,ctx);return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};}});
const {PauseState}=await import('../../src/game/pauseState.ts');
const changes=[];const p=new PauseState(v=>changes.push(v));
p.setWindow('tutorial',true);assert(p.paused);
p.setWindow('event',true);p.setWindow('tutorial',false);assert(p.paused,'Event still holds the clock');
p.setManual(true);p.setWindow('event',false);assert(p.paused,'Manual pause survives modal closure');
p.setManual(false);assert(!p.paused);assert.deepEqual(changes,[true,false]);
p.setWindow('event',true);p.setWindow('event',true);p.setManual(false);assert(p.paused);p.setWindow('event',false);assert(!p.paused,'Duplicate notifications do not leak pause owners');
const reasons=['tutorial','welcome','placement','detail','confirmation','event','report','queue','organisation'];
for(const reason of reasons)p.setWindow(reason,true);
for(const reason of [...reasons].reverse().slice(0,-1)){p.setWindow(reason,false);assert(p.paused);}
p.setWindow('tutorial',false);assert(!p.paused);
p.setWindow('organisation',true);p.setWindow('tutorial',true);p.setWindow('organisation',false);assert(p.paused,'Team review hands off to its next tutorial popup');p.setWindow('tutorial',false);assert(!p.paused);
p.setManual(true);for(const reason of reasons){p.setWindow(reason,true);p.setWindow(reason,false);assert(p.paused);}p.setManual(false);assert(!p.paused);
console.log('Independent popup ownership, overlap, manual intent, team/tutorial handoff and idempotent closure: passed');
