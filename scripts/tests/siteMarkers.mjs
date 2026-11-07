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

const { Group, Raycaster, Vector3, Color } = await import('three');
const { SiteMarkers, PLACEMENT_COLORS } = await import('../../src/world/siteMarkers.ts');
const parent=new Group();
const footprints=Array.from({length:100},(_,i)=>({x:i*10,z:0,width:5,depth:5,height:i%2?8:.12,rotation:i%2?Math.PI/2:0}));
for(let run=0;run<3;run++){
 const markers=new SiteMarkers(parent,footprints);parent.updateMatrixWorld(true);
 assert.equal(markers.targets.length,100);
 let visible=0;parent.traverse(o=>{if((o.isMesh||o.isLineSegments)&&o.material.visible)visible++});
 assert.equal(visible,3,'all sites share three render batches');
 const ray=new Raycaster(new Vector3(0,100,0),new Vector3(0,-1,0));
 assert(ray.intersectObject(markers.targets[0].root,true).length>0,'invisible hit proxy remains pickable');
 const volumes=parent.children[0].children.find(o=>o.isInstancedMesh&&o.geometry.type==='BoxGeometry');
 const color=new Color();volumes.getColorAt(0,color);assert.equal(color.getHex(),PLACEMENT_COLORS.available);
 markers.select(0);volumes.getColorAt(0,color);assert.equal(color.getHex(),PLACEMENT_COLORS.selected);
 markers.select(50);volumes.getColorAt(0,color);assert.equal(color.getHex(),PLACEMENT_COLORS.available);markers.select(null);
 let disposed=0;const owned=new Set();parent.traverse(o=>{if(o.geometry)owned.add(o.geometry);if(o.material)owned.add(o.material)});
 for(const resource of owned)resource.addEventListener('dispose',()=>disposed++);
 markers.dispose();assert.equal(parent.children.length,0);assert.equal(disposed,owned.size);
}
console.log('Map placement: 100 sites in three render batches, pickable proxies, selection changes and resource cleanup across repeated sessions passed.');
const { ScenePicker }=await import('../../src/ui/picking.ts');
const { registerBuilding }=await import('../../src/world/cityBuildings.ts');
const { LOCATION_IDS }=await import('../../src/sim/types.ts');
const { OrthographicCamera }=await import('three');
const camera=new OrthographicCamera(-10,10,10,-10,.1,100);camera.position.set(0,10,20);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
const markers=new SiteMarkers(parent,[{x:0,z:0,width:5,depth:5,height:4,rotation:0}]);
const picker=new ScenePicker(Object.fromEntries(LOCATION_IDS.map(id=>[id,{root:new Group()}])),{});
const frame={cssW:100,cssH:100,dpr:1,factor:1,lowW:100,lowH:100};
assert.equal(picker.pickAmong(50,50,camera,frame,markers.targets,true),0);
registerBuilding(-4,4,8,12,12);
assert.equal(picker.pickAmong(50,50,camera,frame,markers.targets,true),null,'foreground buildings block hidden sites');
assert.equal(picker.pickAmong(50,50,camera,frame,markers.targets),0,'legacy camper placement keeps its existing picking contract');
markers.dispose();
console.log('Map occlusion rejects sites behind foreground buildings; legacy placement picking remains unchanged.');
