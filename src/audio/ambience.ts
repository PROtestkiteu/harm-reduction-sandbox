import { loopNoise, type NoiseBank } from './noise';
import type { Channel } from './settings';

/** What the ambience should sound like now; every value 0 to 1. */
export interface AmbienceMood {
  /** How busy the city is: evening high, the small hours low. */
  busy: number;
  /** Night darkness: the far city gets duller and sparser after dark. */
  night: number;
  /** The club through its walls, already scaled by distance and opening hours. */
  club: number;
  /** Rain on the streets. */
  rain: number;
  /** Where the club is across the view, -1 left to 1 right. */
  clubPan: number;
  /** How close-up the view is (0 whole city, 1 a corner): footsteps and clinks carry only close up. */
  close: number;
  /** Overall level: lower while the game is paused. */
  level: number;
}

/**
 * Levels at full mood, before the master volume. Nothing here is a steady
 * tone and almost nothing sits below 150 Hz: laptop and phone speakers cannot
 * play that and turn it into a buzz. The city is a soft bed with most of the
 * life in separate events that come and go: far cars overlapping into a
 * wash with gaps, nearer cars passing, footsteps, a bottle, a far siren.
 */
const LEVEL = { recorded: 0.55, bed: 0.05, far: 0.17, near: 0.32, steps: 0.24, murmur: 0.08, kick: 0.17, bass: 0.055, rain: 0.04, drops: 0.08, siren: 0.024, clink: 0.06 };
/** The club's tempo. */
const BEAT = 60 / 124;
/** How far ahead beats are put on the audio clock; longer than the update interval, so none is missed. */
const LOOKAHEAD = 0.7;
/** The bass line under the kick, a bar of eighths (Hz; 0 is a rest). */
const BASS = [98, 0, 98, 0, 73.4, 0, 82.4, 0];

/** A slowly wandering value: eases towards a new random target every few seconds, so levels never sit still. */
export class Wander {
  value: number;
  private target: number;
  private left = 0;
  constructor(private readonly random: () => number, private readonly lo: number, private readonly hi: number, private readonly every: [number, number]) {
    this.value = this.target = lo + (hi - lo) * random();
  }
  step(dt: number): number {
    this.left -= dt;
    if (this.left <= 0) {
      this.left = this.every[0] + this.random() * (this.every[1] - this.every[0]);
      this.target = this.lo + (this.hi - this.lo) * this.random() ** 1.5;
    }
    this.value += (this.target - this.value) * Math.min(1, dt / (this.left + 0.5));
    return this.value;
  }
}

interface Voice { gain: GainNode; band: BiquadFilterNode; pan: StereoPannerNode; freeAt: number }

/**
 * Street ambience from noise and a few short tones. Continuous layers (the
 * bed, rain, the club's murmur) are built once and only have their levels
 * moved, smoothed with setTargetAtTime. Car passes reuse pooled voices; short
 * events (footsteps, a clink, a siren, the club's beats) make a few nodes each
 * that the browser drops when they end.
 */
export class Ambience {
  private readonly bed: GainNode;
  private readonly bedTone: BiquadFilterNode;
  private readonly far: Voice[] = [];
  private readonly near: Voice[] = [];
  private readonly rain: GainNode;
  private readonly drops: GainNode;
  private readonly murmur: GainNode;
  private readonly club: GainNode;
  /** The recorded night street, once loaded: it takes over from the generated bed and far traffic. */
  private recorded: { gain: GainNode; tone: BiquadFilterNode; wander: Wander } | null = null;
  private readonly bedWander: Wander;
  private readonly rainGust: Wander;
  private readonly murmurWander: Wander;
  private nextBeat = 0;
  private beat = 0;
  /** Seconds until the next of each sparse event may come. */
  private readonly wait = { far: 0, near: 4, steps: 6, clink: 40, siren: 90 };
  private readonly filter: (type: BiquadFilterType, hz: number, q?: number) => BiquadFilterNode;

  private readonly clubPan: StereoPannerNode;

  /** `bus` is the mixer's channels: each layer plays into its own (the street bed to city, cars to traffic, and so on). */
  constructor(private readonly ctx: BaseAudioContext, private readonly bus: Record<Channel, AudioNode>, private readonly noise: NoiseBank, private readonly random: () => number, private readonly on: (c: Channel) => boolean) {
    this.filter = (type, hz, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      f.Q.value = q;
      return f;
    };
    const f = this.filter;
    const silent = (): GainNode => {
      const g = ctx.createGain();
      g.gain.value = 0;
      return g;
    };
    const voice = (q: number, out: AudioNode): Voice => {
      const band = f('bandpass', 500, q);
      const gain = silent();
      const pan = ctx.createStereoPanner();
      loopNoise(ctx, noise.pink, random, 0.85 + random() * 0.3).connect(band).connect(f('highpass', 160)).connect(gain).connect(pan).connect(out);
      return { gain, band, pan, freeAt: 0 };
    };

    // The air of a city at night: soft pink noise between 180 Hz and a couple of kHz, its level wandering.
    this.bed = silent();
    this.bedTone = f('lowpass', 2000);
    loopNoise(ctx, noise.pink, random, 0.9).connect(f('highpass', 180)).connect(this.bedTone).connect(this.bed).connect(bus.city);
    this.bedWander = new Wander(random, 0.25, 1, [4, 12]);

    // Far cars: up to five overlapping, slow and dull; together a wash that comes and goes.
    for (let i = 0; i < 5; i++) this.far.push(voice(0.5, bus.traffic));
    // Nearer cars: brighter, quicker, panned across.
    for (let i = 0; i < 2; i++) this.near.push(voice(0.9, bus.traffic));

    // Rain: a soft, dark wash that swells and thins (pink noise, no white sizzle), and droplets on hard ground on top.
    this.rain = silent();
    loopNoise(ctx, noise.pink, random, 1).connect(f('highpass', 450)).connect(f('lowpass', 2600)).connect(this.rain).connect(bus.weather);
    this.drops = silent();
    loopNoise(ctx, noise.drops, random, 1).connect(f('highpass', 1200)).connect(f('lowpass', 6000)).connect(this.drops).connect(bus.weather);
    this.rainGust = new Wander(random, 0.15, 1, [3, 9]);

    // People talking outside the club: a band of noise whose level flickers at the pace of speech.
    this.murmur = silent();
    const talk = ctx.createGain();
    talk.gain.value = 0.5;
    const syllables = ctx.createGain();
    syllables.gain.value = 9;
    loopNoise(ctx, noise.white, random, 0.07).connect(f('lowpass', 7, 0.5)).connect(syllables).connect(talk.gain);
    loopNoise(ctx, noise.pink, random, 1).connect(f('bandpass', 700, 0.8)).connect(f('lowpass', 2400)).connect(talk).connect(this.murmur).connect(bus.people);
    this.murmurWander = new Wander(random, 0.5, 1, [4, 10]);

    // The club's sound through its walls: kicks and bass go to this bus, muffled.
    this.club = silent();
    this.clubPan = ctx.createStereoPanner();
    this.club.connect(f('lowpass', 520, 0.9)).connect(this.clubPan).connect(bus.music);
  }

  /**
   * Plays the recorded street from now on, looped from a random point. The generated bed and far
   * cars step back (the recording has its own); nearer cars, footsteps and the rest stay on top,
   * fewer, so the street keeps changing.
   */
  useRecording(buffer: AudioBuffer): void {
    if (this.recorded) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // Clear of any encoder padding at either end (the seam itself is crossfaded in the file).
    src.loopStart = 0.06;
    src.loopEnd = buffer.duration - 0.06;
    const tone = this.filter('lowpass', 9000);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(tone).connect(gain).connect(this.bus.city);
    src.start(ctx.currentTime, 0.06 + this.random() * (buffer.duration - 0.2));
    this.recorded = { gain, tone, wander: new Wander(this.random, 0.55, 1, [6, 16]) };
  }

  /**
   * Moves the layers towards `m` (called a few times a second). `dt` is the
   * audio time since the last call; `events` allows passing cars and the like,
   * which stop while the game is paused; `rate` scales how often they come.
   */
  set(m: AmbienceMood, dt: number, events: boolean, rate: number): void {
    const now = this.ctx.currentTime;
    const rec = this.recorded;
    const bed = LEVEL.bed * m.level * (0.45 + 0.55 * m.busy) * this.bedWander.step(dt) * (rec ? 0.25 : 1);
    if (rec) {
      // Quieter and duller in the small hours, as the city thins out.
      rec.gain.gain.setTargetAtTime(LEVEL.recorded * m.level * (0.35 + 0.65 * m.busy) * rec.wander.step(dt), now, 1.5);
      rec.tone.frequency.setTargetAtTime(9000 - 5500 * m.night * (1 - m.busy), now, 3);
    }
    this.bed.gain.setTargetAtTime(bed, now, 1.2);
    this.bedTone.frequency.setTargetAtTime(2400 - 1000 * m.night, now, 3);
    const gust = this.rainGust.step(dt);
    this.rain.gain.setTargetAtTime(LEVEL.rain * m.level * m.rain * gust, now, 0.8);
    this.drops.gain.setTargetAtTime(LEVEL.drops * m.level * m.rain * (0.6 + 0.4 * gust), now, 0.8);
    const crowd = Math.max(m.club, 0.25 * m.busy ** 2);
    this.murmur.gain.setTargetAtTime(LEVEL.murmur * m.level * crowd * this.murmurWander.step(dt), now, 1);
    this.club.gain.setTargetAtTime(m.level * m.club, now, 0.6);
    this.clubPan.pan.setTargetAtTime(m.clubPan, now, 0.4);
    if (m.club > 0.01 && this.on('music')) this.scheduleBeats(now);
    else this.nextBeat = 0;
    if (!events) return;

    // Sparse events, each on its own clock: busier evenings bring them more often, the small hours leave gaps.
    const w = this.wait;
    const busy = m.busy;
    for (const k of Object.keys(w) as (keyof typeof w)[]) w[k] -= dt * rate;
    const on = this.on;
    if (w.far <= 0 && !rec && on('traffic')) {
      w.far = (3 + 6 * this.random()) / (0.15 + busy * busy);
      this.pass(this.far, now, m.level * LEVEL.far * (0.4 + 0.6 * this.random()), 5 + this.random() * 7, 220, 1.5, 0.5, m.night);
    }
    if (w.near <= 0 && on('traffic')) {
      w.near = (6 + 14 * this.random()) / (0.1 + busy) * (rec ? 2 : 1);
      const wet = m.rain > 0.3 ? 1.6 : 1;
      this.pass(this.near, now, m.level * LEVEL.near * (0.5 + 0.5 * this.random()), 2.2 + this.random() * 2, 380 * wet, 2.6, 0.9, m.night);
    }
    if (w.steps <= 0) {
      w.steps = (8 + 18 * this.random()) / (0.15 + busy) * (rec ? 1.4 : 1);
      if (on('people')) this.footsteps(now, m.level * (0.3 + 0.7 * m.close));
    }
    if (w.clink <= 0) {
      w.clink = 40 + 80 * this.random();
      if (m.night > 0.5 && on('people')) this.clink(now, m.level * (0.3 + 0.7 * m.close));
    }
    if (w.siren <= 0) {
      w.siren = 120 + 240 * this.random();
      if (m.night > 0.3 && on('events')) this.siren(now, m.level);
    }
  }

  /** A car going by: a band of tyre noise swelling and fading, its pitch rising then falling (Doppler), panned across. */
  private pass(pool: Voice[], now: number, peak: number, dur: number, low: number, rise: number, panWidth: number, night: number): void {
    const v = pool.find((p) => p.freeAt <= now);
    if (!v) return;
    const t = now + 0.05;
    const dir = this.random() < 0.5 ? -1 : 1;
    const mid = t + dur * (0.35 + this.random() * 0.3);
    const end = t + dur;
    v.freeAt = end + 0.1;
    const g = v.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak * 0.25, t + (mid - t) * 0.6);
    g.linearRampToValueAtTime(peak, mid);
    g.linearRampToValueAtTime(peak * 0.2, mid + (end - mid) * 0.5);
    g.linearRampToValueAtTime(0, end);
    const f = v.band.frequency;
    const base = low * (0.8 + 0.4 * this.random()) * (1 - 0.2 * night);
    f.cancelScheduledValues(t);
    f.setValueAtTime(base, t);
    f.exponentialRampToValueAtTime(base * rise, mid);
    f.exponentialRampToValueAtTime(base * 0.8, end);
    const p = v.pan.pan;
    p.cancelScheduledValues(t);
    p.setValueAtTime(-panWidth * dir, t);
    p.linearRampToValueAtTime(panWidth * dir, end);
  }

  /** Someone walking past: a few steps on the pavement, heels or soft soles, crossing from one side to the other. */
  private footsteps(now: number, level: number): void {
    const ctx = this.ctx;
    const steps = 6 + Math.floor(this.random() * 9);
    const gap = 0.42 + this.random() * 0.18;
    const heels = this.random() < 0.35;
    const hz = heels ? 2600 + this.random() * 900 : 1100 + this.random() * 500;
    const peak = LEVEL.steps * level * (0.4 + 0.6 * this.random());
    const dir = this.random() < 0.5 ? -1 : 1;
    const pan = ctx.createStereoPanner();
    pan.connect(this.bus.people);
    for (let i = 0; i < steps; i++) {
      const t = now + 0.05 + i * gap * (0.95 + 0.1 * this.random());
      const x = i / (steps - 1);
      // Louder in the middle of the walk past.
      const near = Math.sin(Math.PI * x) ** 1.5;
      const src = ctx.createBufferSource();
      src.buffer = this.noise.white;
      const band = this.filter('bandpass', hz * (0.9 + 0.2 * this.random()), heels ? 3 : 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak * (0.25 + 0.75 * near), t + 0.003);
      g.gain.setTargetAtTime(0, t + 0.006, heels ? 0.012 : 0.03);
      src.connect(band).connect(g).connect(pan);
      src.start(t, this.random() * (this.noise.white.duration - 0.2), 0.15);
      pan.pan.setValueAtTime((x * 2 - 1) * 0.7 * dir, t);
    }
  }

  /** A bottle knocked on the pavement in the small hours: a few bright, inharmonic partials, quickly gone. */
  private clink(now: number, level: number): void {
    const ctx = this.ctx;
    const t = now + 0.05;
    const base = 1900 + this.random() * 900;
    const pan = ctx.createStereoPanner();
    pan.pan.value = this.random() * 1.6 - 0.8;
    pan.connect(this.bus.people);
    for (const [ratio, amp, decay] of [[1, 1, 0.09], [2.76, 0.5, 0.05], [5.4, 0.25, 0.03]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = base * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(LEVEL.clink * level * amp, t + 0.002);
      g.gain.setTargetAtTime(0, t + 0.004, decay);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + decay * 8);
      // Sometimes it bounces once.
      if (this.random() < 0.5) {
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0, t + 0.16);
        g2.gain.linearRampToValueAtTime(LEVEL.clink * level * amp * 0.4, t + 0.162);
        g2.gain.setTargetAtTime(0, t + 0.165, decay * 0.7);
        const o2 = ctx.createOscillator();
        o2.frequency.value = base * ratio * 1.01;
        o2.connect(g2).connect(pan);
        o2.start(t + 0.16);
        o2.stop(t + 0.16 + decay * 8);
      }
    }
  }

  /** An ambulance or police car across town: a faint wail behind buildings, rising and falling, passing. */
  private siren(now: number, level: number): void {
    const ctx = this.ctx;
    const t = now + 0.1;
    const dur = 9 + this.random() * 6;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    const f = o.frequency;
    const lo = 620 + this.random() * 60;
    f.setValueAtTime(lo, t);
    for (let s = t; s < t + dur; s += 3.2) {
      f.linearRampToValueAtTime(lo * 1.55, s + 1.6);
      f.linearRampToValueAtTime(lo, s + 3.2);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(LEVEL.siren * level, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const pan = ctx.createStereoPanner();
    const dir = this.random() < 0.5 ? -1 : 1;
    pan.pan.setValueAtTime(-0.6 * dir, t);
    pan.pan.linearRampToValueAtTime(0.6 * dir, t + dur);
    o.connect(this.filter('lowpass', 1400)).connect(g).connect(pan).connect(this.bus.events);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  /** The club's beat for the next moments: a kick on every beat with a body small speakers can play, a bass on the eighths. */
  private scheduleBeats(now: number): void {
    const ctx = this.ctx;
    if (this.nextBeat < now) this.nextBeat = now + 0.05;
    while (this.nextBeat < now + LOOKAHEAD) {
      const t = this.nextBeat;
      // Kick: a fast pitch drop from 190 Hz to 68 Hz, so the body shows on small speakers.
      const k = ctx.createOscillator();
      k.frequency.setValueAtTime(190, t);
      k.frequency.exponentialRampToValueAtTime(68, t + 0.08);
      const kg = ctx.createGain();
      kg.gain.setValueAtTime(0, t);
      kg.gain.linearRampToValueAtTime(LEVEL.kick, t + 0.004);
      kg.gain.setTargetAtTime(0, t + 0.03, 0.06);
      k.connect(kg).connect(this.club);
      k.start(t);
      k.stop(t + 0.5);
      // Bass: two eighths per beat from the bar, a soft sawtooth through the walls.
      for (let half = 0; half < 2; half++) {
        const hz = BASS[(this.beat * 2 + half) % BASS.length];
        if (!hz) continue;
        const s = t + half * BEAT / 2;
        const b = ctx.createOscillator();
        b.type = 'sawtooth';
        b.frequency.value = hz;
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0, s);
        bg.gain.linearRampToValueAtTime(LEVEL.bass, s + 0.01);
        bg.gain.setTargetAtTime(0, s + 0.08, 0.05);
        b.connect(bg).connect(this.club);
        b.start(s);
        b.stop(s + BEAT / 2 + 0.2);
      }
      this.beat++;
      this.nextBeat += BEAT;
    }
  }
}
