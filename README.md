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
- Evidence notes come from the DrugsPRO research library and are cited in the panels.

## Licence

MIT. See [LICENSE](LICENSE).
