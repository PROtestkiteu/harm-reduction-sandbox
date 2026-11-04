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
    if (url.endsWith('/agents/character.ts')) return {format:'module',shortCircuit:true,source:'export class CharacterRig{}; export const randomAppearance=()=>({});'};
    if (url.endsWith('/agents/humanFigure.ts')) return {format:'module',shortCircuit:true,source:'export class HumanFigure{}; export const peopleLibrary=()=>null;'};
    if (!url.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
  },
});
globalThis.location = { search: '?lang=pl' };
const { loadCatalogue } = await import('../../src/i18n/index.ts');
await loadCatalogue();
const { memberTraitLabel } = await import('../../src/ui/personWording.ts');
const { portraitId } = await import('../../src/render/portraitLibrary.ts');
for (const [name, label, portrait] of [
  ['Dmytro', 'Pielęgniarz', 'office'],
  ['Dmytro 41', 'Pielęgniarz', 'office'],
  ['Mia', 'Pielęgniarka', 'outreach'],
  ['Noor', 'Osoba z kwalifikacjami pielęgniarskimi', 'outreach'],
]) {
  assert.equal(memberTraitLabel({ name }, 'nurse'), label);
  assert.equal(portraitId({ role: 'staff', archetype: 'everyday', worker: { name } }), portrait);
}
assert.equal(portraitId({ role: 'police', archetype: 'everyday' }), 'police');
assert.equal(portraitId({ role: 'visitor', archetype: 'student' }), 'student');
console.log('Staff wording and portrait identity, legacy names and NPC fallback: passed.');
