import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial, type Object3D, type Vector3 } from 'three';

/** Most coins in the air at once; past this the oldest is reused. */
const POOL = 32;
/** Seconds a coin takes to rise and fade. */
const LIFE = 1.4;
/** How high it rises, in metres. */
const RISE = 2.2;

function coinTexture(fill: string, rim: string, mark: string): CanvasTexture {
  const n = 64;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(n / 2, n / 2, n / 2 - 3, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = rim;
  g.stroke();
  g.fillStyle = rim;
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(mark, n / 2, n / 2 + 2);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** What happened to someone, drawn as a badge: a death, an arrest, a trip to hospital. */
export type MarkIcon = 'skull' | 'cuffs' | 'cross';

function iconTexture(icon: MarkIcon): CanvasTexture {
  const n = 64;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  // A dark round badge with a light rim, so the mark reads on any ground.
  g.beginPath();
  g.arc(n / 2, n / 2, n / 2 - 3, 0, Math.PI * 2);
  g.fillStyle = icon === 'cross' ? '#f4f4f4' : '#1c1c22';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = icon === 'cross' ? '#c8202a' : '#e8e4dc';
  g.stroke();
  if (icon === 'cross') {
    g.fillStyle = '#d0222c';
    g.fillRect(n / 2 - 7, 14, 14, n - 28);
    g.fillRect(14, n / 2 - 7, n - 28, 14);
  } else if (icon === 'skull') {
    g.fillStyle = '#f0ece2';
    g.beginPath();
    g.arc(n / 2, n / 2 - 4, 16, 0, Math.PI * 2);
    g.fill();
    g.fillRect(n / 2 - 9, n / 2 + 6, 18, 10);
    g.fillStyle = '#1c1c22';
    for (const x of [-6, 6]) { g.beginPath(); g.arc(n / 2 + x, n / 2 - 4, 4.5, 0, Math.PI * 2); g.fill(); }
    for (const x of [-4, 0, 4]) g.fillRect(n / 2 + x - 1, n / 2 + 9, 2, 7);
  } else {
    // Handcuffs: two rings joined by a short chain.
    g.strokeStyle = '#d8dce2';
    g.lineWidth = 5;
    for (const x of [-11, 11]) { g.beginPath(); g.arc(n / 2 + x, n / 2 + 3, 9, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(n / 2 - 4, n / 2 - 6);
    g.lineTo(n / 2 + 4, n / 2 - 6);
    g.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

interface Coin { sprite: Sprite; material: SpriteMaterial; age: number; x: number; y: number; z: number }

/**
 * Coins rising over a building where money moves: gold with a plus where
 * it comes in (donations, the club's fee, paid checking), red with a minus
 * where visits cost it. One pooled sprite each, so a busy night costs
 * nothing extra. The same pool shows badges where something happens to
 * someone: a skull, handcuffs, a red cross. Held still when reduced motion is
 * preferred: no coins or badges.
 */
export class CoinPops {
  private readonly gain = coinTexture('#f2c040', '#8a5a10', '+');
  private readonly loss = coinTexture('#e06050', '#6a1a12', '−');
  private readonly icons: Record<MarkIcon, CanvasTexture> = { skull: iconTexture('skull'), cuffs: iconTexture('cuffs'), cross: iconTexture('cross') };
  private readonly coins: Coin[] = [];
  private next = 0;
  /** Metres per screen pixel now: coins keep about the same size on screen at any zoom. */
  private mpp = 0.1;

  constructor(parent: Object3D) {
    for (let i = 0; i < POOL; i++) {
      // Each coin its own material, so each fades on its own.
      const material = new SpriteMaterial({ map: this.gain, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 10;
      sprite.raycast = () => {};
      parent.add(sprite);
      this.coins.push({ sprite, material, age: LIFE, x: 0, y: 0, z: 0 });
    }
  }

  /** A coin over `at` (a building's label anchor): `gain` true for money in, false for money out. */
  pop(at: Vector3, gain: boolean): void {
    const c = this.coins[this.next];
    this.next = (this.next + 1) % POOL;
    c.age = 0;
    c.x = at.x + (Math.random() - 0.5) * 1.6;
    c.y = Math.max(0.8, at.y - 1.2);
    c.z = at.z + (Math.random() - 0.5) * 1.6;
    c.material.map = gain ? this.gain : this.loss;
    c.sprite.visible = true;
  }

  /** A badge rising where something happened to someone: `at` is where they are (ground level). */
  mark(at: { x: number; z: number }, icon: MarkIcon): void {
    const c = this.coins[this.next];
    this.next = (this.next + 1) % POOL;
    c.age = 0;
    c.x = at.x;
    c.y = 1.9;
    c.z = at.z;
    c.material.map = this.icons[icon];
    c.sprite.visible = true;
  }

  /** Metres per screen pixel, from the camera framing. */
  setPixelSize(metresPerPixel: number): void {
    this.mpp = metresPerPixel;
  }

  /** Moves the coins in the air; returns true while any is showing. */
  update(dt: number): boolean {
    let any = false;
    for (const c of this.coins) {
      if (c.age >= LIFE) continue;
      c.age += dt;
      if (c.age >= LIFE) { c.sprite.visible = false; continue; }
      any = true;
      const k = c.age / LIFE;
      // About 28 px across, shrinking a little as it rises; it rises about 50 px.
      const px = this.mpp;
      c.sprite.position.set(c.x, c.y + Math.max(RISE, 50 * px) * (1 - (1 - k) ** 2), c.z);
      const s = 28 * px * (1 - 0.3 * k);
      c.sprite.scale.set(s, s, 1);
      c.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
    return any;
  }
}
