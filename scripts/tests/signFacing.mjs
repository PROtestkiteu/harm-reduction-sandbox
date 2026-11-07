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

globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})};
const { Vector3, Group }=await import('three');
const { buildFootPatrol }=await import('../../src/world/places.ts');
const { Expansion }=await import('../../src/world/expansion.ts');
const { PATROL, CAMPER_SPOTS }=await import('../../src/world/layout.ts');
const { ServiceHosting }=await import('../../src/world/serviceHosting.ts');
const loc=buildFootPatrol();loc.setServiceLevel(1);loc.update(10,0);
assert(loc.roofSign);assert.equal(loc.roofSign.name,'footPatrolSign');
const parent=loc.roofSign.parent, count=loc.root.children.length;
const expansion=new Expansion(loc.root,0x2e7d6b,'sign','+x',loc.roofSign);
assert.equal(loc.roofSign.parent,parent);assert.equal(loc.root.children.length,count+1,'only staffing sandwich board may be added');
const face=new Vector3(), visitors=new Vector3();
function checkFacing(){
 loc.root.updateMatrixWorld(true);
 face.set(0,0,1).transformDirection(loc.roofSign.matrixWorld);
 visitors.set(PATROL.served[0].x-PATROL.staff[0].x,0,PATROL.served[0].z-PATROL.staff[0].z).normalize();
 assert(face.dot(visitors)>.999,'text must face the people receiving service');
 const back=loc.roofSign.geometry.groups.find(g=>g.start===30);
 assert.equal(back.materialIndex,1,'rear face must carry readable text too');
}
checkFacing();
const hosting=new ServiceHosting({footPatrol:loc});
for(let id=0;id<CAMPER_SPOTS.length;id++){hosting.set('footPatrol',{kind:'curb',id});checkFacing();}
hosting.set('footPatrol',{kind:'original'});checkFacing();
for(const still of [false,true]){
 expansion.setStill(still);expansion.set(0,1,false);expansion.update(3);assert(!loc.roofSign.visible);
 expansion.set(0,0,true);expansion.update(3);assert(loc.roofSign.visible);checkFacing();
}
for(const [front,direction] of [['+x',[1,0,0]],['-x',[-1,0,0]],['+z',[0,0,1]],['-z',[0,0,-1]]]){
 const root=new Group();new Expansion(root,0x2e7d6b,'sign',front);
 root.updateMatrixWorld(true);
 const sign=root.children[0];face.set(0,0,1).transformDirection(sign.matrixWorld);
 assert(face.dot(new Vector3(...direction))>.999);
 const board=sign.children.find(c=>c.isMesh&&Array.isArray(c.material));
 assert(board.material[1].map,'fallback signs must contain lettering');
}
console.log('Sign facing: every curb, original restoration, front/back lettering, single authored board, opening/closing, reduced motion, and all fallback facings passed.');
