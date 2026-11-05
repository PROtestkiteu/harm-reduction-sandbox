# Recipient support and measured balance

The simulation owns the full visit, including queueing, actions, staff and equipment reservations, transfers, scores and settlement. UI controls issue synchronous commands; rendering does not advance care. The interface uses “odbiorcy” in Polish and has no development/balance placeholder text or nested recipient cards.

## Rules

- One to five distinct support priorities; mean of raw state scores, including unmet priorities. Scores are not normalized against each state's maximum.
- Conversation quality replaces earlier conversation points (5/10/30). Tests replace lower methods for the same sample (5/20/50), rather than adding them.
- A relevant leaflet or packet covers matching priorities in its group, costs one inventory unit and never credits an unrelated priority. Supplies are consumed on completion, not on availability or cancellation.
- Psychological qualifications are separate from calm under pressure. Basic checking supports TLC; instrumental analysis requires the analyser capability from the checking service's second stage or equipment funding. Each site has one analysis slot.
- Current activity finishes before a deferred staff/referral change. Explicit interruption grants no partial points. Staff moves, loss of permission, stock exhaustion and closure cannot create free completed actions.
- At 75% of queue tolerance, urgency escalates. A referral must have an available useful destination; unavailable destinations never count as successful transfers. No new diagnosis-based death roll exists.
- Bronze/silver/gold award 1/2/3 reputation once per completed visit, settled once per night. Unfinished visits carry forward. Reputation is cumulative, with unlocks at 0/15/15/35/35/55/70.
- Saves retain stable worker IDs, priorities, queues, running actions, referrals, sample context, pending awards and the last settled night. Fractional clock time is retained so a save just before morning cannot skip settlement. Legacy unlocks/resources survive migration.

## Calibration, 2026-11-04

Initial and revised builds were compared using four real city/crowd strategy bots, seed 777, two game days per strategy in each build (16 simulated days total). Independent capacity bots exercised 21,600 visits across three seeds, two state-count distributions, five staffing/routing strategies and three arrival loads. Every cohort drained to zero unfinished visits.

Selected defaults: **45/25/15/10/5%** for one/two/three/four/five priorities, rather than a uniform distribution; shared relevant group materials rather than repeated identical handouts. Conversation/action point bands and reputation awards were retained.

Controlled generalist cohort, same 720 recipients at ten arrivals/hour: the original uniform/per-state-material setup left **285** visits without a star; the selected defaults left **58**. Mean score increased **12.1 → 18.6**. Under a sustainable three arrivals/hour, a properly routed specialist network earned **166 bronze, 418 silver, 42 gold**, with 94 unrated, versus 720 bronze for generalists. This preserves a quality-versus-throughput tradeoff: funneling everyone through a single specialist intake still causes queues and is intentionally not rewarded as a good staffing plan.

Actual city/crowd runs:

| Strategy | Rated visits before → after | Mean support before → after | Settled reputation before → after |
|---|---:|---:|---:|
| idle | 51 → 57 | 4.9 → 5.0 | 33 → 37 |
| sensible | 35 → 67 | 4.1 → 5.7 | 16 → 45 |
| prepared | 46 → 76 | 4.6 → 6.0 | 24 → 36 |
| greedy | 45 → 38 | 3.5 → 3.8 | 22 → 27 |

City results include feedback through funding, staffing and events; they are not isolated causal estimates. Late visits remain pending until the next nightly report. Early default rosters produced no gold; gold was reached in the equipped specialist cohorts.

End-of-run four-second Chrome CPU samples: mean 1.19–1.56 ms and p95 4.2–5.5 ms per animation callback. The renderer drew 77 of 240 callbacks; this is not a claim of 60 rendered FPS, GPU performance or headset compatibility.

## Reproduction and regression

From the game directory:

```sh
node scripts/tests/recipientCare.mjs
node scripts/bots/careBalance.mjs /tmp/hrs-care-cohorts
node scripts/bots/run-bots.mjs --url http://127.0.0.1:5199/ --days 2 --seed 777 --out /tmp/hrs-care-city idle sensible prepared greedy
node scripts/bots/recipientCare.mjs http://127.0.0.1:5199/
node scripts/bots/recipientCareControls.mjs http://127.0.0.1:5199/
node scripts/bots/saves.mjs --url http://127.0.0.1:5199/
npm run build
```

Browser bots use the canonical Chrome driver; run them serially and keep source files unchanged during measurements. The cohort bot records JSON, CPU time, queue peaks, stocks, ratings and completion counts; it also includes overloaded and badly routed comparisons. Its uniform comparison uses the current grouped-material behavior; the original before-change metrics above were captured before the implementation change.

Domain regressions cover examples 15/45/22.5, exact rating boundaries, materials/sample deduplication, qualifications, capacity, cancellation, unavailable referrals, closures, migration, the morning save boundary, and parity at 1x/3x. Desktop dark and phone light checks cover labels, progress, focus-preserving controls and overflow. Physical iOS/Android/PWA/headset checks remain unperformed; no SDK or native Horizon code was changed.

## Final verification

All 12 domain/regression suites passed, including 35 recipient-care scenarios. The full-game desktop dark/phone light panel checks passed; isolated desktop/320px control checks also verified synchronous feedback and retained focus while paused. The browser save/reload matrix passed (new, legacy and sandboxed runs). Foundation validation and archived hashes passed.

Concurrent edits initially triggered browser reloads during testing. Final checks used a frozen copy with an independent Vite cache and build directory; the relevant source hashes matched the working checkout. Existing concurrent changes were preserved. Legacy saves without an explicit reputation record retain the earlier baseline community/relationship unlocks at 15 points; fresh games still start at zero.
