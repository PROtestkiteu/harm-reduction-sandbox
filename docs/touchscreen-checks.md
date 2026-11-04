# Touchscreen parity and release checks

Interaction contract:

- The portrait toggles character details. A ready portrait replaces the redundant character disclosure bar. While an image is unavailable, the text disclosure remains usable; an empty portrait frame is never shown.
- Existing module headings fold content in place. Nested disclosure chevrons precede labels; select controls retain trailing arrows. Folding a team section does not dismiss its sheet. Its source control, a tap outside, or Escape dismisses the sheet without another button.
- The tutorial objective has one compact fold toggle. Tutorial actions live in the ordinary numbered action list, including keyboard shortcuts. Folding the objective preserves those actions and its chosen state through progress updates.
- Informational indicators have hover/tap hints dismissed by the next tap anywhere. Actionable indicators preserve their tap action and expose hints on hover.
- Device color preference controls UI colors and browser theme colors. Game time changes scene lighting only.
- Menu launch paints the splash before importing the scene. Independent compositor opacity animations run continuously, with reduced-motion support. Startup warmup yields between short batches; shader preparation is sequential and asynchronous.
- UI uses one rectangle intersecting the visual viewport with all four safe-area insets, without guessed status-bar offsets. The scene fills the display independently; an installed viewport missing exactly its reported top safe-area band recovers that band without expanding a keyboard-reduced visual viewport. World annotations retain canvas coordinates. Landscape panels shift camera focus without shrinking close-zoom scale. The camera frames the largest clear rectangle between visible panels, cached until layout changes. Tutorial interactions focus their actual target; manual navigation uses the full authored city envelope, including the northern park beyond the original city radius, rather than being clamped to the highlighted district. Tutorial action restrictions remain intact.

Automated checks:

1. Run `npm run build` and `node scripts/check-i18n.mjs . --unused`.
2. Run `scripts/tests/tutorial.mjs`, `tutorialMap.mjs`, `tutorialCamera.mjs`, and `menuSave.mjs` with Node.
3. Run `node scripts/bots/viewport.mjs` against the dev server for portrait/landscape inset bounds, control parity and actual touch pinch. Insets are injected measurements, not a verification of the native PWA shell.
4. Run the tutorial and portrait browser bots against a development server. Confirm staff images decode, do not change row height, team folding preserves the sheet, and focus returns to the tutorial action.
5. Check production menu-to-tutorial launch at 320×568, 393×852, 852×393, 768×1024, and 1440×900. Assert no horizontal overflow, no empty portrait, no empty overview strip, and a reachable minimized objective. Verify splash animation time advances without progress updates.

Physical-device checks still required before claiming mobile/PWA compatibility:

| Device class | Modes | Checks |
| --- | --- | --- |
| Older small iPhone / oldest supported Safari | Browser and installed PWA | Toolbar expansion/collapse, portrait/landscape, home indicator and status bar clearance, keyboard opening/dismissal, warm/cold launch, low-memory image failure |
| Recent notched/Dynamic Island iPhone | Browser and installed PWA | All four safe insets, rotation during loading, app background/resume, device light/dark change, standalone relaunch |
| Older Android phone | Chrome tab and installed PWA | Gesture/three-button navigation, dynamic browser bars, keyboard resize, slow CPU splash animation, fullscreen fallback |
| Recent Android phone and tablet | Browser, PWA and supported fullscreen | Cutouts, split screen, orientation, navigation bars, theme change, touch-to-mouse transitions |

In each mode, pan and pinch with details folded and expanded; repeatedly tap the portrait and module headings; open another map item; dismiss hints by tapping elsewhere. No stale hover surface, duplicated disclosure, accidental game action, clipped portrait caption, or unreachable action should remain. Browser emulation does not verify native safe-area behavior or real fullscreen permissions.

## USB iPhone inspection, 2026-11-04

- Device: physical iPhone 15 Pro, iOS 27.0.1 (24A446), installed Home Screen app, Safari UA Version/27.0.1. Inspected over USB with the WebKit remote protocol, not Chrome emulation.
- Portrait before correction: screen 393x852, inner/visual viewport 393x793, safe insets 59/0/34/0. Canvas was already 852 high, but html/body were 793 high and clipped fixed descendants. A physical screenshot showed the 59 px bottom strip. Making the root and body use the same recovered scene height removed the strip, confirmed on the phone by the user; innerHeight subsequently became 852.
- Landscape measurement: inner/visual viewport 852x393, safe insets 0/59/20/59, HUD x=59..793 and y=0..373.
- Player portrait before correction: y=624..725, action panel y=693..808. The sheet-clearance rule excluded the player. Applying it to every portrait gives y=582..683 with a 10 px gap above the panel.
- Start viewport tracking in the loading entry so menu and gameplay share one tracker. The loading surface and clipping root follow the recovered scene height.
- Removed the deprecated black-translucent status-bar key following current WebKit guidance: https://bugs.webkit.org/show_bug.cgi?id=317153#c2 . Remote inspection found no active CSS filter or backdrop filter during the reported top blur. Native status-bar appearance is controlled by iOS; removal of the key requires a fresh launch to assess and does not promise arbitrary scene content beneath the status bar.
- Automated regression adds root/canvas recovered-height equality and player-portrait clearance to the existing viewport bot. Chrome inset and touch-pinch checks remain regression aids, not physical-device evidence.
- Landscape empty-space input regression: at x=760, y=120/180/240/300/350, hit testing returned the full-height `.column` even with its contents collapsed. The scroll owner now passes pointer input through empty space while direct panel children remain interactive. All five points then hit `#scene`; the user confirmed right-side dragging works on the physical phone.
- Landscape map legend (Residents): the old fixed y=188 position stranded the disclosure after the tutorial folded. The existing HUD layout observer now publishes the visible objective's bottom; the legend follows it with a 10 px gap, or follows the header when the objective is absent. No new production observer or frame polling was added. On the device, the folded objective ended at y=126 and Residents moved to y=136, aligned at x=71 with the objective.
