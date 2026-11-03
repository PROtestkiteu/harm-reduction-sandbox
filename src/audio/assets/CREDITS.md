# Sound credits

All CC0 (public domain). Attribution is not required; it is given with thanks.

- `city-night.mp3`: "Paris by Night" by Joseph Sardin, BigSoundBank.com (sound 0680, https://bigsoundbank.com/paris-by-night-s0680.html). Recorded at 1 am from a balcony at Place Saint Augustin, Paris. Cut to 53 s from 0:24.5, rumble below 90 Hz taken out, a 3 s crossfade baked in so it loops without a seam, loudness-normalised, MP3 72 kbit/s.
- `ui-tap.wav`, `ui-confirm.wav`, `ui-warn.wav`: Kenney, "Interface Sounds" 1.0 (https://kenney.nl/assets/interface-sounds): `select_002`, `confirmation_001`, `error_005`, as 22 kHz mono WAV.

## Generated in the browser (no files)

Everything else is synthesised at run time from the Web Audio API and seeded noise (src/audio: noise.ts, recipes.ts, loops.ts, life.ts, ambience.ts, cues.ts). Written for this game, no samples, no third-party sound: it adds nothing to the download.

- Weather: rain hiss and droplets, gusting wind, far thunder; snow muffles the city, traffic and voices.
- City: the river against its banks, birds before dawn, an owl and crickets in the park at night, dogs, pigeons, doors, roller shutters, car alarms.
- Traffic: far and near cars, bus engines and brake hiss, scooters, horns, the train's rumble, joint clacks and brake squeal, barges and their horns, planes, a van reversing at dawn.
- People: footsteps, talk outside the club and on bar terraces, glasses, a shopping trolley near the camps, bicycle bells, stadium roars and clapping chants, the festival crowd.
- Music: the club's kick and bass through its walls, a park rave, the festival stage.
- Alerts: sirens (two-tone and wail), police radio at raids, the helicopter.
