/** The interface's sounds: soft and short, made of noise ticks and low thuds, never chimes. */
export type UiCue = 'tap' | 'confirm' | 'warn';

/** A tick: a few milliseconds of noise through a band, quickly gone. */
function tick(ctx: AudioContext, out: AudioNode, white: AudioBuffer, t: number, hz: number, level: number, offset: number): void {
  const src = ctx.createBufferSource();
  src.buffer = white;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = hz;
  band.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.002);
  g.gain.setTargetAtTime(0, t + 0.004, 0.012);
  src.connect(band).connect(g).connect(out);
  src.start(t, offset, 0.08);
}

/** A thud: a low tone whose pitch falls, so it reads as a knock and not a note. */
function thud(ctx: AudioContext, out: AudioNode, t: number, from: number, to: number, level: number, decay: number, type: OscillatorType = 'sine'): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + decay * 2);
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.012);
  g.gain.setTargetAtTime(0, t + 0.02, decay);
  o.connect(low).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.03 + decay * 6);
}

/** How loud each recorded cue plays. */
const CUE_LEVEL: Record<UiCue, number> = { tap: 0.25, confirm: 0.55, warn: 0.45 };

/** Plays `cue` now, recorded if loaded, else generated. Nodes are made per cue and dropped by the browser when they finish. */
export function playCue(ctx: AudioContext, out: AudioNode, white: AudioBuffer, cue: UiCue, random: () => number, recorded?: AudioBuffer): void {
  const t = ctx.currentTime + 0.005;
  if (recorded) {
    // The recorded click (Kenney, CC0), a touch quieter for the warning so it does not startle.
    const src = ctx.createBufferSource();
    src.buffer = recorded;
    src.playbackRate.value = 0.97 + random() * 0.06;
    const g = ctx.createGain();
    g.gain.value = CUE_LEVEL[cue];
    src.connect(g).connect(out);
    src.start(t);
    return;
  }
  const offset = random() * (white.duration - 0.1);
  switch (cue) {
    case 'tap':
      tick(ctx, out, white, t, 1900, 0.175, offset);
      thud(ctx, out, t, 300, 170, 0.05, 0.012);
      break;
    case 'confirm':
      // Two lower ticks close together over a soft knock: a latch rather than a click.
      tick(ctx, out, white, t, 1250, 0.32, offset);
      tick(ctx, out, white, t + 0.07, 1500, 0.28, offset * 0.5);
      thud(ctx, out, t, 150, 85, 0.3, 0.04);
      break;
    case 'warn':
      // Two low, muffled knocks, the second lower.
      thud(ctx, out, t, 110, 80, 0.38, 0.06, 'triangle');
      thud(ctx, out, t + 0.22, 95, 70, 0.32, 0.07, 'triangle');
      break;
  }
}
