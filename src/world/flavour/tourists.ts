import { Group, type Object3D } from 'three';
import { TOURIST_GROUPS, TOURIST_ROUTES, TOURISTS, type TouristGroup, type TouristProp } from '../../config/flavour/tourists';
import { range } from '../../sim/random';
import { add, box, cylinder } from '../kit';
import { mat } from '../materials';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';
import { prop } from './props';

/**
 * Tourist groups (config/flavour/tourists.ts): one at a time, a group walks
 * a route in a loose file behind its first member, stops at each sight to
 * look and photograph it (a flash of the phone), says a few things in its own
 * clichés, and moves on. Their props are small models that follow them.
 */
const H = 1.72;
const TOURIST_GROUPS_ALL = TOURIST_GROUPS;

/** One member's props, built round a person `h` tall facing +z (attached, so they follow and turn with them). */
function props(root: Object3D, list: readonly TouristProp[], h: number): Group {
  const g = new Group();
  const k = h / H;
  for (const p of list) {
    if (p === 'cap') { add(g, cylinder(0.11, 0.08, mat(0xe8e2d6), 10, 0, h - 0.06 * k, 0)); add(g, box(0.18, 0.02, 0.14, mat(0xe8e2d6), 0, h - 0.05 * k, 0.12)); }
    else if (p === 'bucketHat') { add(g, cylinder(0.12, 0.1, mat(0xc8b48a), 10, 0, h - 0.08 * k, 0)); add(g, cylinder(0.17, 0.02, mat(0xc8b48a), 10, 0, h - 0.09 * k, 0)); }
    else if (p === 'beret') add(g, cylinder(0.13, 0.05, mat(0x1e1e22), 10, 0.02, h - 0.03 * k, -0.01)).rotation.z = 0.15;
    else if (p === 'hornHat') { add(g, cylinder(0.11, 0.06, mat(0x7a5a3a), 10, 0, h - 0.04 * k, 0)); for (const s of [-1, 1]) add(g, box(0.04, 0.16, 0.04, mat(0xe8e0c8), s * 0.12, h - 0.02 * k, 0)).rotation.z = -s * 0.5; }
    else if (p === 'sunglasses') add(g, box(0.15, 0.04, 0.02, mat(0x101012), 0, h - 0.14 * k, 0.1));
    else if (p === 'socks') for (const s of [-1, 1]) add(g, box(0.1, 0.18, 0.11, mat(0xf2f0ea), s * 0.09, 0.02, 0.02));
    else if (p === 'can') add(g, cylinder(0.035, 0.12, mat(0xc8c8c0), 8, 0.24, h * 0.52, 0.08));
    else if (p === 'map') add(g, box(0.4, 0.28, 0.01, mat(0xe8dcb0), 0, h * 0.62, 0.3)).rotation.x = -0.6;
    else if (p === 'camera') add(g, box(0.14, 0.09, 0.08, mat(0x1e1e20), 0.05, h * 0.58, 0.16));
    else if (p === 'baguette') add(g, cylinder(0.035, 0.62, mat(0xd8a050), 6, -0.2, h * 0.42, 0.02)).rotation.x = 1.2;
    else if (p === 'sash') add(g, box(0.06, 0.62, 0.3, mat(0xf0f0f0), 0, h * 0.5, 0.02)).rotation.z = 0.6;
    else if (p === 'processionCross') { add(g, cylinder(0.02, 2.4, mat(0x6a4a2a), 5, 0.2, 0.7, 0.15)); add(g, box(0.05, 0.4, 0.05, mat(0xd8b048), 0.2, 3.1, 0.15)); add(g, box(0.26, 0.05, 0.05, mat(0xd8b048), 0.2, 3.36, 0.15)); }
    else if (p === 'candle') { add(g, cylinder(0.025, 0.32, mat(0xf2ece0), 6, 0.2, h * 0.5, 0.2)); }
    else if (p === 'canopy') { for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) add(g, cylinder(0.02, 2.3, mat(0xd8b048), 5, x, 0.1, z)); add(g, box(1.75, 0.12, 1.75, mat(0xf2e6c0), 0, 2.4, 0)); add(g, box(1.8, 0.2, 1.8, mat(0xd8b048), 0, 2.3, 0)); }
    else if (p === 'banner') { add(g, cylinder(0.02, 2.5, mat(0x6a4a2a), 5, 0.25, 0.6, 0.1)); add(g, box(0.9, 0.04, 0.04, mat(0x6a4a2a), 0.25, 3.0, 0.1)); add(g, box(0.8, 1.0, 0.02, mat(0xa82a3a), 0.25, 2.0, 0.1)); add(g, box(0.4, 0.5, 0.025, mat(0xd8b048), 0.25, 2.3, 0.1)); }
    else if (p === 'stole') add(g, box(0.06, 0.7, 0.32, mat(0xd8b048), 0, h * 0.45, 0.08)).rotation.y = Math.PI / 2;
    else if (p === 'blackHat') { add(g, cylinder(0.12, 0.16, mat(0x101012), 12, 0, h - 0.06 * k, 0)); add(g, cylinder(0.2, 0.02, mat(0x101012), 12, 0, h - 0.07 * k, 0)); }
    else if (p === 'kippah') add(g, cylinder(0.09, 0.03, mat(0x2a2a4a), 10, 0, h - 0.01 * k, -0.03));
    else if (p === 'taqiyah') add(g, cylinder(0.11, 0.08, mat(0xf2f0ea), 12, 0, h - 0.05 * k, 0));
    else if (p === 'veil') { add(g, box(0.26, 0.32, 0.26, mat(0x1e2030), 0, h - 0.24 * k, -0.02)); add(g, box(0.22, 0.04, 0.02, mat(0xf2f0ea), 0, h - 0.06 * k, 0.11)); }
    else if (p === 'briefcase') { add(g, box(0.1, 0.32, 0.42, mat(0x2a1e16), 0.27, h * 0.24, 0)); add(g, box(0.03, 0.06, 0.12, mat(0x8a7a5a), 0.27, h * 0.24 + 0.34, 0)); }
    else if (p === 'tie') add(g, box(0.07, 0.36, 0.02, mat(0x8a1e2a), 0, h * 0.62, 0.13));
    else if (p === 'coffee') { add(g, cylinder(0.04, 0.12, mat(0xf2f0ea), 8, -0.24, h * 0.55, 0.12)); add(g, cylinder(0.042, 0.02, mat(0x1e1e1e), 8, -0.24, h * 0.55 + 0.12, 0.12)); }
    else if (p === 'lanyard') add(g, box(0.07, 0.09, 0.01, mat(0x3a6ab8), 0, h * 0.6, 0.13));
    else if (p === 'flag') { add(g, cylinder(0.015, 2.3, mat(0x4a4a4a), 5, 0.22, 0.9, 0.1)); add(g, box(0.34, 0.24, 0.01, mat(0xf0c030), 0.39, 3.0, 0.1)); }
  }
  g.traverse((o) => { o.castShadow = false; });
  return prop(root, g);
}

interface Tourist { a: Actor; offset: number; side: number; candle: boolean }

export function buildTourists(deps: PackDeps): Pack {
  return walkingGroups(deps, TOURIST_GROUPS, TOURISTS);
}

/**
 * Small groups that walk a route together one at a time and stop at sights
 * (the tourists, the clergy): the same walk for every pack that uses it.
 */
export function walkingGroups({ pool, board, random, scene }: PackDeps, GROUPS: readonly TouristGroup[], timing: { gap: readonly [number, number]; hours: readonly (readonly [number, number])[]; spacing: number; side: number }): Pack {
  const TOURISTS = timing;
  const TOURIST_GROUPS = GROUPS;
  const root = new Group();
  scene.add(root);
  const groups = TOURIST_GROUPS.map((g) => g.members.map((m, i): Tourist => {
    const h = m.dress.height ?? 1.62 + random() * 0.22;
    const a = pool.add({ style: GROUPS === TOURIST_GROUPS_ALL ? 'tourist' : 'everyday', extra: m.dress.extra ?? 'none', dress: { ...m.dress, height: h } });
    a.attach = props(root, m.props, h);
    a.voice = g.voice;
    const candle = m.props.includes('candle');
    if (candle) a.glow = 'flame';
    return { a, offset: i * TOURISTS.spacing, side: (i % 2 ? 1 : -1) * TOURISTS.side * Math.min(1, i), candle };
  }));
  let current = -1;
  let last = -1;
  let wait = range(random, TOURISTS.gap) * 0.3;
  let route = TOURIST_ROUTES[0];
  let leg = 1;
  let stopLeft = 0;
  let sayIn = 2;
  const lead = { x: 0, z: 0, heading: 0 } as Actor;

  const start = () => {
    let i = Math.floor(random() * groups.length);
    if (i === last) i = (i + 1) % groups.length;
    current = last = i;
    route = TOURIST_ROUTES[Math.floor(random() * TOURIST_ROUTES.length)];
    leg = 1;
    stopLeft = 0;
    lead.x = route.path[0].x;
    lead.z = route.path[0].z;
    for (const t of groups[i]) { t.a.x = lead.x; t.a.z = lead.z; }
  };

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) { for (const g of groups) for (const t of g) t.a.shown = 0; current = -1; }
    },
    update(dt, ctx) {
      groups.forEach((g, i) => { if (i !== current) for (const t of g) fade(t.a, false, dt); });
      if (current < 0) {
        const about = TOURISTS.hours.some(([a, b]) => ctx.clock >= a && ctx.clock < b);
        if (about && (wait -= dt) <= 0) start();
        return;
      }
      const group = TOURIST_GROUPS[current];
      const members = groups[current];
      // The group's head walks the route; the others follow in a loose file behind it.
      let stopped = stopLeft > 0;
      if (stopped) stopLeft -= dt;
      // At the route's end the head stays put while the group fades out.
      else if (leg < route.path.length && walkTo(lead, route.path[leg].x, route.path[leg].z, group.pace, dt)) {
        const sight = route.sights.find((s) => s.at === leg);
        if (sight) { stopLeft = group.stop; lead.heading = sight.face; stopped = true; }
        leg++;
      }
      const done = leg >= route.path.length;
      const hx = Math.sin(lead.heading), hz = Math.cos(lead.heading);
      for (const t of members) {
        fade(t.a, !done, dt, 0.8);
        if (stopped) {
          // Gathered round, facing the sight; cameras out, the odd flash.
          walkTo(t.a, lead.x - hx * t.offset * 0.5 + hz * t.side * 1.4, lead.z - hz * t.offset * 0.5 - hx * t.side * 1.4, group.pace, dt);
          if (Math.hypot(t.a.x - lead.x, t.a.z - lead.z) < 2.6) { t.a.pose = 'stand'; t.a.heading = lead.heading; }
          if (!t.candle) t.a.glow = random() < dt * 0.6 ? 'phone' : t.a.glow === 'phone' && random() < dt * 3 ? 'none' : t.a.glow;
        } else {
          if (!t.candle) t.a.glow = 'none';
          walkTo(t.a, lead.x - hx * t.offset + hz * t.side, lead.z - hz * t.offset - hx * t.side, group.pace * 1.15, dt);
        }
      }
      // Something said now and then, while near the middle of the view.
      const talker = members[Math.floor(random() * members.length)].a;
      if ((sayIn -= dt) <= 0 && talker.detailed && talker.shown > 0.9) { sayIn = 7 + random() * 6; board.speak(talker.x, talker.z, group.voice); }
      if (done && members.every((t) => t.a.shown <= 0.01)) { current = -1; wait = range(random, TOURISTS.gap); }
    },
  };
}
