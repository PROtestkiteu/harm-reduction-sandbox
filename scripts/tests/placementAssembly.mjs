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

const { Group }=await import('three');
const { PlacementAssembly, PLACEMENT_SECONDS }=await import('../../src/world/placementAssembly.ts');
const home=new Group(), parent=new Group(), target=new Group();home.add(parent);parent.add(target);target.position.set(7,.2,-3);target.scale.set(1,1.2,1);
const fx=new PlacementAssembly(home);
assert(!fx.active);assert.equal(fx.update(1,false),false);
fx.start(target,false);assert(fx.active);assert(target.position.y<0);assert.equal(target.position.x,7);assert.equal(target.position.z,-3);
fx.update(PLACEMENT_SECONDS/2,false);assert(target.position.y<.2&&target.position.y>-3.6);
fx.update(PLACEMENT_SECONDS,false);assert(!fx.active);assert.equal(target.position.y,.2);assert.equal(target.scale.y,1.2);assert.equal(parent.children.length,1);
fx.start(target,true);assert(!fx.active);assert.equal(target.position.y,.2);
fx.start(target,false);fx.update(.1,false);fx.update(0,true);assert(!fx.active);assert.equal(target.position.y,.2);
fx.start(target,false);fx.start(target,false);fx.finish();assert.equal(target.position.y,.2);assert.equal(parent.children.length,1);
fx.dispose();assert.equal(home.children.length,1);
console.log('Placement assembly: bounded progress, unchanged curb coordinates, completion, interruption, reduced motion and idle cleanup passed.');
