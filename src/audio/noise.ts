/** Seconds of noise in each looped buffer: long enough that the loop does not read as a pattern. */
const SECONDS = 4;

/** A small seeded generator, so the sound never draws on (and never shifts) the page's Math.random. */
export function audioRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** White noise and brown (deep, rumbling) noise, made once when the sound starts. */
export function makeNoise(ctx: BaseAudioContext, random: () => number): { white: AudioBuffer; brown: AudioBuffer } {
  const n = Math.round(ctx.sampleRate * SECONDS);
  const white = ctx.createBuffer(1, n, ctx.sampleRate);
  const brown = ctx.createBuffer(1, n, ctx.sampleRate);
  const w = white.getChannelData(0);
  const b = brown.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const r = random() * 2 - 1;
    w[i] = r;
    last = (last + 0.02 * r) / 1.02;
    b[i] = last * 3.5;
  }
  // Fade the brown loop's ends together so the seam does not click.
  const fade = Math.min(2048, n >> 2);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    b[n - fade + i] = b[n - fade + i] * (1 - k) + b[i] * k;
  }
  return { white, brown };
}

/** A looping noise source started at a random point, at a given speed (which shifts its colour a little). */
export function loopNoise(ctx: BaseAudioContext, buffer: AudioBuffer, random: () => number, rate = 1): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.playbackRate.value = rate;
  src.start(ctx.currentTime, random() * buffer.duration);
  return src;
}
