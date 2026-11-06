/** Locale selection, interpolation and Ukrainian grammar against real catalogues. */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL && new URL(context.parentURL).pathname.endsWith('.ts') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!new URL(url).pathname.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
  },
});
let revision = 0;
async function locale({ query = '', stored = null, languages = ['en-GB'], blocked = false } = {}) {
  globalThis.location = new URL(`https://example.test/${query}`);
  globalThis.localStorage = { getItem: () => { if (blocked) throw Error('blocked'); return stored; } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { languages } });
  const mod = await import(`../../src/i18n/index.ts?test=${++revision}`);
  await mod.loadCatalogue();
  return mod;
}
const uk = await locale({ query: '?lang=uk-UA', stored: 'pl', languages: ['es'] });
assert.equal(uk.LANG, 'uk');
assert.equal(uk.LOCALE, 'uk-UA');
assert(uk.LANGS.some(l => l.id === 'uk' && l.name === 'Українська'));
assert.equal(uk.t('Drug checking'), 'Перевірка речовин');
assert.equal(uk.t('{n} of {all}', { n: 1, all: 2 }), '1 / 2', 'Tutorial page count must not resemble 1 3 2');
assert.equal(uk.t('Recipients: {n}', { n: 7 }), 'Отримувачі допомоги: 7');
assert.equal(uk.t('Uncatalogued {value}', { value: 'fallback' }), 'Uncatalogued fallback');
const { UK, UK_PLURALS } = await import('../../src/i18n/uk.ts');
const placeholders = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
for (const [key, value] of Object.entries(UK)) {
  assert.deepEqual(placeholders(value), placeholders(key), key);
  assert(!/ZXQ\d+QXZ|§§§/.test(value), key);
}
for (const [key, forms] of Object.entries(UK_PLURALS)) {
  assert.equal(forms.length, 4, key);
  for (const form of forms) assert.deepEqual(placeholders(form), [...new Set([...placeholders(key), 'n'])].sort(), key);
}
for (const [n, noun] of [[0,'людей'],[1,'людина'],[2,'людини'],[4,'людини'],[5,'людей'],[11,'людей'],[12,'людей'],[14,'людей'],[21,'людина'],[22,'людини'],[25,'людей'],[101,'людина'],[-1,'людина'],[1.5,'людини']]) {
  assert.equal(uk.plural(n, ['{n} person','{n} people'], ['osoba','osoby','osób']), `${n} ${noun}`);
}
assert.equal((await locale({ stored: 'uk' })).LANG, 'uk');
assert.equal((await locale({ languages: ['uk-UA'], blocked: true })).LANG, 'uk');
assert.equal((await locale({ query: '?lang=pl', stored: 'uk' })).LANG, 'pl');
assert.equal((await locale({ languages: ['zz'] })).LANG, 'en');
for (const lang of ['pl','es','pt']) {
  const mod = await locale({ query: `?lang=${lang}` });
  assert.notEqual(mod.t('Settings'), 'Settings');
  assert(!mod.plural(2, ['{n} person','{n} people'], ['{n} osoba','{n} osoby','{n} osób']).includes('{n}'));
}
console.log(`Locale precedence, fallback, interpolation, ${Object.keys(UK).length} entries, ${Object.keys(UK_PLURALS).length} plural families and existing-language sanity passed`);
