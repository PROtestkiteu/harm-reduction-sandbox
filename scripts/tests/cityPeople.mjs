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



const { ChaosDaemon } = await import('../../src/sim/chaosDaemon.ts');
const { CityPeople, restoreCityAppearance } = await import('../../src/agents/cityPeople.ts');
const { Group } = await import('three');
const look = { style: 'everyday', height: 1.75, build: 1, skin: 123, hair: 12, top: 234, bottom: 345, accent: 456, hairStyle: 2, extra: 'none', staff: false, kit: {} };
assert.equal(restoreCityAppearance(JSON.stringify(look)).skin, look.skin);
assert.equal(restoreCityAppearance('{bad'), undefined);
assert.equal(restoreCityAppearance(JSON.stringify({...look,height:999})), undefined);
const people = new CityPeople();
people.add(-1000, look);
people.add(-1001, { ...look, police: true }, 'police');
people.add(-1002, { ...look, height: 1.2 });
people.update(-1000, 10, 0, 12, true, true);
people.update(-1001, 11, 0, 12, true, true);
people.update(-1002, 12, 0, 12, true, true);
assert.deepEqual(people.crisisCandidates().map(p => p.id), [-1000]);
// Mesh detail affects picking only, never the logical crisis pool.
people.update(-1000, 10, 0, 12, false, true, undefined, true);
assert.equal(people.person(-1000), undefined);
assert.deepEqual(people.crisisCandidates().map(p => p.id), [-1000]);
const daemon = new ChaosDaemon(777);
const baseline = new ChaosDaemon(777);
daemon.setCandidates(() => people.crisisCandidates());
let arrived = false;
for (let now = 1; now < 20000; now++) {
  const inp = { street: 1, crisis: 1, nights: 2 };
  assert.deepEqual(daemon.tick(1, now, inp), baseline.tick(1, now, inp), 'Identity must not alter crisis rolls');
  assert.equal(daemon.active, baseline.active);
  if (!daemon.active) continue;
  assert.equal(daemon.person.id, -1000);
  const saved = daemon.snapshot();
  const loaded = new ChaosDaemon(); loaded.restore(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(loaded.snapshot(), saved);
  const figure = { root: new Group(), look };
  people.beginCrisis(-1000, figure);
  assert.equal(people.person(-1000).root, figure.root);
  people.update(-1000, 99, 0, 99, false, true);
  assert.equal(people.person(-1000).root, figure.root, 'Source cannot overwrite crisis identity');
  assert.equal(people.person(-1000).crisis, true);
  people.endCrisis();
  assert.equal(people.person(-1000), undefined);
  people.update(-1000, 10, 0, 12, true, true);
  assert.equal(people.person(-1000), undefined, 'No immediate duplicate after crisis ends');
  people.update(-1000, 10, 0, 12, false, false);
  people.update(-1000, 10, 0, 12, true, true);
  assert.equal(people.person(-1000).crisis, false);
  loaded.restore({ since: null, person: { id: -1000, x: 1, z: 2 } });
  assert.equal(loaded.person, null);
  loaded.restore({ since: 1, person: { id: 2, x: 1, z: 2 } });
  assert.equal(loaded.person, null);
  arrived = true; break;
}
assert(arrived);
// Async source registration after restoring an active crisis must remain one person.
const lazy = new CityPeople(); const root = new Group();
lazy.beginCrisis(-12000, { root, look }); lazy.add(-12000, look);
assert.equal(lazy.person(-12000).root, root);
assert.equal(lazy.person(-12000).crisis, true);
console.log('PASS city identities, quality-independent crisis candidates, unchanged crisis rolls, save/restore, duplicate guards and late source registration');

const { Simulation } = await import('../../src/sim/simulation.ts');
const { captureSave, parseSave, applySave } = await import('../../src/game/saveGame.ts');
const original = new Simulation(777);
original.daemon.restore({since: 1, person: {id:-1000,x:10,z:12,identity:JSON.stringify(look)}});
const saved = parseSave(JSON.parse(JSON.stringify(captureSave(original, 'City identity'))));
assert(saved);
const loaded = new Simulation(991); applySave(loaded, saved);
assert.deepEqual(loaded.daemon.snapshot(), original.daemon.snapshot());
assert.equal(restoreCityAppearance(loaded.daemon.person.identity).skin, look.skin);
console.log('PASS full game save envelope retains crisis identity and appearance');
