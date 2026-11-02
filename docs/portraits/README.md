# Dusk cast portraits

Twenty original AI-painted portraits generated with the built-in image_gen tool on 2026-11-02, using the approved Style C palette and flavour-pack clothing groups. The second pass uses text-only direction to avoid anchoring every face to the same reference people. Expressions, gaze, head angle, face shape, lighting and hand poses are explicitly different for each character. The generation direction and every individual subject prompt are recorded in dusk-v3-manifest.json, alongside hashes and sizes of the final assets.

The shared generation prompt asks for an original expressive psychological oil portrait inspired by Disco Elysium, with violet twilight shadows, amber sidelight, restrained teal accents, asymmetrical lived-in features, untidy hair, worn clothes and rough broken impasto. Vertical 4:5 head-and-shoulders framing, clear eyes at 240×300, dark abstract background, no text, logos or existing game characters. Selected characters have understated props such as rolling papers, an unlit cigarette or pipe, a vape, sample packaging or outreach supplies; others have no drug props. No image reference was supplied for this second pass. The exact shared prompt and each subject brief are in the manifest. Full-resolution originals remain in the generation session; the deliverable game assets live in public/portraits/dusk-v3.

Game assets are 480×600 WebP, about 1.30 MB total, displayed in the existing 240×300 canvas. No runtime AI calls are made. The coordinator is also used by reports and guides. Staff, police, sellers, sleepers, cleaners and bouncers have role art; other people use their clothing archetype. Substance, diagnosis and current service attendance never choose a portrait. This is a reusable cast library: people within one archetype may share art, and it is not an exact likeness of a procedural model.

PortraitLibrary loads only selected art, cancels obsolete requests, checks request identity after decode, bounds decoded image storage to 24, closes discarded bitmaps and preserves layout during loading/failure. A failed request leaves a neutral background, never a previous person's face. Selecting away and back retries. Reduced-motion mode disables the loading pulse. The previous 3D portrait studio is no longer imported by the application entry; no extra renderer or GPU readback is used. The service worker pre-caches the complete portrait set for offline use, separately from first-frame rendering. Future artwork replacements should use a new versioned directory rather than mutate cached dusk-v2 URLs.

Choosing the coordinator: `COORDINATOR_IDS` in src/render/portraitLibrary.ts lists the coordinator portraits (one so far, `coordinator`); `setPlayerPortrait(id)` picks one (unknown ids are ignored), and `playerPortraitUrl()` is what the corner portrait, reports and guides show. To offer another, add its WebP to the current set and its id to the list.

Validation commands:

```sh
npm run typecheck
TMPDIR=/tmp/hrp-portrait-runtime node scripts/bots/portraits.mjs http://localhost:5199/ /tmp/hrp-portrait-qa
TMPDIR=/tmp/hrp-portrait-runtime node scripts/bots/portraits.mjs http://localhost:5199/ /tmp/hrp-portrait-mobile-qa 390x844
```

Create the dedicated TMPDIR first. This avoids scanning unrelated historical browser profiles on the shared temporary volume. The regression uses the canonical Chrome driver and checks all 20 real assets, dimensions, role/style matching, deliberately late replies, clearing during loading, errors, retry/recovery, immediate cache reuse, disposal, player/person/location selection and return to the coordinator. These are desktop Chrome checks, including an emulated mobile viewport, not physical-phone or headset acceptance.

## Validation checkpoint: 2026-11-02

- TypeScript strict typecheck passed.
- Production Vite build passed with relative asset base, writing to an isolated output on the external SSD. Vite reported the existing large main-chunk warning; this change removes the portrait studio from the entry imports rather than adding render work.
- Canonical browser portrait regression passed on desktop and 390×844 emulated mobile: all 20 real image decodes, matching, cancellation/stale completion, error recovery, caching, disposal and selection.
- Production service-worker install populated all 20 portrait cache entries; coordinator art reached ready state in the built application.
- Second-pass contact sheet visually inspected for distinct facial structure, expressions, gaze, poses and context props. Previous desktop coordinator and mobile selected-person screenshots were inspected in the first checkpoint. No deployment, physical phone or headset validation performed.
- Disk remained above the 5 GB minimum; no user builds, caches or irreplaceable files were removed. Changes preserve the existing theme/accessibility structure and reduced-motion behavior.

## Second pass

The previous set repeated similar faces, rightward gazes and rim lighting. The replacement assigns individual face geometry and acting (laughter, worry, yawning, skepticism, a scowl, sadness and warm smiles), multiple eye directions, different head angles and contextual hands/props. Portrait URLs are versioned dusk-v2 so installed games cannot retain first-pass art at the same URLs. The original twenty dusk-v1 game assets are preserved under docs/portraits/archive/dusk-v1 and are no longer copied into production public assets. The first contact sheet and manifest remain for comparison. No simulation profiles, health data or character-substance logic changed.

## Restrained absurdity: current dusk-v3 set

The cleaner is deliberately preserved byte-for-byte: his glove-at-mouth pose is the approved absurd accent. Two edited portraits join him: the tourist nibbles a folded paper map like a sandwich, and the student holds a banana to their ear while also holding the original teal vape in their free hand. Eighteen of the second-pass assets are unchanged. Other cigarette, pipe, rolling-paper, vape, sample-packaging and harm-reduction details remain. This keeps the requested drug context visible while restricting absurd details to three of twenty portraits.

Current assets and exact generation/edit prompts are in public/portraits/dusk-v3 and dusk-v3-manifest.json. Earlier assets are archived under docs/portraits/archive and excluded from production. New versioned URLs force artwork refresh without changing model, identity, profile or simulation rules.

## Final validation checkpoint

Strict TypeScript checking and the final production build passed. The desktop browser regression passed on the diverse second-pass cast; the same complete regression passed at 390×844 on the final dusk-v3 set, including all twenty real asset decodes, selection, late responses, cancellation, error recovery, cache reuse and disposal. Final mobile screenshot and full cast sheet were visually inspected. Final hashes match the manifest, the cleaner matches dusk-v2 byte-for-byte, and only dusk-v3 is copied to the production portrait directory. Vite retains its existing large-main-chunk warning.

An initial check targeted a stopped shared dev server; subsequent validation uses an isolated dev preview on 127.0.0.1:5209. Browser runs using external profile storage did not finish initialization reliably, so successful checks use the dedicated internal /tmp/hrp-portrait-runtime directory and explicitly wait for the game diagnostics before testing. These are test-environment observations, not evidence of a portrait-loading failure. No production deployment or physical-device acceptance was performed.

The final built application also passed service-worker installation: all twenty dusk-v3 portraits were cached and the coordinator portrait reached ready state. Final available internal disk space: 6.0 GiB.
