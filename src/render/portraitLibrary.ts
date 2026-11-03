import type { PersonState } from '../agents/crowd';

export const PORTRAIT_W = 240;
export const PORTRAIT_H = 300;

/** Illustrated cast archetypes, not diagnoses or exact procedural-model likenesses. */
const STYLE: Record<PersonState['archetype'], string> = {
  everyday: 'everyday', raver: 'raver', tourist: 'tourist', worker: 'worker',
  office: 'office', student: 'student', older: 'older', unhoused: 'unhoused',
  technoBlack: 'techno-black', punk: 'punk', goth: 'goth', hiphop: 'hiphop',
  queerRave: 'queer-rave', metal: 'metal',
};
const ROLE: Partial<Record<PersonState['role'], string>> = {
  staff: 'outreach', police: 'police', seller: 'seller', sleeper: 'unhoused',
  cleaner: 'cleaner', bouncer: 'bouncer',
};

export function portraitId(person: Pick<PersonState, 'role' | 'archetype'>): string {
  return ROLE[person.role] ?? STYLE[person.archetype];
}

/** Whether a person's portrait takes their own clothes' colour: everyone but the uniformed roles (staff, police, cleaners, bouncers). */
export function portraitTinted(person: Pick<PersonState, 'role'>): boolean {
  return ROLE[person.role] === undefined || person.role === 'seller' || person.role === 'sleeper';
}

export function portraitUrl(id: string): string {
  return `${import.meta.env.BASE_URL}portraits/dusk-v3/${id}.webp`;
}

/**
 * Portraits the player can be (public/portraits/dusk-v3): the coordinator's
 * own first, then painted faces that read as anyone who might run a project
 * (street roles such as police, a bouncer or a seller are left out). Add a
 * file and its id here to offer another. The choice is kept on this device by
 * the caller.
 */
export const COORDINATOR_IDS = ['coordinator', 'outreach', 'worker', 'office', 'older', 'everyday', 'student', 'goth', 'punk', 'queer-rave', 'metal', 'cleaner', 'wook-of-wisdom'] as const;
export type CoordinatorId = (typeof COORDINATOR_IDS)[number];

let coordinator: CoordinatorId = COORDINATOR_IDS[0];

/** Sets which coordinator portrait is you; unknown ids are ignored. */
export function setPlayerPortrait(id: string): void {
  if ((COORDINATOR_IDS as readonly string[]).includes(id)) coordinator = id as CoordinatorId;
}

export const playerPortraitId = (): CoordinatorId => coordinator;
export const playerPortraitUrl = (): string => portraitUrl(coordinator);

/** Lazy, bounded CPU-side images: no scene clone, shader pass or GPU readback. */
export class PortraitLibrary {
  private readonly cache = new Map<string, ImageBitmap>();
  /** Portraits recoloured to someone's clothes, by url and colour (pixels at the canvas size). */
  private readonly tinted = new Map<string, ImageData>();
  private active: AbortController | null = null;
  private url: string | null = null;
  private tint: number | null = null;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Shows the portrait at `url`; with `tint`, its clothes take that colour (the person's top, as their figure wears it). */
  show(url: string | null, tint: number | null = null): void {
    if (url === this.url && tint === this.tint) return;
    this.active?.abort();
    this.active = null;
    this.url = url;
    this.tint = tint;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.removeAttribute('data-asset');
    if (!url) { this.state('idle'); return; }
    const cached = this.cache.get(url);
    if (cached) { this.draw(url, cached); return; }
    const request = new AbortController();
    this.active = request;
    this.state('loading');
    void this.load(url, request);
  }

  private async load(url: string, request: AbortController): Promise<void> {
    try {
      const response = await fetch(url, { signal: request.signal, cache: 'force-cache' });
      if (!response.ok) throw new Error(`Portrait HTTP ${response.status}`);
      const bitmap = await createImageBitmap(await response.blob());
      if (request.signal.aborted || this.active !== request) { bitmap.close(); return; }
      this.cache.set(url, bitmap);
      if (this.cache.size > 24) {
        const oldest = this.cache.keys().next().value!;
        this.cache.get(oldest)!.close();
        this.cache.delete(oldest);
      }
      this.draw(url, bitmap);
    } catch {
      if (!request.signal.aborted && this.active === request) this.state('error');
    } finally {
      if (this.active === request) this.active = null;
    }
  }

  private draw(url: string, image: ImageBitmap): void {
    const { width: w, height: h } = this.canvas;
    const tint = this.tint;
    const key = tint === null ? '' : `${url}|${tint}`;
    const done = key ? this.tinted.get(key) : undefined;
    if (done) this.ctx.putImageData(done, 0, 0);
    else {
      this.ctx.drawImage(image, 0, 0, w, h);
      if (tint !== null) {
        const px = this.ctx.getImageData(0, 0, w, h);
        recolourClothes(px, tint);
        this.ctx.putImageData(px, 0, 0);
        this.tinted.set(key, px);
        if (this.tinted.size > 24) this.tinted.delete(this.tinted.keys().next().value!);
      }
    }
    this.canvas.dataset.asset = url;
    this.state('ready');
  }

  private state(value: 'idle' | 'loading' | 'ready' | 'error'): void {
    this.canvas.dataset.state = value;
    this.canvas.setAttribute('aria-busy', String(value === 'loading'));
  }

  dispose(): void {
    this.show(null);
    for (const image of this.cache.values()) image.close();
    this.cache.clear();
    this.tinted.clear();
  }
}

/** Hue (0 to 1), saturation and lightness of an sRGB colour (0 to 1 each). */
function hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function rgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    t = ((t % 1) + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [ch(h + 1 / 3), ch(h), ch(h - 1 / 3)];
}

/**
 * Turns a painted portrait's clothes toward `top` (0xrrggbb), so the face in
 * the panel wears what the person's figure wears. The clothes are the
 * strongest colour in the lower part of the picture (a hue histogram,
 * weighted by saturation); every pixel near that hue there moves to the
 * person's hue, its saturation and lightness scaled by the same ratio, so
 * the paint's light and shade stay. Skin (sampled from the face) is left
 * alone wherever it shows, and so are hair and the backdrop above. About 70 000 pixels, once per person.
 */
function recolourClothes(px: ImageData, top: number): void {
  const { width: w, height: h, data } = px;
  const tr = ((top >> 16) & 255) / 255, tg = ((top >> 8) & 255) / 255, tb = (top & 255) / 255;
  const [th, ts, tl] = hsl(tr, tg, tb);
  const BINS = 36;
  // The skin first, from the middle of the face (a warm hue in every portrait): hands and necks in that
  // colour are never taken for clothes, whatever the clothes' hue.
  const skinBins = new Float32Array(BINS);
  for (let y = Math.floor(h * 0.18); y < h * 0.44; y += 2) {
    for (let x = Math.floor(w * 0.34); x < w * 0.66; x += 2) {
      const i = (y * w + x) * 4;
      const [ph, ps, pl] = hsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
      if (ps < 0.1 || pl < 0.08 || (ph > 0.16 && ph < 0.92)) continue;
      skinBins[Math.floor(ph * BINS) % BINS] += ps;
    }
  }
  let skinBin = 0;
  for (let k = 1; k < BINS; k++) if (skinBins[k] > skinBins[skinBin]) skinBin = k;
  let kh = (skinBin + 0.5) / BINS, ks = 0, kl = 0, kn = 0;
  for (let y = Math.floor(h * 0.18); y < h * 0.44; y += 2) {
    for (let x = Math.floor(w * 0.34); x < w * 0.66; x += 2) {
      const i = (y * w + x) * 4;
      const [ph, ps, pl] = hsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
      if (Math.abs(((ph - kh + 1.5) % 1) - 0.5) < 0.04 && ps > 0.1) { ks += ps; kl += pl; kn++; }
    }
  }
  if (kn) { ks /= kn; kl /= kn; } else kh = -1;
  /** 1 for a pixel the colour of the face's skin, falling to 0 away from it. */
  const skin = (ph: number, ps: number, pl: number) => {
    if (kh < 0) return 0;
    const dh = Math.abs(((ph - kh + 1.5) % 1) - 0.5) * 4;
    const d = Math.hypot(dh, ps - ks, (pl - kl) * 0.9);
    return 1 - Math.min(1, Math.max(0, (d - 0.12) / 0.14));
  };
  // The clothes' hue: the busiest saturated hue in the bottom third, skin left out.
  const bins = new Float32Array(BINS);
  const y0 = Math.floor(h * 0.66);
  for (let y = y0; y < h; y += 2) {
    for (let x = Math.floor(w * 0.08); x < w * 0.92; x += 2) {
      const i = (y * w + x) * 4;
      const [ph, ps, pl] = hsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
      if (ps < 0.18 || pl < 0.1 || pl > 0.9 || skin(ph, ps, pl) > 0.5) continue;
      bins[Math.floor(ph * BINS) % BINS] += ps;
    }
  }
  let best = 0;
  for (let k = 1; k < BINS; k++) if (bins[k] + bins[(k + 1) % BINS] > bins[best] + bins[(best + 1) % BINS]) best = k;
  if (bins[best] === 0) return;
  // That hue's typical saturation and lightness, from the same pixels.
  const sh = (best + 1) / BINS;
  let ss = 0, sl = 0, n = 0;
  for (let y = y0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * 4;
      const [ph, ps, pl] = hsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
      const dh = Math.abs(((ph - sh + 1.5) % 1) - 0.5);
      if (dh < 0.05 && ps > 0.18 && skin(ph, ps, pl) < 0.5) { ss += ps; sl += pl; n++; }
    }
  }
  if (!n) return;
  ss /= n;
  sl /= n;
  // Lightness moves by a ratio but stays inside the paint's range, so a black top still shows its folds.
  const sRatio = Math.min(1.6, ts / Math.max(0.05, ss));
  const lRatio = Math.min(1.8, Math.max(0.35, tl / Math.max(0.05, sl)));
  const fromY = h * 0.42;
  for (let y = Math.floor(fromY); y < h; y++) {
    // Clothes begin under the chin: fade in over the lower middle of the picture.
    const band = Math.min(1, (y - fromY) / (h * 0.16));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [ph, ps, pl] = hsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
      const dh = Math.abs(((ph - sh + 1.5) % 1) - 0.5);
      const near = 1 - Math.min(1, Math.max(0, (dh - 0.06) / 0.06));
      const m = near * Math.min(1, Math.max(0, (ps - 0.1) / 0.12)) * band * (1 - skin(ph, ps, pl));
      if (m <= 0) continue;
      // Keep half of each pixel's own hue offset from the clothes' (wrapped round red), for the paint's variety.
      const off = ((ph - sh + 1.5) % 1) - 0.5;
      const [r, g, b] = rgb(th + off * 0.5, Math.min(1, ps * sRatio), Math.min(0.96, pl * lRatio));
      data[i] = data[i] + (r * 255 - data[i]) * m;
      data[i + 1] = data[i + 1] + (g * 255 - data[i + 1]) * m;
      data[i + 2] = data[i + 2] + (b * 255 - data[i + 2]) * m;
    }
  }
}
