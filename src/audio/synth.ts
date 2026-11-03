/**
 * Small building blocks for one-shot sounds: a filtered burst of noise, a
 * gliding tone, a panner. Each makes a few nodes that start and stop on the
 * audio clock and are dropped by the browser when they end.
 */

export function filter(ctx: BaseAudioContext, type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

/** A panner fixed at `pan`, or moving from `pan` to `to` over `dur` seconds from `t`. */
export function panner(ctx: BaseAudioContext, out: AudioNode, pan: number, t = 0, to?: number, dur = 0): StereoPannerNode {
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  if (to !== undefined) {
    p.pan.setValueAtTime(pan, t);
    p.pan.linearRampToValueAtTime(to, t + dur);
  }
  p.connect(out);
  return p;
}

export interface BurstOpts {
  hz: number;
  q?: number;
  type?: BiquadFilterType;
  level: number;
  attack?: number;
  /** Time constant of the fall. */
  decay: number;
  /** How long it may ring at most. */
  length?: number;
  rate?: number;
}

/** A burst of noise through a filter: ticks, knocks, hisses, rattles. */
export function burst(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, t: number, o: BurstOpts, random: () => number): void {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  if (o.rate) src.playbackRate.value = o.rate;
  const g = ctx.createGain();
  const a = o.attack ?? 0.002;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.level, t + a);
  g.gain.setTargetAtTime(0, t + a, o.decay);
  src.connect(filter(ctx, o.type ?? 'bandpass', o.hz, o.q ?? 1.2)).connect(g).connect(out);
  const len = o.length ?? a + o.decay * 6;
  src.start(t, random() * (noise.duration - len - 0.05), len);
}

export interface ToneOpts {
  type?: OscillatorType;
  from: number;
  to?: number;
  /** Seconds the pitch takes from `from` to `to`. */
  glide?: number;
  level: number;
  attack?: number;
  /** Seconds at full level before the fall. */
  hold?: number;
  decay: number;
  /** Lowpass corner, if any. */
  low?: number;
}

/** A tone with an optional pitch glide: chirps, horns, beeps, bells. */
export function tone(ctx: BaseAudioContext, out: AudioNode, t: number, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.from, t);
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? 0.1));
  const g = ctx.createGain();
  const a = o.attack ?? 0.005;
  const hold = o.hold ?? 0;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.level, t + a);
  g.gain.setValueAtTime(o.level, t + a + hold);
  g.gain.setTargetAtTime(0, t + a + hold, o.decay);
  (o.low ? osc.connect(filter(ctx, 'lowpass', o.low)) : osc).connect(g).connect(out);
  osc.start(t);
  osc.stop(t + a + hold + o.decay * 7);
}
