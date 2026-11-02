import { LINES } from '../../config/flavour/lines';
import type { Actor } from './actors';
import type { Pack, PackDeps } from './index';

/**
 * Overheard lines: now and then someone near the middle of the view says
 * something short, in a small tag over their head that fades after a few
 * seconds. Witnesses and wardens (the board's notes) are heard first. At most
 * three tags at once, from a fixed set of elements; while none shows, nothing
 * runs but a countdown. The tags are decoration for sighted players and are
 * hidden from screen readers, which hear the event feed instead.
 */
const MAX = 3;
const SHOW = 4.2;

interface Tag { el: HTMLDivElement; left: number; actor: Actor | null; x: number; y: number; z: number; follow: (() => { x: number; y: number; z: number }) | null }

export function buildLines({ overlay, pool, board, random, toScreen, crowdVoices }: PackDeps): Pack {
  const layer = document.createElement('div');
  layer.className = 'overheard';
  layer.setAttribute('aria-hidden', 'true');
  overlay.append(layer);
  const tags: Tag[] = Array.from({ length: MAX }, () => {
    const el = document.createElement('div');
    el.className = 'overheard-line';
    el.hidden = true;
    layer.append(el);
    return { el, left: 0, actor: null, x: 0, y: 0, z: 0, follow: null };
  });
  let next = 3;
  let enabled = false;
  const pickLine = (voice: string) => {
    const list = LINES[voice];
    return list?.length ? list[Math.floor(random() * list.length)] : '';
  };
  const show = (text: string, at: { x: number; y: number; z: number }, actor: Actor | null, follow: Tag['follow'] = null) => {
    if (!text) return;
    const tag = tags.find((t) => t.left <= 0) ?? tags.reduce((a, b) => (a.left < b.left ? a : b));
    tag.el.textContent = text;
    tag.el.hidden = false;
    tag.el.classList.remove('fading');
    tag.left = SHOW;
    tag.actor = actor;
    tag.follow = follow;
    Object.assign(tag, at);
  };
  const place = (tag: Tag) => {
    const p = tag.actor ? { x: tag.actor.x, y: 2.2 + tag.actor.lift, z: tag.actor.z } : tag.follow ? tag.follow() : tag;
    const s = toScreen(p.x, p.y, p.z);
    tag.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
  };
  return {
    setEnabled(on) {
      enabled = on;
      layer.hidden = !on;
      if (!on) for (const t of tags) { t.left = 0; t.el.hidden = true; }
    },
    update(dt) {
      if (!enabled) return;
      // Witnesses and wardens first.
      while (board.notes.length) {
        const n = board.notes.shift()!;
        show(n.voice ? pickLine(n.voice) : n.text, { x: n.x, y: 2.3, z: n.z }, null);
      }
      next -= dt;
      if (next <= 0) {
        next = 3 + random() * 4;
        // Someone in view with a voice, from the packs' people and the crowd alike.
        const near = pool.actors.filter((a) => a.detailed && a.voice && a.shown > 0.9 && !a.lying && !tags.some((t) => t.actor === a));
        const crowd = crowdVoices();
        const total = near.length + crowd.length;
        if (total) {
          const k = Math.floor(random() * total);
          if (k < near.length) show(pickLine(near[k].voice!), { x: 0, y: 0, z: 0 }, near[k]);
          else {
            const c = crowd[k - near.length];
            show(pickLine(c.voice), c.at(), null, c.at);
          }
        }
      }
      for (const t of tags) {
        if (t.left <= 0) continue;
        t.left -= dt;
        if (t.left <= 0.6) t.el.classList.add('fading');
        if (t.left <= 0) { t.el.hidden = true; t.actor = null; continue; }
        place(t);
      }
    },
  };
}
