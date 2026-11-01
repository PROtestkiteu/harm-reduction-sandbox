import { CanvasTexture, Mesh, MeshLambertMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from 'three';
import type { Random } from '../sim/random';

/** Muted psychedelic colours: dusk purples, teals, ochres, a faded coral. */
const INKS = ['#7a5a9a', '#3a8a8a', '#c8a050', '#c86a5a', '#5a7ab0', '#9aa85a'];

type Pattern = 'mushroom' | 'cat' | 'blob' | 'phrase';

/** Rainbow bands for the lettering, in the muted inks. */
function rainbow(g: CanvasRenderingContext2D, w: number): CanvasGradient {
  const grad = g.createLinearGradient(0, 0, w, 0);
  INKS.forEach((c, i) => grad.addColorStop(i / (INKS.length - 1), c));
  return grad;
}

function muralTexture(pattern: Pattern, random: Random, phrase = ''): CanvasTexture {
  const w = 160;
  const h = 120;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const ink = (i: number) => INKS[i % INKS.length];
  const eye = (x: number, y: number, r: number) => {
    g.fillStyle = '#efe6d2'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    // Spiral pupils: a few rings, the trippy part.
    for (let k = 0; k < 3; k++) { g.strokeStyle = ink(k); g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * (0.8 - k * 0.25), 0, Math.PI * 1.6); g.stroke(); }
    g.fillStyle = '#1c1820'; g.beginPath(); g.arc(x, y, r * 0.18, 0, Math.PI * 2); g.fill();
  };
  g.lineCap = 'round';
  if (pattern === 'mushroom') {
    // A mushroom character: spotted cap, a face on the stalk, a wide smile.
    g.fillStyle = ink(2); g.fillRect(w / 2 - 20, h / 2 - 2, 40, 52);
    g.fillStyle = ink(3); g.beginPath(); g.ellipse(w / 2, h / 2 + 2, 62, 44, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#efe6d2';
    for (const [x, y, r] of [[-34, -16, 8], [-8, -30, 9], [22, -20, 7], [42, -6, 5], [-50, -2, 5]] as const) { g.beginPath(); g.arc(w / 2 + x, h / 2 + y, r, 0, Math.PI * 2); g.fill(); }
    eye(w / 2 - 9, h / 2 + 16, 7); eye(w / 2 + 9, h / 2 + 16, 7);
    g.strokeStyle = '#1c1820'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2 + 30, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  } else if (pattern === 'cat') {
    // A cat's head with spiral eyes and a third eye on its brow.
    g.fillStyle = ink(0);
    g.beginPath(); g.moveTo(w / 2 - 46, h / 2 - 8); g.lineTo(w / 2 - 38, h / 2 - 52); g.lineTo(w / 2 - 12, h / 2 - 30); g.fill();
    g.beginPath(); g.moveTo(w / 2 + 46, h / 2 - 8); g.lineTo(w / 2 + 38, h / 2 - 52); g.lineTo(w / 2 + 12, h / 2 - 30); g.fill();
    g.beginPath(); g.ellipse(w / 2, h / 2 + 6, 50, 44, 0, 0, Math.PI * 2); g.fill();
    eye(w / 2 - 20, h / 2 + 4, 13); eye(w / 2 + 20, h / 2 + 4, 13); eye(w / 2, h / 2 - 24, 8);
    g.strokeStyle = '#efe6d2'; g.lineWidth = 2;
    for (const s of [-1, 1]) for (const dy of [-4, 4]) { g.beginPath(); g.moveTo(w / 2 + s * 14, h / 2 + 28 + dy); g.lineTo(w / 2 + s * 46, h / 2 + 24 + dy * 2); g.stroke(); }
  } else if (pattern === 'blob') {
    // A grinning blob with three eyes and wavy arms.
    g.fillStyle = ink(1);
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.2) { const r = 44 + Math.sin(a * 5) * 6; g.lineTo(w / 2 + Math.cos(a) * r * 1.2, h / 2 + Math.sin(a) * r * 0.85); }
    g.fill();
    eye(w / 2 - 22, h / 2 - 8, 10); eye(w / 2 + 2, h / 2 - 16, 12); eye(w / 2 + 26, h / 2 - 6, 9);
    g.strokeStyle = '#1c1820'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h / 2 + 8, 18, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
  } else {
    // A phrase in hand lettering, rainbow ink with a dark outline.
    const words = phrase.split(' ');
    const lines: string[] = [];
    for (const word of words) { const last = lines[lines.length - 1]; if (last && (last + ' ' + word).length <= 10) lines[lines.length - 1] = last + ' ' + word; else lines.push(word); }
    const size = Math.min(34, Math.floor(108 / lines.length));
    g.font = `${size}px 'Permanent Marker', 'Roboto Condensed', sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    lines.forEach((line, i) => {
      const y = h / 2 + (i - (lines.length - 1) / 2) * size * 1.05;
      g.lineWidth = 6; g.strokeStyle = '#1c1820'; g.strokeText(line, w / 2, y);
      g.fillStyle = rainbow(g, w); g.fillText(line, w / 2, y);
    });
  }
  // Spray-paint edges: knock out a ragged border so it reads as paint on a wall.
  const img = g.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
    if (edge < 6 && random() < 0.6 - edge * 0.09) img.data[(y * w + x) * 4 + 3] = 0;
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Where a mural goes: a point on a real surface, and which way that surface faces (+x, +z, or up for a flat roof). */
export interface MuralSpot { x: number; y: number; z: number; face: 'x' | 'z' | 'up' }

/**
 * A handful of low-key psychedelic murals: a mushroom character, a cat with
 * spiral eyes, a three-eyed blob, a couple of phrases in rainbow lettering;
 * on walls the camera sees, and one on a flat shopfront roof. Shared textures,
 * flat paint, no glow; a few draw calls in all.
 */
export function buildMurals(parent: Object3D, spots: readonly MuralSpot[], random: Random): void {
  const kinds: [Pattern, string][] = [['mushroom', ''], ['phrase', 'START LOW, GO SLOW'], ['cat', ''], ['phrase', 'BE HERE NOW'], ['blob', '']];
  const mats = kinds.map(([p, text]) => new MeshLambertMaterial({ map: muralTexture(p, random, text), transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  spots.forEach((at, i) => {
    const plane = new Mesh(new PlaneGeometry(4.0, 3.0), mats[i % mats.length]);
    plane.position.set(at.x, at.y, at.z);
    if (at.face === 'x') plane.rotation.y = Math.PI / 2;
    else if (at.face === 'up') { plane.rotation.x = -Math.PI / 2; plane.rotation.z = random() * Math.PI; }
    parent.add(plane);
  });
}
