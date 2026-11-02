// Sound check: renders the street ambience offline in the dev page for a few moods and prints
// level, peaks, clipping, how much of it is below 150 Hz (small speakers turn that into buzz),
// how much the loudness moves (spread between the quiet and loud half-seconds) and the share of
// half-seconds within 1.5 dB of the median (near 1 means a flat, monotonous bed). With --wav DIR
// it also writes each mood as a WAV to listen to.
//
//   npm run dev                                   (in another terminal)
//   node scripts/bots/sound.mjs [--url http://localhost:5199/] [--seconds 60] [--wav dir] [--recorded]
//
// --recorded mixes in the recorded street (src/audio/assets) as the game does once it has loaded.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { call, drive } from './chrome.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const base = opt('url', 'http://localhost:5199/');
const seconds = Number(opt('seconds', 60));
const wavDir = opt('wav', null);
const recorded = args.includes('--recorded');
if (wavDir) mkdirSync(wavDir, { recursive: true });

const MOODS = {
  evening: { busy: 1, night: 0.4 },
  smallHours: { busy: 0.2, night: 1 },
  nearClub: { busy: 0.9, night: 0.8, club: 0.8 },
  rain: { busy: 0.6, night: 0.8, rain: 1 },
};
const rows = [];
for (const [name, mood] of Object.entries(MOODS)) {
  const url = new URL(base);
  url.searchParams.set('packs', 'none');
  const [r] = await drive(url.href, [call('./sound.js', seconds, mood, !!wavDir, recorded)], { log: () => {}, settle: 6000 });
  if (!r || typeof r !== 'object') { console.error(name, 'failed:', r); continue; }
  if (r.wav) { writeFileSync(join(wavDir, `${name}.wav`), Buffer.from(r.wav, 'base64')); delete r.wav; }
  rows.push({ mood: name, 'rms dB': r.rmsDb, peak: r.peak, clipped: r.clipped, 'below 150 Hz': r.lowShare, 'spread dB': r.loudnessSpreadDb, 'flat share': r.steadyShare });
}
console.table(rows);
if (wavDir) console.log(`WAVs in ${wavDir}`);
