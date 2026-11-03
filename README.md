# Harm reduction sandbox

A small city you can watch and poke at. People go to work, to the club, to the pharmacy or the drop-in. You run the services, change the rules around them, and see what happens on the street.

Play it at **[protestkit.eu/thegame](https://protestkit.eu/thegame/)**.

Every number in it is illustrative. It shows directions of effect that the research supports. It does not predict anything about a real city.

## What you can do

- Open or close services: drop-in centre, outreach camper, club stand, pharmacy and needle exchange, drug checking, shelter, clinic.
- Hire staff, find volunteers and apply for funding. Run out of money and services close.
- Change the context: national law, city council, policing, funding. Or pick a whole country's model.
- Watch a day go by. Seasons, weekdays, match nights and festivals change who is out.
- Click a place or a person to see what is going on there.

## Controls

| | Mouse | Touch | Keys |
|---|---|---|---|
| Select | click | tap | 1 to 9 for the options |
| Move | drag | drag | arrows or WASD |
| Turn | right drag | two fingers | |
| Zoom | wheel | pinch | |
| Back out | | | Esc |

The Sandbox button (top left) has every setting. Links keep your settings, so you can share a scenario.

## Run it yourself

You need Node 22 or newer.

```bash
npm install
npm run dev
```

`npm run build` makes a static site in `dist/`. Set `--base` if it lives in a subfolder, for example `npx vite build --base=/thegame/`.

## Browser support

The game needs WebGL 2 and a browser from about 2021 on:
- Safari and every iPhone or iPad browser from iOS and iPadOS 15.4 (15.8 included)
- Chrome and Edge 111
- Firefox 114

The build target in `vite.config.ts` is set from this list. three.js 0.186 uses class static blocks, which Safari only has from 16.4, and Safari 15 has a bug with class fields, so the build rewrites both for Safari 15. That adds about 0.2% to the gzipped scripts. The few APIs those browsers lack are stood in for in `src/compat/` and `saveGame.ts` (canvas `roundRect`, and fflate for save links where `CompressionStream` is missing), fetched only by the browsers that need them. A new web API newer than Safari 15.4 needs the same.

On devices without half-float colour buffers the scene renders in 8 bits. Below the lowest quality tier there is simple lighting (`src/render/liteMode.ts`): no point lights, no sun shadows and no vertex bend on the painted surfaces, which together took most of each frame on an iPad Air 2. Any device gets it once Auto is at Low and the game still draws under 20 frames a second for a while; the switch recompiles the shaders once (drawing holds meanwhile) and is remembered for that device, and Settings, Graphics can turn it off again. The oldest Apple GPUs (A7 and A8: iPad Air 2, iPad mini 4, iPhone 6, which stop at iOS 15) start with it. If the game cannot start at all (no WebGL 2, a failed download, an older browser), the loading screen says what failed and offers a retry, where before it would wait forever.

## Leaderboard

Saves are links: the game state is packed after `#g=` and never reaches a server. The public leaderboard is one PHP file, `server/board.php`, deployed as `api/board.php` next to the game. It needs PHP with SQLite, a secret of at least 32 characters in `/etc/thegame/secret` and a writable `/var/lib/thegame/` (both paths can be changed with `THEGAME_SECRET_FILE` and `THEGAME_DB`).

For development, run it beside Vite, which forwards `/api/board.php` to it:

```bash
cd server && THEGAME_SECRET_FILE=./secret THEGAME_DB=./board.sqlite php -S 127.0.0.1:5203
```

## How it is put together

- `src/sim`: the simulation. No rendering, fixed time steps.
- `src/agents`: people, how they move and what they wear.
- `src/world`: the city, built in code.
- `src/render`: camera and the image pipeline.
- `src/ui`: the panels and the options on the right.

Three.js and TypeScript, built with Vite.

## Credits

- People and animations: [Quaternius](https://quaternius.com), CC0. The prepared copies are in `public/people` (see `scripts/build-people.mjs`).
- Trees, plants and a few city buildings: Quaternius's Downtown City MegaKit and Stylized Nature MegaKit, CC0. A small, compressed selection is in `public/kits` (see `scripts/build-kits.mjs`); it loads after the game starts.
- Fonts: Permanent Marker (Apache 2.0) and Roboto Condensed (OFL), through Fontsource.
- Sounds: "Paris by Night" by Joseph Sardin, [BigSoundBank](https://bigsoundbank.com), and Kenney's [Interface Sounds](https://kenney.nl/assets/interface-sounds), both CC0 (see `src/audio/assets/CREDITS.md`). The rest of the sound is generated in the browser.
- Evidence notes come from the DrugsPRO research library and are cited in the panels.

## Licence

MIT. See [LICENSE](LICENSE).
