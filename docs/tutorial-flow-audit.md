# Tutorial flow audit

Every new task opens a short briefing before its animated clue is visible. X or Escape acknowledges the briefing and reveals its clues. Minus minimizes without acknowledging: the mission remains in its dock and can restore the unread briefing. Using the explained real control can also acknowledge it. Neither action completes a gameplay objective.

The next briefing waits while Team or Settings is open. Closing an unrelated panel cannot acknowledge a briefing. Opening another panel does not discard a reading window. Popup pause uses the shared pause state and preserves manual pause.

| Task | Briefing explains | Real controls or completion |
|---|---|---|
| Meet the neighbourhood | Find where people need support | Select the park camp |
| Dispatch patrol | Send the team and follow its trip | Camp panel dispatch |
| Patrol stand readiness | Wait for workers to reach the stand | Time controls, actual crew positions |
| Patrol funding recovery | Allow tutorial funding to arrive | Time controls, actual budget |
| Patrol return | Wait for both workers at the stand | Time controls, physical crew return |
| Review skills | Compare skills before opening outreach | Your portrait, Team, close Team |
| Staffing recovery | Review missing staff assignments | Team assignment controls |
| Open each service | Use Services to open and manage it | Service row and Open up |
| Placement | Choose and confirm a location | Map or site arrows, Open here |
| Operate each service | Watch people receive support | Time controls, five completed visits |
| Coordinated night | Keep the network staffed through a report | Real staffed services and morning report |
| Completion | Continue the same city with all controls | Close tutorial |

The coordinated night counts the club when the club lesson ends after closing time (06:00), so the 08:00 report completes the tutorial the same morning instead of a full day later. A morning report that does not complete the lesson posts a notice saying why. The camp's right-click and long-press menu lists one dispatch entry, the one that states why it is unavailable.

Each service has its own setup task. Placement and operation are briefed again for outreach, drop-in and club lessons. Opening Services, selecting a service, choosing a site and confirming it are controls within these tasks, rather than separate lessons for every click. Retrying a previously explained task does not replay its popup.

Regression coverage: scripts/tests/tutorial.mjs checks all 15 task/recovery identifiers and concise nonempty explanations. scripts/bots/tutorial.mjs runs the full authored journey with physical patrol return, actual support completions and the report. scripts/bots/tutorialRegularControls.mjs exercises the public build with native mouse, emulated touch, keyboard dismissal, deferred handoff, distinct minimize/close behavior, no early clues, cancellation and persistent mission UI.

Validated and published as 0.0.532+mw6q56yg. Typecheck, localization (zero problems), domain coverage, complete browser journey, public production interaction checks and live release checks passed. Phone input was Chrome emulation; physical Safari, phones and Quest remain untested.

## Copy audit

Every expanded briefing shows one short explanation and its progress counter. Its live control hint appears only in the collapsed mission card. This applies to all 15 authored tasks and recovery paths, including paraphrased repetition in camp selection, service setup, team review, staffing, dispatch and funding. No text equality or chapter-specific exceptions are needed.

`node scripts/bots/tutorialCopy.mjs` renders 44 navigation states per language/viewport combination, covering all 15 tasks in EN, PL, ES, PT and UK at desktop and phone sizes (440 states). It checks real guide styles, explanations, hidden popup hints and retained collapsed hints. This is Chrome emulation, not physical device validation.
