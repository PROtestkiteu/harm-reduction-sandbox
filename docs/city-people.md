# Selecting city people

All visible crowd, ambient, flavour and park-activity people share the crowd's selection interface. Background identities occupy separate negative ID ranges, so they cannot collide with visitors or workers. Figure eviction uses a stable position proxy; hidden people are not selectable. Existing instanced and merged scenery is retained.

Pointer targets use the projected body line, including seated and rotated figures, with a 14 CSS-pixel minimum radius for a mouse and 24 for touch. Overlapping targets prefer the closer body line, then depth. Foreground buildings and vehicles still block people behind them; padding next to a wall is checked against the body itself.

The existing acute-crisis rules can select an existing adult background person. The simulation chooses from logical presence rather than camera visibility or GPU detail, and retains the person ID, position and opaque visual identity in saves. Appearance selection does not consume the crisis outcome random stream. Workers in uniform, children and static merged park participants are excluded from this particular crisis mechanism. No additional diagnosis, mortality probability or crisis rate was added.

The original background representation is suppressed during the crisis and until it naturally leaves its scene afterwards. The crisis stays at the person's original location instead of taking a shortcut through city geometry. Clicking the person opens the existing support response choices. Legacy saves without a source identity keep their previous crisis behavior.

The selected name, rename pencil and independent fold button now share one header row. Rename stays beside the name; both icon controls retain 44-pixel touch targets and keyboard access.

## Validation

- `scripts/tests/cityPeople.mjs`: stable IDs, camera/detail-independent candidates, existing crisis timing/outcome stream, source suppression, lazy registration, malformed identity data and full save-envelope round trips.
- `scripts/bots/cityPeople.mjs`: real desktop mouse and emulated phone touch on padded targets, existing-person crisis identity, all 14 park participants, flavour people and runtime errors.
- `scripts/bots/rename.mjs`: pencil adjacency, independent fold target, Enter, blur, Escape, focus and phone touch.
- Type checking, i18n validation and the existing domain suites remain required. The pre-existing `staffIdentity.mjs` patrol fixture expects two on-site workers before the current tutorial's physical-arrival gate; that assertion also fails with the unchanged HEAD crowd implementation.

Desktop Chrome and emulated phone checks do not establish physical Safari, Android or Quest compatibility. No native SDK or platform compatibility contract changed.

Release validation for v0.0.537: 19 of 20 domain suites passed; the unchanged-HEAD patrol fixture failure described above was reproduced independently. The browser selected background people using real mouse and emulated touch input, found all 14 park participants and 47 visible flavour actors across street, squats and nightlife, and reported zero runtime errors. The rename regression verified pencil adjacency as well as editing and touch behavior. Two-day idle/prepared strategy runs completed for seeds 777 and 991, with 104 and 110 people helped by the prepared strategies and no project-ending failures. These are illustrative game outcomes, not clinical measures.

The canonical desktop close-view render probe measured median CPU render time 2.0 ms, p95 3.2 ms, 123 draw calls and median GPU time 7.47 ms at low quality. No physical-device claim follows from those measurements. Capacity was restored above 5 GiB by clearing an inactive, regenerable graphics shader cache; source files and active builds were preserved.
