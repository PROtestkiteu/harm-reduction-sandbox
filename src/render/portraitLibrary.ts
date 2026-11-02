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
  private active: AbortController | null = null;
  private url: string | null = null;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  show(url: string | null): void {
    if (url === this.url) return;
    this.active?.abort();
    this.active = null;
    this.url = url;
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
    this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
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
  }
}
