import { burst, filter, panner, tone } from './synth';

/**
 * One-shot street sounds, all generated: each recipe varies its pitch,
 * timing and length on every play, so none repeats like a sample would.
 * `out` is the channel bus, `pan` where the sound sits, `level` its peak
 * before the channel's volume.
 */
export interface Kit {
  ctx: BaseAudioContext;
  white: AudioBuffer;
  pink: AudioBuffer;
  random: () => number;
}

type Recipe = (k: Kit, out: AudioNode, t: number, pan: number, level: number) => void;

const between = (r: () => number, a: number, b: number): number => a + (b - a) * r();
const side = (r: () => number): number => (r() < 0.5 ? -1 : 1);

/** A blackbird or robin before dawn: a phrase of quick whistled glides, then silence. */
export const bird: Recipe = ({ ctx, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const base = between(random, 1900, 3200);
  const notes = 3 + Math.floor(random() * 6);
  let s = t;
  for (let i = 0; i < notes; i++) {
    const from = base * between(random, 0.8, 1.5);
    const dur = between(random, 0.05, 0.16);
    tone(ctx, p, s, { from, to: from * between(random, 0.7, 1.4), glide: dur, level: level * between(random, 0.5, 1), attack: 0.01, hold: dur * 0.5, decay: dur * 0.3 });
    s += dur + between(random, 0.02, 0.12);
  }
};

/** A tawny owl in the park after midnight: a low hoot, a pause, a wavering one. */
export const owl: Recipe = ({ ctx, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const hz = between(random, 380, 440);
  tone(ctx, p, t, { from: hz, to: hz * 0.93, glide: 0.4, level, attack: 0.05, hold: 0.25, decay: 0.08, low: 900 });
  const s = t + between(random, 1.1, 1.6);
  for (let i = 0; i < 4; i++) tone(ctx, p, s + i * 0.16, { from: hz * 1.02, to: hz * 0.95, glide: 0.15, level: level * (0.9 - i * 0.12), attack: 0.02, hold: 0.08, decay: 0.05, low: 900 });
};

/** A dog a few streets away: two or three barks, muffled. */
export const dog: Recipe = ({ ctx, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const low = filter(ctx, 'bandpass', between(random, 700, 1100), 1.1);
  low.connect(p);
  const hz = between(random, 330, 520);
  const barks = 2 + Math.floor(random() * 3);
  let s = t;
  for (let i = 0; i < barks; i++) {
    tone(ctx, low, s, { type: 'sawtooth', from: hz * 1.35, to: hz * 0.8, glide: 0.11, level: level * between(random, 0.7, 1), attack: 0.006, hold: 0.04, decay: 0.04 });
    s += between(random, 0.28, 0.6);
  }
};

/** Crickets in a summer park: bursts of quick pulses. */
export const crickets: Recipe = ({ ctx, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const hz = between(random, 4200, 5000);
  const chirps = 4 + Math.floor(random() * 8);
  for (let c = 0; c < chirps; c++) {
    const s = t + c * between(random, 0.35, 0.5);
    for (let i = 0; i < 3; i++) tone(ctx, p, s + i * 0.035, { from: hz, level, attack: 0.003, hold: 0.012, decay: 0.006 });
  }
};

/** Pigeons taking off: a flurry of wingbeats. */
export const pigeons: Recipe = ({ ctx, white, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan, t, pan + side(random) * 0.3, 1);
  const beats = 8 + Math.floor(random() * 10);
  for (let i = 0; i < beats; i++) {
    burst(ctx, p, white, t + i * between(random, 0.06, 0.09), { hz: between(random, 900, 1600), q: 0.8, level: level * (1 - i / beats) * between(random, 0.6, 1), decay: 0.02 }, random);
  }
};

/** A plane high over the city: a slow, dull swell crossing the sky, half a minute long. */
export const plane: Recipe = ({ ctx, pink, random }, out, t, _pan, level) => {
  const dur = between(random, 22, 34);
  const dir = side(random);
  const p = panner(ctx, out, -0.7 * dir, t, 0.7 * dir, dur);
  const src = ctx.createBufferSource();
  src.buffer = pink;
  src.loop = true;
  const band = filter(ctx, 'bandpass', 380, 0.6);
  band.frequency.setValueAtTime(320, t);
  band.frequency.linearRampToValueAtTime(520, t + dur * 0.45);
  band.frequency.linearRampToValueAtTime(260, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + dur * 0.45);
  g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(band).connect(filter(ctx, 'highpass', 160)).connect(g).connect(p);
  src.start(t, random() * pink.duration);
  src.stop(t + dur + 0.1);
};

/** A moped or delivery scooter: a buzzing two-stroke going by, its pitch falling as it passes. */
export const scooter: Recipe = ({ ctx, random }, out, t, _pan, level) => {
  const dur = between(random, 2.5, 4);
  const dir = side(random);
  const p = panner(ctx, out, -0.8 * dir, t, 0.8 * dir, dur);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const hz = between(random, 95, 135);
  o.frequency.setValueAtTime(hz * 1.08, t);
  o.frequency.linearRampToValueAtTime(hz * 1.1, t + dur * 0.45);
  o.frequency.linearRampToValueAtTime(hz * 0.88, t + dur * 0.55);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + dur * 0.5);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(filter(ctx, 'bandpass', 900, 0.9)).connect(filter(ctx, 'highpass', 250)).connect(g).connect(p);
  o.start(t);
  o.stop(t + dur + 0.05);
};

/** A car horn down the street: one short tap or an impatient double, two detuned reeds. */
export const horn: Recipe = ({ ctx, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const lo = filter(ctx, 'lowpass', 1800);
  lo.connect(p);
  const hz = between(random, 380, 470);
  const taps = random() < 0.4 ? 2 : 1;
  for (let i = 0; i < taps; i++) {
    const s = t + i * 0.28;
    const hold = taps === 2 ? 0.12 : between(random, 0.15, 0.5);
    for (const ratio of [1, 1.26]) tone(ctx, lo, s, { type: 'square', from: hz * ratio, level: level * 0.5, attack: 0.01, hold, decay: 0.03 });
  }
};

/** A van reversing into a loading bay at dawn: a run of flat beeps. */
export const reversing: Recipe = ({ ctx, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const beeps = 4 + Math.floor(random() * 5);
  const hz = between(random, 1000, 1250);
  for (let i = 0; i < beeps; i++) tone(ctx, p, t + i * 0.95, { from: hz, level, attack: 0.008, hold: 0.42, decay: 0.02 });
};

/** A shop's roller shutter coming down: a fast metal rattle that slows and ends with a clunk. */
export const shutter: Recipe = ({ ctx, white, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const dur = between(random, 1.6, 2.8);
  let s = t;
  let gap = 0.035;
  while (s < t + dur) {
    burst(ctx, p, white, s, { hz: between(random, 1800, 3400), q: 2.5, level: level * between(random, 0.4, 0.8), decay: 0.01 }, random);
    s += gap * between(random, 0.7, 1.3);
    gap *= 1.012;
  }
  burst(ctx, p, white, s + 0.05, { hz: 420, q: 1.4, level: level * 1.2, decay: 0.07 }, random);
  tone(ctx, p, s + 0.05, { from: 180, to: 110, glide: 0.1, level: level * 0.6, decay: 0.06, low: 600 });
};

/** A door slammed shut somewhere: a knock and a latch. */
export const door: Recipe = ({ ctx, white, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  tone(ctx, p, t, { from: 210, to: 120, glide: 0.08, level, decay: 0.05, low: 700 });
  burst(ctx, p, white, t, { hz: 700, q: 1, level: level * 0.7, decay: 0.03 }, random);
  burst(ctx, p, white, t + between(random, 0.06, 0.1), { hz: 2600, q: 3, level: level * 0.4, decay: 0.008 }, random);
};

/** A shopping trolley pushed over cobbles near the camp: a long, uneven rattle. */
export const trolley: Recipe = ({ ctx, white, random }, out, t, _pan, level) => {
  const dur = between(random, 3, 6);
  const dir = side(random);
  const p = panner(ctx, out, -0.6 * dir, t, 0.6 * dir, dur);
  for (let s = t; s < t + dur; s += between(random, 0.025, 0.07)) {
    const x = (s - t) / dur;
    burst(ctx, p, white, s, { hz: between(random, 1500, 4200), q: 3, level: level * Math.sin(Math.PI * x) * between(random, 0.3, 1), decay: 0.006 }, random);
  }
};

/** A bicycle bell: two quick rings. */
export const bell: Recipe = ({ ctx, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const hz = between(random, 2600, 3300);
  for (let i = 0; i < 2; i++) for (const [ratio, amp] of [[1, 1], [2.4, 0.4]] as const) tone(ctx, p, t + i * 0.13, { from: hz * ratio, level: level * amp, decay: 0.12 });
};

/** Glasses touching on a bar terrace: a bright double clink. */
export const cheers: Recipe = ({ ctx, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const hz = between(random, 2800, 4200);
  const n = 2 + Math.floor(random() * 3);
  for (let i = 0; i < n; i++) for (const [ratio, amp] of [[1, 1], [2.7, 0.35]] as const) tone(ctx, p, t + i * between(random, 0.03, 0.09), { from: hz * ratio * between(random, 0.96, 1.04), level: level * amp, decay: 0.05 });
};

/** A car alarm somebody switched off quickly: three chirps. */
export const alarm: Recipe = ({ ctx, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const hz = between(random, 1500, 2100);
  const n = 2 + Math.floor(random() * 3);
  for (let i = 0; i < n; i++) tone(ctx, p, t + i * 0.22, { type: 'square', from: hz, to: hz * 1.5, glide: 0.08, level: level * 0.4, hold: 0.06, decay: 0.02, low: 3000 });
};

/** A police radio near the officers: a squelch, a burst of muffled speech, a squelch. */
export const radio: Recipe = ({ ctx, white, pink, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const squelch = (s: number) => burst(ctx, p, white, s, { hz: 2400, q: 0.9, level: level * 0.6, attack: 0.003, decay: 0.03, length: 0.12 }, random);
  squelch(t);
  const dur = between(random, 0.9, 2.2);
  const src = ctx.createBufferSource();
  src.buffer = pink;
  const voice = ctx.createGain();
  voice.gain.value = 0;
  // Syllables: the level jumps every tenth of a second or so.
  for (let s = t + 0.08; s < t + dur; s += between(random, 0.07, 0.16)) voice.gain.setTargetAtTime(random() < 0.25 ? 0 : level * between(random, 0.4, 1), s, 0.015);
  voice.gain.setTargetAtTime(0, t + dur, 0.02);
  src.connect(filter(ctx, 'bandpass', between(random, 900, 1300), 2.2)).connect(filter(ctx, 'highpass', 400)).connect(voice).connect(p);
  src.start(t, random() * (pink.duration - dur - 1), dur + 0.3);
  squelch(t + dur + 0.05);
};

/** Thunder far off: a rumble of noise that rolls a few times and dies away. */
export const thunder: Recipe = ({ ctx, pink, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const dur = between(random, 5, 9);
  const src = ctx.createBufferSource();
  src.buffer = pink;
  src.playbackRate.value = 0.35;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  let s = t;
  for (let i = 0; i < 3; i++) {
    g.gain.linearRampToValueAtTime(level * between(random, 0.5, 1) * (1 - i * 0.25), s + between(random, 0.15, 0.6));
    s += between(random, 1, 2.4);
    g.gain.linearRampToValueAtTime(level * 0.2, s);
  }
  g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(filter(ctx, 'lowpass', 420)).connect(filter(ctx, 'highpass', 140)).connect(g).connect(p);
  src.start(t, random() * 2);
  src.stop(t + dur + 0.1);
};

/** A barge horn on the river: one long, low blast. */
export const boatHorn: Recipe = ({ ctx, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const lo = filter(ctx, 'lowpass', 1100);
  lo.connect(p);
  const hz = between(random, 170, 210);
  for (const ratio of [1, 1.5, 2]) tone(ctx, lo, t, { type: 'sawtooth', from: hz * ratio, level: level / (ratio * 1.5), attack: 0.12, hold: between(random, 1, 2), decay: 0.25 });
};

/** A barge engine going by on the river: the slow chug of a diesel, panned along the water. */
export const barge: Recipe = ({ ctx, white, random }, out, t, pan, level) => {
  const dur = between(random, 10, 16);
  const p = panner(ctx, out, pan - 0.3, t, pan + 0.3, dur);
  const chug = between(random, 0.13, 0.18);
  for (let s = t; s < t + dur; s += chug) {
    const x = (s - t) / dur;
    burst(ctx, p, white, s, { hz: 240, q: 1.6, level: level * Math.sin(Math.PI * x) * between(random, 0.7, 1), attack: 0.01, decay: 0.05 }, random);
  }
};

/** A crowd at a match: a roar that swells up and falls back (a chance, a goal). */
export const roar: Recipe = ({ ctx, pink, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const dur = between(random, 3, 6);
  const src = ctx.createBufferSource();
  src.buffer = pink;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + between(random, 0.4, 1.2));
  g.gain.setTargetAtTime(0, t + dur * 0.5, dur * 0.2);
  src.connect(filter(ctx, 'bandpass', between(random, 700, 1000), 0.6)).connect(filter(ctx, 'highpass', 250)).connect(g).connect(p);
  src.start(t, random() * (pink.duration - dur - 0.5), dur + 0.5);
};

/** Fans clapping in time: the clap-clap, clap-clap-clap of a stadium chant. */
export const chant: Recipe = ({ ctx, white, random }, out, t, pan, level) => {
  const p = panner(ctx, out, pan);
  const beat = between(random, 0.26, 0.32);
  const bars = 2 + Math.floor(random() * 3);
  const pattern = [0, 1, 3, 4, 5];
  for (let b = 0; b < bars; b++) {
    for (const k of pattern) {
      // Many hands, a little apart: a few bursts per clap.
      const s = t + (b * 8 + k) * beat;
      for (let h = 0; h < 4; h++) burst(ctx, p, white, s + random() * 0.03, { hz: between(random, 1100, 2000), q: 0.7, level: level * 0.4, decay: 0.03 }, random);
    }
  }
};
