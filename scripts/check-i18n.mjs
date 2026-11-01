// Checks the catalogues (Polish, Spanish, Portuguese) against the source.
//   node scripts/check-i18n.mjs . [file filter substring] [--unused]
// Reports t() keys missing from each catalogue (and, for Spanish and Portuguese, the English plural()
// forms they look up), placeholder mismatches, em dashes, and template literals passed to t().
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
const app = process.argv[2];
const filter = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : '';
const src = join(app, 'src');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const strLit = String.raw`'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"`;
const unq = (s) => (s[0] === "'" ? JSON.parse('"' + s.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"') : JSON.parse(s));
const pairRe = new RegExp(`(${strLit})\\s*:\\s*(${strLit})`, 'g');
const read = (file) => {
  const cat = new Map();
  if (existsSync(file)) for (const m of readFileSync(file, 'utf8').matchAll(pairRe)) cat.set(unq(m[1]), unq(m[2]));
  return cat;
};
const CATS = { pl: read(join(src, 'i18n/pl.ts')), es: read(join(src, 'i18n/es.ts')), pt: read(join(src, 'i18n/pt.ts')) };

// What the source asks for: t() keys, and the English forms of plural() calls.
const keyRe = new RegExp(`\\bt\\(\\s*(${strLit})`, 'g');
const pluralRe = new RegExp(`\\bplural\\([^,]+,\\s*\\[\\s*(${strLit})\\s*,\\s*(${strLit})\\s*\\]`, 'g');
const tplRe = /\bt\(\s*`/g;
const tKeys = new Map();
const pluralKeys = new Map();
let bad = 0;
for (const f of walk(src)) {
  if (f.includes('/i18n/')) continue;
  const rel = relative(app, f);
  if (filter && !rel.includes(filter)) continue;
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(tplRe)) { console.log(`TEMPLATE  ${rel}: t(\` at ${m.index}`); bad++; }
  for (const m of text.matchAll(keyRe)) tKeys.set(unq(m[1]), rel);
  for (const m of text.matchAll(pluralRe)) { pluralKeys.set(unq(m[1]), rel); pluralKeys.set(unq(m[2]), rel); }
}

const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(',');
for (const [lang, cat] of Object.entries(CATS)) {
  if (!cat.size && lang !== 'pl') { console.log(`${lang}: no catalogue`); continue; }
  const wanted = lang === 'pl' ? tKeys : new Map([...tKeys, ...pluralKeys]);
  let missing = 0;
  for (const [k, rel] of wanted) {
    if (!cat.has(k)) { console.log(`MISSING   ${lang} ${rel}: ${k}`); missing++; continue; }
    if (ph(k) !== ph(cat.get(k))) { console.log(`PLACEHOLD ${lang} ${rel}: ${k}  =>  ${cat.get(k)}`); bad++; }
  }
  for (const [k, v] of cat) if (/—/.test(v) || /—/.test(k)) { console.log(`EMDASH    ${lang} ${k} => ${v}`); bad++; }
  const unused = filter ? [] : [...cat.keys()].filter((k) => !wanted.has(k));
  console.log(`${lang}: catalogue ${cat.size} entries, ${missing} missing, unused ${unused.length}`);
  if (process.argv.includes('--unused')) unused.forEach((k) => console.log(`UNUSED    ${lang} ${k}`));
  bad += missing;
}
console.log(`${tKeys.size} t() keys, ${pluralKeys.size} plural forms; ${bad} problems`);
process.exitCode = bad ? 1 : 0;
