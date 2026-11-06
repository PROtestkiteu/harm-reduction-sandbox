# Regional scenario additions

Scenario targets are illustrative game objectives, not empirical outcomes or forecasts. The five-night challenges have been calibrated with the bot measurements below.

- **New Zealand — A licence, a volunteer team** uses the existing `nz` preset and Hutton's *Drug Checking at New Zealand Festivals* (2021), especially pp. 9, 31, 53 and 64: community support alongside volunteer capacity limits. The preset's documented evidence gaps remain unchanged.
- **Australia — Prove the pilot** uses the existing `au` preset, particularly Olsen's *Music festival drug checking: Evaluation of an Australian pilot program* (2022) and Caldicott's *A step change model analysis of the establishment of pill testing in one Australian jurisdiction* (2023). It represents the ACT-style trial route, not every Australian jurisdiction.
- **Latin America — Running on volunteers** retains `colombia`, the existing regional `mx-latam` preset, targets and Colombian flag for save compatibility. Its regional scope stays explicit. Evidence remains Bird's 2026 comparison and the other publications attached to that preset. No additional Latin America scenario is created.
- **Ukraine — Beyond the dancefloor** adds a low-confidence **service case study**, not an inferred national legal model. Source: Kushakov et al., *Harm Reduction Services for People who Use Psychoactive Substances in Recreational Contexts: Intervention Development and Implementation Guide* (Alliance for Public Health, ReGeneration, DPNSEE, 2024), Drugstore cases, pp. 53–57. [Publisher copy](https://region.aph.org.ua/wp-content/uploads/2024/03/harmreductioninrecreationalsettingsinterventionguide.pdf), checked 6 November 2026. The existing mobile-nightlife service option approximates field outreach. Online and postal services and wartime disruption are not simulated. All other policy factors retain explicitly disclosed game defaults; the guide does not establish nationwide settings.

All titles and scenario descriptions are available in English, Polish, Spanish and Portuguese. Citation metadata remains bundled, with no runtime research requests.

## Bot calibration — 6 November 2026

Targets are game balance choices, not measured public-health effects. Research-derived national/regional presets were preserved. The scenario ID `colombia` remains unchanged for saves and links.

| Scenario | Initial helped / stars / deaths cap | Final helped / stars / deaths cap | Prepared strategy |
|---|---|---|---|
| New Zealand | 150 / 7 / 10 | 90 / 4 / 12 | prepared-lean |
| Australia | 170 / 7 / 10 | 170 / 6 / 8 | prepared |
| Ukraine | 150 / 7 / 10 | 150 / 7 / 8 | prepared |
| Latin America | 150 / 7 / 10 | 80 / 5 / 7 | prepared-lean |

Every scenario still requires at least five nights. These are minimum goals, not a five-night deadline: an otherwise surviving project can win later. Counts below use a fixed five-game-day measurement window.

### Method and results

The canonical Chrome driver ran the real simulation, crowd and world at the game's 1/30-second step. An isolated compiled development snapshot completed the actual application initialization and 90-second warmup, then stopped before shader compilation and animation frames. Bot code alone advanced the simulation. This excluded GPU waiting and live-source reloads without altering models, starting resources or game rules. The bundled care-score function was the same function used by the game.

Calibration used seeds **777, 123 and 2026**. Initial validation on **42** exposed brittle targets: 185 helped for Australia and six stars for New Zealand excluded surviving prepared runs. Final targets were fixed before testing the further unseen seed **991**.

`prepared-lean` is an explicit additional strategy. It uses normal player actions to close never-used sites, initially release paid staff, pursue a club contract, preserve a cash reserve, prepare for storms and rest the team. It can hire later under the existing conservative hiring rule. It is not the ordinary prepared bot and receives no injected money, staffing, supplies or policy improvements.

Using each scenario's designated prepared strategy, final-goal rescoring of the recorded trajectories gives:

| Scenario | Prepared wins / five seeds | Naive wins / five seeds |
|---|---:|---:|
| New Zealand | 4 / 5 | 0 / 5 |
| Australia | 4 / 5 | 1 / 5 |
| Ukraine | 4 / 5 | 0 / 5 |
| Latin America | 4 / 5 | 0 / 5 |

This table includes retrospective rescoring of older trajectories. The evidence JSON separately records the goals used during every live run, its actual win result, final-goal rescoring, night boundaries, finances, actions, storms and failures. New live runs verified the revised targets; they are not conflated with retrospective scores.

**Known difficulty hotspot:** seed 991 defeated all four designated prepared strategies. New Zealand, Ukraine and Latin America folded; Australia's prepared project survived but recorded nine deaths against the cap of eight. A separately labelled `prepared-resourceful` strategy tested ordinary funding favours and concessions as an additional player tactic on that seed. That strategy cleared Latin America (140 helped, five deaths, nine stars), but did not clear the other three. All 65 completed runs, including failed attempts, are preserved. These tests do not establish that every city seed is solvable by the current bots.

### Regression fix and checks

Lean play exposed a shared failure-rule bug: closing three optional services counted as closing the entire starting project. The simulation now checks that **every starting service** is closed before starting that failure timer. Optional closures and partial starting-service closures do not start it. Bot shutdown telemetry uses the same intended boundary.

`node scripts/tests/scenarioFailure.mjs` passed the optional/partial/complete closure regression. Production build and TypeScript checks, all-language catalogue validation, reputation/simulation/save compatibility checks, menu/save checks, citation coverage (271 citations), script syntax and whitespace checks passed. Bot code, fixture checkpoints and reference reports were absent from production JavaScript. No new runtime dependencies, rendering work or asynchronous production updates were added.

Full-render browser UI/performance and physical headset/mobile checks were not part of this calibration. Capacity checks stayed above 5 GB free; the final reading is reported in the completion message.

The preserved machine-readable record is [scenario-balance-2026-11-06.json](./scenario-balance-2026-11-06.json). Reproduction commands and strategy details are in [the bot README](../../scripts/bots/README.md).
