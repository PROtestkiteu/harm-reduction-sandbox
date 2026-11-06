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


const { Simulation } = await import('../../src/sim/simulation.ts');
const { ORG } = await import('../../src/config/organisation.ts');
const sim = new Simulation(777);
sim.start();
let shut;
const tick = sim.stakes.tick.bind(sim.stakes);
sim.stakes.tick = (dt, at) => { shut = at.shut; return tick(dt, at); };
for (const id of ['drugChecking', 'shelter', 'clinic']) sim.closeDownPlace(id);
sim.tick(1 / 30);
assert.equal(shut, false, 'Closing optional services must not count as losing the starting project');
for (const id of ORG.startServices.slice(0, 2)) sim.closeDownPlace(id);
sim.tick(1 / 30);
assert.equal(shut, false, 'One remaining starting service keeps the project open');
sim.closeDownPlace(ORG.startServices.at(-1));
sim.tick(1 / 30);
assert.equal(shut, true, 'Closing every starting service starts the existing failure timer');
console.log('Scenario closure regression passed: optional closures, partial and complete starting-service closure');
