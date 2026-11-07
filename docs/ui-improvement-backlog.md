# Tycoon UI improvement backlog

Audit date: 2026-11-07. Documentation only. The inspected working tree contains concurrent, uncommitted game changes. Recheck each item against the current release before implementing. Priorities: P0 blocks or misleads a decision, P1 causes recurring management friction, P2 improves polish. No P0 defect is established by this audit.

## Existing foundations to preserve

`MeterCauses` already exposes ranked causes, mouse previews, tap/keyboard pinned explanations and intervention buttons. It refreshes only while open and avoids replacing unchanged contents. `ServicesPanel` owns its own management DOM independently of selection. `ReputationDisclosure` updates expanded content on demand. `NightReportBox` already groups outcomes and goals with disclosures and pauses through its existing contract. Organisation controls already show hourly finances, recruitment costs and some unavailable-action reasons.

## P1: Service overview that supports comparison

- Evidence: source-confirmed information gap in `src/ui/servicesPanel.ts`: rows contain the service name and On/Off switch. Staffing, occupancy, queue and cost are absent from this overview. This is a recommendation, not proof that those details are unavailable elsewhere.
- Player decision: which service needs staff or resources next?
- Proposed behavior: extend existing rows with compact staffing/capacity and queue summaries sourced from existing simulation views. Show the actual limiting resource when available; retain selection and toggle behavior and independent panels.
- Reuse: `ServicesPanel`, existing venue indicators, recipient-care and organisation views. Do not introduce another management window.
- Acceptance: compare two services without opening both; a full queue exposes the limiting capacity and a route to its existing control. No new per-frame DOM work; mobile rows wrap predictably.

## P1: Explain blocked actions consistently

- Evidence: source-confirmed inconsistency. Organisation item actions can include `item.reason`, while tutorial service availability disables both name and toggle without adjacent reason in `ServicesPanel.setAvailable`. `MeterAction` exposes a disabled flag and optional note without a dedicated reason contract. Rendered end-to-end blocked states remain to be verified before calling this a usability defect.
- Player decision: can I act now, and what must change first?
- Proposed behavior: use existing note/reason presentation for unavailable, unaffordable, tutorial-gated and busy states. Keep explanatory text reachable when the button itself cannot receive focus. Do not enable actions that the simulation rejects.
- Reuse: current action notes, organisation reason strings, shared icon hints and tutorial capabilities.
- Acceptance: full queue, insufficient budget and locked service each explain their own cause through touch and keyboard; actions update when the constraint clears and focus remains stable.

## P1: Reach the next reputation unlock directly

- Evidence: `src/ui/reputation.ts` shows Earned/Locked in summaries, while benefit, threshold and parent requirements are inside separate details. There is no next-reachable-unlock summary in this component.
- Player decision: what useful capability should I work toward next?
- Proposed behavior: add a compact next-reachable goal to the existing disclosure, with current/required reputation, benefit and missing prerequisite. Keep the full tree available for planning and preserve existing thresholds.
- Reuse: `ReputationDisclosure`, `REPUTATION_NODES`, `FavourView`.
- Acceptance: one expansion explains the next reachable benefit and blocker; earned nodes and multiple eligible branches remain correct; long translations fit phone widths.

## P1: Connect the night report to the next decision

- Evidence: `src/ui/nightReport.ts` renders aggregate tiles, goals, scenario and Continue. It does not expose service attribution or navigation callbacks for turned-away recipients in this component.
- Player decision: what should I change before the next night?
- Proposed behavior: offer one or a few relevant follow-up links using existing recorded service outcomes. If attribution is absent, first define a minimal simulation report view; do not infer a causal service from aggregate totals. Keep Continue primary and preserve pause/focus behavior.
- Reuse: `NightReportBox`, existing selection/service navigation, recorded report data and `MeterCauses` where appropriate.
- Acceptance: an attributable queue outcome leads to the relevant service without losing report context; an aggregate-only report makes no fabricated causal claim; closing preserves manual pause state.

## P2: Consistent status-to-action explanations

- Evidence: `MeterCauses` already solves most of this requirement. No duplicate diagnostic UI is justified. The remaining recommendation is an audit of action notes, periods, units and disabled reasons across meters.
- Player decision: why is a meter worsening, and which intervention is practical now?
- Proposed behavior: standardize existing cause/action notes and link to the relevant existing control. Preserve ranked causes and pinned touch access.
- Reuse: `MeterCauses`, meter action producers and map selection.
- Acceptance: a worsening meter explains actual current causes, identifies a usable intervention or its blocker, and returns focus when dismissed.

## P2: Map layers and attention review

- Evidence: map-layer, icon-hint, event-feed and transient-surface modules already exist. Duplicate layers, notification spam or focus defects have not been established in this audit.
- Player decision: what does the active layer mean, and which event needs attention?
- Proposed behavior: check selected-layer legends, consistent units, repeated-event grouping and focus return using current primitives. Add backlog defects only when reproduced.
- Reuse: `mapLayers`, `eventFeed`, `iconHints`, `transientSurfaces` and shared panel dismissal.
- Acceptance: selected layer and scale are understandable without color alone; repeated informational events do not interrupt play; mouse, touch and keyboard reach equivalent explanations.

## Validation and implementation order

Implement service comparison and blocked reasons first, then reputation and report navigation. Before each implementation, reproduce its exact state in current source and live runtime. Use existing `independentContainers`, `desktopPanels`, `touchUi`, `iconHints` and relevant report/save tests instead of creating parallel harnesses. Check 393x852 and 1440x900, both themes, long translations and keyboard focus. Hardware/PWA compatibility requires actual devices.

This audit inspected current source. Public-runtime browser captures stalled before producing usable screenshots; the two owned audit processes were stopped. The requested rendered review at phone/desktop sizes in both themes, including service, reputation and night-report states, remains unverified. Findings above are explicitly source-based. No gameplay, localization, save schema, balance, production assets or release was changed.

## Design references

- [Victoria 3 UX improvements](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-74-ux-improvements): contextual information, navigation and notification importance.
- [Cities: Skylines II production UI](https://www.paradoxinteractive.com/games/cities-skylines-ii/news/work-in-motion): compact comparisons and visibility of inputs and outputs.

These inform the recommendations; the proposed adaptations are design judgments for this game.
