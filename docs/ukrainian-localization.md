# Ukrainian interface

Ukrainian uses the standard language tag `uk` and formatting locale `uk-UA`.
Select **Українська** in Settings, use `?lang=uk`, or set Ukrainian in the browser's language preferences. The existing priority remains URL, saved setting, browser preferences, English fallback. Catalogues remain separate lazy-loaded chunks; no translation service runs in the app.

Terminology references consulted on 2026-11-06:

- Current DrugsPRO checkout (`9739ba6a66b`), `scriptsPRO/i18n/i18n_cache/ui-i18n.uk.cache.json` and `drugspro-web/public/media/i18n/uk/`. Matching source strings were reused, with contextual corrections for this game (for example, About means «Про гру»). No scientific dataset was copied or replaced.
- [Drugstore: checking and harm reduction](https://blog.drugstore.org.ua/uk/blog/drugs/drugchecking-news): «зменшення шкоди», «психоактивні речовини», «перевірка … речовин» and support without judgement.
- [Drugstore consultations](https://drugstore.org.ua/uk/consultants): support-focused wording, consultation and psychological support.
- [Drugstore research on Ukrainian ravers](https://blog.drugstore.org.ua/uk/blog/narkotiki/vzhivannya-par-sered-ukrayinskikh-reyveriv-ezultati-doslidzhennya): recreational substance use and checking terminology.

The organisation's materials are at **drugstore.org.ua**; `drugstore.ua` was not accessible. These references guide wording and do not imply endorsement. Catalog entries are translations of the game's existing statements, not new evidence or medical guidance. Research scope and simulation limitations remain in the scenario descriptions.

Use «перевірка речовин» for drug checking, «аутріч» for outreach, «низькопороговий центр» for drop-in centre, «люди, які вживають наркотики» for people who use drugs, and «перенаправлення» for referrals. Avoid language that treats substance checking as a drug test on a person. Core service, support, tutorial and scenario copy was manually refined after a Google Translate draft; the longer narrative catalogue still needs a native Ukrainian editorial pass.

`UK_PLURALS` contains one/few/many/other forms for every source plural family. A single `Intl.PluralRules('uk')` instance is created when the catalogue loads, covering 1/21, 2–4/22–24, 0/5–20 and fractional counts. The Polish and English plural conventions remain unchanged. Loading phrases and retry/error messages are kept in the entry module so startup failures can show Ukrainian recovery without a loaded catalogue; a catalogue-only download failure retains the existing English fallback. Cyrillic fonts use `font-display: swap` and Unicode ranges.

Validation commands (from the sandbox directory):

```sh
node scripts/check-i18n.mjs .
node scripts/tests/i18n.mjs
npm run typecheck
npm run build -- --outDir /tmp/hrs-uk-build
node scripts/bots/ukrainian.mjs http://127.0.0.1:5237/
```

Serve `/tmp/hrs-uk-build` locally on port 5237 before running the browser command. The browser check uses the canonical Chrome driver. It covers translated menu/settings, Ukrainian selection persistence, desktop/mobile game layout, reduced motion, light/dark themes and localised module-startup failure/retry. Headset and physical phone behavior require separate device validation.

## Validation record (2026-11-06)

Trigger: Ukrainian was absent from language selection and browser detection, and English-style plural lookup cannot express Ukrainian count forms.

- Catalog checker: 2,389 source `t()` keys and 39 English plural forms; no missing entries or placeholder errors in any language. Ukrainian has 2,430 entries and 21 complete plural families.
- Locale regression: URL/storage/browser precedence, blocked storage, English fallback, interpolation, Ukrainian integer/decimal plurals and Polish/Spanish/Portuguese sanity passed.
- Save/menu launch regressions and repository/archive integrity passed.
- TypeScript and production build passed. The build retains a large-main-chunk warning; Ukrainian is a separate lazy-loaded chunk.
- Production browser checks passed for menu/settings persistence, scenarios, desktop/mobile game layout, light/dark themes, reduced motion and Ukrainian startup-module failure/retry. The browser regression uses the canonical Chrome driver against the isolated `/tmp/hrs-uk-build` output (served locally on port 5237). No shared build output or running user process is replaced.
- No headset or physical phone tests were performed. No native platform or SDK compatibility claim is made.

The welcome-dialog page counter uses `{n} / {all}` in Ukrainian: the small letter «з» in «1 з 2» resembled the numeral 3. The locale regression explicitly checks `1 / 2`.
