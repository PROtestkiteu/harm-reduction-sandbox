# Dev bots and checks

Headless Chrome tools that drive the dev page through `window.__sandbox` (dev only, stripped from
builds). They need `npm run dev` running and Google Chrome installed (`CHROME=` to point elsewhere).
Nothing here is imported by the game, so none of it reaches `dist/`.

| Script | What it does |
|---|---|
| `tutorialCopy.mjs [dev-url] [outDir]` | All 15 tutorial briefing/recovery paths and their control states in EN/PL/ES/PT/UK at desktop/phone sizes; expanded explanations and collapsed hints stay separate. |
| `servicePlacementAudit.mjs [dev-url] [--baseline]` | All seven unplaced services, cancelled previews, chosen buildings/curbs while paused, desktop/touch bounds and render probe. `SIZE=393x852` uses touch. |
| `dropInPresentation.mjs [dev-url] [--baseline]` | Unplaced neutral drop-in home, cancelled placement, selected building frontage visible while time is paused, no false visits, desktop/touch screenshots and canonical render probe. |
| `run-bots.mjs` | Balance: idle, hoarder, spammer, sensible and greedy bots on the real sim for N game days, same seed each; money, meters, first red meter, game over. `--speed 3` repeats at another clock speed. |
| `perf.mjs` | Frame cost: JavaScript ms per frame and draw calls, flavour packs off and on, same seeded city. |
| `edges.mjs` | Traffic edges: the widest views at each corner tilted low, the junctions, the river and the level crossing, watching every tagged mover (`userData.mover`). Fails when a vehicle, boat, aircraft or the train appears, vanishes or jumps on screen, a road vehicle stands inside a building, two registered vehicles overlap, or one stands still for 40 s. `--clock` sets the hour. |
| `clearance.mjs` | Flavour props and standing spots against the crowd's walking lines and buildings, over several launches. |
| `desktopPanels.mjs [url] [outDir]` | Desktop Settings/tutorial clearance, shared team and organisation sheets centered in the full viewport, wrapped-header resizing, Settings scroll bounds, Escape focus return, and mobile sanity. |
| `cameraPanelStability.mjs [dev-url]` | Camera projection remains unchanged when Settings and organisation windows open and close at desktop, phone portrait and landscape sizes. Captures runtime errors and screenshots. |
| `menuLaunch.mjs [url]` | Production-preview regression: menu first even with launch/link parameters, deferred world import, saved-link prefill, explicit New Game, reload with update snapshot, and explicit Continue. Point at a production preview, not Vite dev. |
| `tutorialPatrolContinue.mjs [url] [outDir]` | Real paused first dispatch, reopening an active patrol, enabled Continue, frozen reading, touch resume and actual patrol return to the next lesson. |
| `popupPause.mjs [url] [outDir]` | Tutorial/welcome time freeze, fold/reopen, manual pause preservation and desktop/mobile clock progress; development also checks major event results, overlap and stale close events. |
| `clickAudio.mjs` | Offline before/after audio: recorded/generated tap amplitude, untouched warning/confirmation cues, and seeded full channel mixes through the real output chain. |
| `welcomeClicks.mjs [url] [outDir]` | Real welcome UI: text, padding, margins and backdrop stay open; native input, touch drag, Next/Back, explicit completion, Help reopening and Escape. Works on development and production. |
| `draggableWindows.mjs` | Shared window controller through native mouse/touch: click preservation, drag bounds, viewport resizing, modal reopen reset, keyboard movement and cancellation. |
| `tutorialPresentation.mjs [dev-url] [outDir]` | Central expanded objectives at launch and step changes; persistent folding into the side dock, Escape, service/team handoff, focus return and four mobile viewport bounds. |
| `tutorial.mjs --url URL` | Full authored tutorial through real visitor routes: patrol return, team review and focus, outreach, drop-in, club stand, seven intermediate reading popups, morning report and Continue. Fails on captured runtime errors. |
| `tutorialDispatch.mjs [dev-url]` | Native mouse right-click and touch long-press on the actual picked camp: exactly one camp action, no patrol actions on unrelated ground, lesson/funds/duplicate guards, exact 15-coin paused dispatch, mobile overflow and screenshots. |
| `tutorialRelease.mjs [production-url] [outDir]` | Production-only public UI: explicit Tutorial launch, no camp action in an unrelated ground menu, guide dispatch, real-time patrol return and no development hook. Use on the immutable preview and public release. |
| `independentContainers.mjs [dev-url]` | Simultaneous left selection and right Services, independent folding, selection changes, shared switch state and desktop/phone/landscape bounds. |
| `selectionPortrait.mjs [dev-url]` | Persistent lower-left person/object shortcuts, face-load failure and cancellation, independent details, right-side management, touch and viewport bounds. |
| `rename.mjs [dev-url]` | Visible venue/character name editor: Enter and blur save, Escape cancellation, focus, mobile target bounds and heading folding. |
| `saves.mjs` | Saves: a used favour, an approved grant and the stress meters survive the update reload; an old save without the newer fields loads with start values; the Sandbox mark survives and keeps the run off the leaderboard. Exits 1 on a failure. |
| `viewport.mjs [url]` | Inset-layout regression at 393×852, 852×393, 667×375 and 1440×900, landscape control parity and real CDP touch pinch. Injects safe-area probe measurements because Chrome cannot reproduce installed WebKit shell geometry. Screenshots in `/tmp/hrs-viewport-qa`; physical PWA checks remain required. |
| `touchUi.mjs [url] [outDir]` | Touch and desktop panel parity at 320×568, 393×852, 667×375, 852×393, 768×1024 and 1440×900. Real CDP map gestures, hint dismissal, heading toggles, viewport shrink/restore, rotation, screenshots and runtime errors. Attempts Fullscreen API entry/exit through a real click and reports the outcome. `UI_CASE=phone-new` selects one case. Screenshots default to `/tmp/hrs-touch-qa`. |
| `iconHints.mjs` | Compiles the real shared hint module into an isolated fixture and checks 24 touch/hover, action-preservation, dismissal, keyboard/assistive activation, dynamic-indicator, modal and stale-hint scenarios. Uses the canonical Chrome driver; artifacts stay in `/tmp/hrs-icon-hints-qa`. |
| `sound.mjs` | Renders the street ambience offline for four moods and measures it: level, peaks, clipping, share below 150 Hz (buzz on small speakers), loudness spread and flat share (monotony). `--recorded` mixes in the recorded street, `--wav dir` writes WAVs to listen to. |
| `keyboard.mjs` | Isolated shared keyboard contract with native Chrome input: Space pause/resume, focused-button exclusivity, held-key suppression, text/contenteditable typing, modifiers and Enter activation. |
| `chrome.mjs` | The driver the others use; also a CLI that runs a JSON list of steps (`eval`, `wait`, `shot`, `profile`). It closes Chrome with `Browser.close` (signals only if that fails), removes its temporary profile even on Ctrl-C or an error, and sweeps `hrs-chrome-*` profiles left by earlier crashed runs. Launch Chrome only through it: a bare `kill` leaves a profile and a macOS code-signing clone behind each time. |

The page-side halves (`strategies.js`, `perf.js`, `clearance.js`) are single function expressions,
sent to the page with `call(file, ...args)`.

`SEED=n` (or `--seed`) seeds `Math.random` in the page before any script runs, so the city's layout,
which is random per launch, is the same on every run and two builds can be compared.

Saving a source file while a bot runs makes the dev server reload the page and restarts that run;
`run-bots.mjs` retries such runs, but leave the code alone while measuring.

### Physical mobile/PWA verification

The touch bot uses current Chrome with viewport and CPU emulation. It does **not** verify older Safari,
older Android browser engines, installed Home Screen launches, operating-system keyboards or real cutouts.
Chrome's headless media emulation did not activate standalone display mode; do not report that as passed.

Before claiming hardware/PWA compatibility, repeat the heading-toggle, outside-hint-dismissal and map
navigation flows on an iOS/iPadOS 15.8 device, a newer iPhone/iPad, an older Android device running a
supported browser and a newer Android device. Use both a browser tab and an installed Home Screen app.
Check portrait/landscape, cold launch, background/resume, toolbar changes, keyboard opening/closing,
cutouts/home indicators and supported fullscreen entry/exit. Record exact device/OS/browser versions;
until performed these hardware checks remain pending.

Keep the existing manifest fullscreen-to-standalone fallback. Display modes vary by platform; see
[the browser vendor's PWA guidance](https://web.dev/learn/pwa/app-design/). The oldest documented Safari
baseline already supports dynamic viewport units, `:has()` and `:focus-visible`; see
[WebKit's Safari 15.4 release notes](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/).

`node scripts/bots/releaseCopy.mjs [dev-url]` checks the Latin America scenario title in all four languages, the retained Colombian flag, the existing scenario ID/failure rules and removal of legacy mode copy. It also launches New Zealand, Australia and Ukraine and verifies their preset IDs and project-failure rules. Use `?menu=1` on a development server.

### Scenario calibration

`scenarioBalance.mjs` runs the real simulation, crowd and world at the canonical fixed step for five game days. It validates the launched scenario and runtime errors, saves every hourly row plus exact night-boundary helped/deaths/stars/folded/won measurements, and prints a compact summary. Each case starts with a clean seeded browser profile.

```bash
node scripts/bots/scenarioBalance.mjs --url http://127.0.0.1:5199/ --scenarios australia,ukraine --seeds 777,123,2026 --out /tmp/scenario-project
node scripts/bots/scenarioBalance.mjs --url http://127.0.0.1:5199/ --scenarios new-zealand,colombia --bots naive,prepared-lean --seeds 777,123,2026 --out /tmp/scenario-volunteer
```

`prepared-lean` uses the existing prepared strategy plus explicit player actions: close unused sites, rely on volunteers, seek a club contract and preserve cash before optional purchases and recruitment. It receives no extra funds, staff, supplies or policy changes. Ordinary `prepared` and `naive` retain their existing decisions. Bot-only measurements never enter production builds.

Use `--resume` only with the same fixture and configuration; choose a fresh output directory after any change. Transient browser startup/navigation failures retry at most three times. If the machine's `TMPDIR` points to a slow external drive, set it to a dedicated local directory with sufficient free space; the canonical driver still closes Chrome and removes its own profiles.

The 6 November 2026 calibration used an isolated compiled development snapshot, with the real application initialization and 90-second warmup. A fixture-only checkpoint stopped before GPU shader compilation and animation frames; the strategy bot alone advanced the real sim/crowd/world. Its `balanceVisitScore` reference supplied the same care scoring function without a development-source fetch. The normal development page remains supported by the fallback import. See `docs/evidence/scenario-balance-2026-11-06.json` for preserved measurements and `docs/evidence/regional-scenarios.md` for results and limits. Run `node scripts/tests/scenarioFailure.mjs` for the closure regression found during calibration.

`prepared-resourceful` adds the ordinary funding-favour mechanism and handles its later concession request on top of lean play. It was tested separately on difficult seed 991; it does not change any game resources directly. Run it with `--bots prepared-resourceful --seeds 991` and a fresh output directory.

`node scripts/bots/mapControlContrast.mjs [production-url] [outDir]` measures rendered map-icon and Settings glyph contrast in light/dark themes at 1280x800, 1440x900, 852x393 and 393x852. It checks the persistent filled Settings tile, selected map layer, keyboard focus, Settings open/close from an in-panel keyboard control, runtime errors and page overflow, and saves screenshots plus numerical results. It uses the canonical Chrome driver and supports a production preview or the deployed site.

`node scripts/bots/patrolStand.mjs` checks persistent patrol-base geometry across closed/open transitions and desktop/phone bounds (isolated dev URL on port 5295).

`node scripts/bots/patrolCrew.mjs` checks dispatch before avatar arrival, named crew retention, camp beat and return without duplicates (isolated dev URL on port 5296).

`node scripts/bots/patrolTaskArrival.mjs [dev URL]` holds back one patrol worker and verifies that only the final physical arrival opens and pauses the next tutorial task.

`node scripts/bots/tutorialSavedRoutes.mjs [dev URL]` saves and restores visits at all three lesson services, holds their visible routes, then verifies that care and credit wait for physical arrival. The fixture advances world traffic signals as well as the simulation.

`node scripts/bots/tutorialRegularControls.mjs [production URL] [output directory]` is the public acceptance flow for brief tutorial hints and normal controls: camp-panel dispatch, portrait team review, Services placement, desktop and native Chrome touch. The tutorialRelease and tutorialPatrolContinue entry points now use this flow.
