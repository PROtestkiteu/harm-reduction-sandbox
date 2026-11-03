# Dev bots and checks

Headless Chrome tools that drive the dev page through `window.__sandbox` (dev only, stripped from
builds). They need `npm run dev` running and Google Chrome installed (`CHROME=` to point elsewhere).
Nothing here is imported by the game, so none of it reaches `dist/`.

| Script | What it does |
|---|---|
| `run-bots.mjs` | Balance: idle, hoarder, spammer, sensible and greedy bots on the real sim for N game days, same seed each; money, meters, first red meter, game over. `--speed 3` repeats at another clock speed. |
| `perf.mjs` | Frame cost: JavaScript ms per frame and draw calls, flavour packs off and on, same seeded city. |
| `edges.mjs` | Traffic edges: the widest views at each corner tilted low, the junctions, the river and the level crossing, watching every tagged mover (`userData.mover`). Fails when a vehicle, boat, aircraft or the train appears, vanishes or jumps on screen, a road vehicle stands inside a building, two registered vehicles overlap, or one stands still for 40 s. `--clock` sets the hour. |
| `clearance.mjs` | Flavour props and standing spots against the crowd's walking lines and buildings, over several launches. |
| `saves.mjs` | Saves: a used favour, an approved grant and the stress meters survive the update reload; an old save without the newer fields loads with start values; the Sandbox mark survives and keeps the run off the leaderboard. Exits 1 on a failure. |
| `sound.mjs` | Renders the street ambience offline for four moods and measures it: level, peaks, clipping, share below 150 Hz (buzz on small speakers), loudness spread and flat share (monotony). `--recorded` mixes in the recorded street, `--wav dir` writes WAVs to listen to. |
| `chrome.mjs` | The driver the others use; also a CLI that runs a JSON list of steps (`eval`, `wait`, `shot`, `profile`). It closes Chrome with `Browser.close` (signals only if that fails), removes its temporary profile even on Ctrl-C or an error, and sweeps `hrs-chrome-*` profiles left by earlier crashed runs. Launch Chrome only through it: a bare `kill` leaves a profile and a macOS code-signing clone behind each time. |

The page-side halves (`strategies.js`, `perf.js`, `clearance.js`) are single function expressions,
sent to the page with `call(file, ...args)`.

`SEED=n` (or `--seed`) seeds `Math.random` in the page before any script runs, so the city's layout,
which is random per launch, is the same on every run and two builds can be compared.

Saving a source file while a bot runs makes the dev server reload the page and restarts that run;
`run-bots.mjs` retries such runs, but leave the code alone while measuring.
