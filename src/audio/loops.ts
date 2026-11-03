import { burst, filter } from './synth';

/** Seconds a layer may sit silent before its nodes are stopped and let go. */
const IDLE_DROP = 12;
/** Below this level (about -50 dB before the channel and master) a layer counts as silent and is not built. */
const SILENT = 0.003;

/**
 * A continuous layer (wind, the river, a crowd, an engine) that exists only
 * while it is heard. It is built on the first call with a level above zero,
 * follows level and pan with smoothed ramps, and after a while at zero stops
 * its sources and disconnects, so nothing runs for a layer nobody hears.
 */
export class Loop {
  private node: { gain: GainNode; pan: StereoPannerNode; sources: AudioScheduledSourceNode[] } | null = null;
  private idle = 0;

  constructor(private readonly ctx: BaseAudioContext, private readonly out: AudioNode, private readonly build: (into: AudioNode) => AudioScheduledSourceNode[]) {}

  get built(): boolean {
    return this.node !== null;
  }

  set(level: number, pan: number, dt: number, smooth = 0.8): void {
    const now = this.ctx.currentTime;
    if (level < SILENT) {
      if (!this.node) return;
      this.node.gain.gain.setTargetAtTime(0, now, smooth);
      this.idle += dt;
      if (this.idle > IDLE_DROP) this.drop();
      return;
    }
    this.idle = 0;
    if (!this.node) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      gain.connect(p).connect(this.out);
      this.node = { gain, pan: p, sources: this.build(gain) };
    }
    this.node.gain.gain.setTargetAtTime(level, now, smooth);
    this.node.pan.pan.setTargetAtTime(pan, now, 0.4);
  }

  drop(): void {
    const n = this.node;
    if (!n) return;
    this.node = null;
    for (const s of n.sources) s.stop();
    n.gain.disconnect();
    n.pan.disconnect();
  }
}

/** A looping noise source from a random point, as a layer's source. */
export function noiseSource(ctx: BaseAudioContext, buffer: AudioBuffer, random: () => number, rate = 1): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.playbackRate.value = rate;
  src.start(ctx.currentTime, random() * buffer.duration);
  return src;
}

/** A slow oscillator driving `param` by ±`depth` around its value: gusts, swells, rotor beats. */
export function lfo(ctx: BaseAudioContext, param: AudioParam, hz: number, depth: number, type: OscillatorType = 'sine'): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  const g = ctx.createGain();
  g.gain.value = depth;
  o.connect(g).connect(param);
  o.start();
  return o;
}

/** A music pattern: sixteen steps per bar; each line marks the steps it plays on. */
export interface Pattern {
  bpm: number;
  kick: string;
  hat: string;
  /** Bass notes (Hz) per eighth note, 0 for a rest. */
  bass: readonly number[];
  /** Chord stabs: steps marked, with the chord's notes. */
  stab?: { steps: string; notes: readonly number[] };
  /** Lowpass corner: how muffled by the walls or the distance. */
  muffle: number;
}

/** How far ahead notes are put on the audio clock; longer than the update interval, so none is missed. */
const LOOKAHEAD = 0.7;

/**
 * Venue music heard from outside (a park rave, a festival stage): notes are
 * scheduled a little ahead on the audio clock while the layer is heard, into
 * a muffled, panned bus. Silent, it schedules nothing and its bus is let go.
 */
export class Groove {
  private next = 0;
  private step = 0;
  private bus: { gain: GainNode; pan: StereoPannerNode; tone: BiquadFilterNode } | null = null;
  private idle = 0;

  constructor(private readonly ctx: BaseAudioContext, private readonly out: AudioNode, private readonly white: AudioBuffer, private readonly random: () => number, private readonly p: Pattern) {}

  set(level: number, pan: number, dt: number): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (level < SILENT) {
      if (!this.bus) return;
      this.bus.gain.gain.setTargetAtTime(0, now, 0.6);
      this.idle += dt;
      if (this.idle > 3) {
        this.bus.gain.disconnect();
        this.bus.pan.disconnect();
        this.bus = null;
        this.next = 0;
      }
      return;
    }
    this.idle = 0;
    if (!this.bus) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const tone = filter(ctx, 'lowpass', this.p.muffle, 0.9);
      const p = ctx.createStereoPanner();
      tone.connect(gain).connect(p).connect(this.out);
      this.bus = { gain, pan: p, tone };
    }
    const b = this.bus;
    b.gain.gain.setTargetAtTime(level, now, 0.6);
    b.pan.pan.setTargetAtTime(pan, now, 0.4);
    // Nearer is a little brighter: the walls and the distance take the top off.
    b.tone.frequency.setTargetAtTime(this.p.muffle * (0.7 + 0.6 * Math.min(1, level * 4)), now, 0.8);
    this.schedule(now, b.tone);
  }

  private schedule(now: number, into: AudioNode): void {
    const ctx = this.ctx;
    const p = this.p;
    const sixteenth = 60 / p.bpm / 4;
    if (this.next < now) this.next = now + 0.05;
    while (this.next < now + LOOKAHEAD) {
      const t = this.next;
      const i = this.step % 16;
      if (p.kick[i] === 'x') {
        const k = ctx.createOscillator();
        k.frequency.setValueAtTime(180, t);
        k.frequency.exponentialRampToValueAtTime(62, t + 0.08);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.2, t + 0.004);
        g.gain.setTargetAtTime(0, t + 0.03, 0.06);
        k.connect(g).connect(into);
        k.start(t);
        k.stop(t + 0.45);
      }
      if (p.hat[i] === 'x') burst(ctx, into, this.white, t, { hz: 8000, type: 'highpass', level: 0.05, decay: 0.012 }, this.random);
      if (i % 2 === 0) {
        const hz = p.bass[(this.step >> 1) % p.bass.length];
        if (hz) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = hz;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.06, t + 0.01);
          g.gain.setTargetAtTime(0, t + 0.07, 0.05);
          o.connect(g).connect(into);
          o.start(t);
          o.stop(t + sixteenth * 2 + 0.2);
        }
      }
      if (p.stab && p.stab.steps[i] === 'x') {
        for (const hz of p.stab.notes) {
          const o = ctx.createOscillator();
          o.type = 'square';
          o.frequency.value = hz;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.018, t + 0.008);
          g.gain.setTargetAtTime(0, t + 0.05, 0.06);
          o.connect(g).connect(into);
          o.start(t);
          o.stop(t + 0.5);
        }
      }
      this.step++;
      this.next += sixteenth;
    }
  }
}
