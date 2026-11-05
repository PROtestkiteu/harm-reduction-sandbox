# Condensed character UI and HUD verification

Implemented 2026-11-04. This UI reads authoritative trait, skill, support and fit definitions. It introduces no balancing change or save migration. Separate recipient-care/reputation changes in the checkout were explicitly approved for the combined deployment.

## Current interaction model

- Settings and eleven direct layer controls share twelve equal cells on desktop/landscape. Portrait phones retain a labelled Map layers control. Gameplay branding is removed; the menu/splash branding remains.
- There is no Project/Panels launcher. The player portrait opens organisation/team controls. A selected person's portrait toggles their inspector.
- Services, Goals and Events are direct right-column modules. Their folds persist across routine updates. The tutorial objective lives in that column, separate from layer controls and legends.
- Selected-person inspectors show name, role, activity, labelled skills, traits/needs and conditions. Optional reference material stays folded. The archetype disclaimer is not applied to ordinary staff.
- Service inspectors retain status, occupancy, queue, staffing and stage even during tutorial. Existing tutorial permissions still govern actions. Later lesson metrics retain their existing gates.
- Staff rows reconcile by identity, keep assignment separate, expose one fit value and allow one expanded person.

## Validation

- Production build, TypeScript and translation audit passed. Polish, Spanish and Portuguese have zero missing or unused keys.
- Staff skills/matching/practice/save round-trip, staff identity, menu saves, tutorial progression/guards, tutorial map and camera regression tests passed.
- Roster fixture covered six sizes (320×568, 393×852, 430×932, 852×393, 768×1024, 1440×900), four languages and both themes: 48 combinations. Checked expansion, assignment focus, long names, empty roster, live traits, exhaustion, multiple needs and missing artwork. Measured normal rows: 115 px desktop / 123 px touch; translated rows stay within 144 px.
- Same-domain 100-worker fixture, 50 steady updates: previous roster 96.3 ms; revised 15.4 ms. This measures update CPU time, not game FPS. Rows and display values are cached; artwork decodes asynchronously.
- Icon hints: 24 checks passed. Independent pause/speed passed six viewport comparisons without increasing topbar height.
- Toolbar/panel checks covered desktop, tablet, phone and narrow landscape. Equal cells, alignment, direct layer selection, portrait/legend clearance and no horizontal overflow were checked.
- Final right-module regression passed at 1440×900, 393×852 and 568×320: no launcher, portrait opens organisation, Services opens/folds, Goals/Events retain fold state, service facts remain populated and selected staff have visible names/roles/four skills.
- Browser tutorial verifies camp/patrol, team review, direct dismissal, focus return, outreach unlocking and five visits progressing to drop-in. A final tutorial layout check verifies the objective is in the right column and all four service counters plus stage are visible in the first lesson. Full browser completion of every subsequent lesson remains unverified; pure tutorial tests cover those stages.

## Artwork

Nineteen original transparent painted miniatures were generated with built-in imagegen and exported at 64/128 px WebP. All 128 px files are below 16 KB. Masters are outside runtime assets. Frames, values and states remain CSS. Missing images display readable labels. Pending lazy images retain measurable geometry so the browser requests them; live mobile verification loaded 27 badge images.

See [prompts, master paths and runtime sizes](art/indicator-masters-v1/manifest.json).

## Hardware limitations

Current checks use browser emulation. Earlier device inspection in `touchscreen-checks.md` does not validate this revision. Older/newer iOS and Android phones still need browser/PWA checks for cutouts, navigation bars, dynamic browser chrome, keyboard, rotation, resume, theme switching and slow loading. Fullscreen permissions and actual safe-area publication require hardware verification.

More than 5 GB remained free throughout this work; latest check was approximately 7.5 GiB.
