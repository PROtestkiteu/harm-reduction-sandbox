/** Seconds of noise in each looped buffer: long enough that the loop does not read as a pattern. */
const SECONDS = 9;

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

export interface NoiseBank {
  /** Flat noise: hiss, rain, ticks. */
  white: AudioBuffer;
  /** Pink noise (equal energy per octave): air and tyres; less harsh than white, no rumble like brown. */
  pink: AudioBuffer;
  /** Sparse droplets on a hard surface: random clicks of random size, for rain. */
  drops: AudioBuffer;
}

/** Scales a buffer so its loudest sample is `to`, and fades its ends together so the loop does not click. */
function finish(d: Float32Array, to: number): void {
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const k = peak > 0 ? to / peak : 1;
  for (let i = 0; i < d.length; i++) d[i] *= k;
  const fade = Math.min(4096, d.length >> 3);
  for (let i = 0; i < fade; i++) {
    const a = i / fade;
    d[d.length - fade + i] = d[d.length - fade + i] * (1 - a) + d[i] * a;
  }
}

/** The noise the ambience is made of, made once when the sound starts. */
export function makeNoise(ctx: BaseAudioContext, random: () => number): NoiseBank {
  const n = Math.round(ctx.sampleRate * SECONDS);
  const white = ctx.createBuffer(1, n, ctx.sampleRate);
  const pink = ctx.createBuffer(1, n, ctx.sampleRate);
  const drops = ctx.createBuffer(1, n, ctx.sampleRate);
  const w = white.getChannelData(0);
  const p = pink.getChannelData(0);
  const d = drops.getChannelData(0);
  // Pink by Paul Kellet's filter on white noise.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const r = random() * 2 - 1;
    w[i] = r;
    b0 = 0.99886 * b0 + r * 0.0555179;
    b1 = 0.99332 * b1 + r * 0.0750759;
    b2 = 0.969 * b2 + r * 0.153852;
    b3 = 0.8665 * b3 + r * 0.3104856;
    b4 = 0.55 * b4 + r * 0.5329522;
    b5 = -0.7616 * b5 - r * 0.016898;
    p[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + r * 0.5362;
    b6 = r * 0.115926;
  }
  // Droplets: a few hundred a second, each a tiny decaying click of its own size.
  const rate = ctx.sampleRate;
  for (let i = 0; i < n; ) {
    i += Math.floor((0.5 + random()) * rate / 260);
    const size = 0.15 + random() ** 3 * 0.85;
    const len = Math.floor(rate * (0.002 + random() * 0.006));
    const sign = random() < 0.5 ? -1 : 1;
    for (let j = 0; j < len && i + j < n; j++) d[i + j] += sign * size * Math.exp(-j / (len / 4)) * (random() * 2 - 1);
  }
  finish(w, 0.9);
  finish(p, 0.9);
  finish(d, 0.9);
  return { white, pink, drops };
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
