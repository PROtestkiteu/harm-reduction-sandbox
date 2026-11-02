# Dev bots and checks

Headless Chrome tools that drive the dev page through `window.__sandbox` (dev only, stripped from
builds). They need `npm run dev` running and Google Chrome installed (`CHROME=` to point elsewhere).
Nothing here is imported by the game, so none of it reaches `dist/`.

| Script | What it does |
|---|---|
| `run-bots.mjs` | Balance: idle, hoarder, spammer, sensible and greedy bots on the real sim for N game days, same seed each; money, meters, first red meter, game over. `--speed 3` repeats at another clock speed. |
| `perf.mjs` | Frame cost: JavaScript ms per frame and draw calls, flavour packs off and on, same seeded city. |
| `clearance.mjs` | Flavour props and standing spots against the crowd's walking lines and buildings, over several launches. |
| `chrome.mjs` | The driver the others use; also a CLI that runs a JSON list of steps (`eval`, `wait`, `shot`, `profile`). |

The page-side halves (`strategies.js`, `perf.js`, `clearance.js`) are single function expressions,
sent to the page with `call(file, ...args)`.

`SEED=n` (or `--seed`) seeds `Math.random` in the page before any script runs, so the city's layout,
which is random per launch, is the same on every run and two builds can be compared.
