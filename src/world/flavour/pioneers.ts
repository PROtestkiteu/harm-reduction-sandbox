import { Group } from 'three';
import { PIONEERS, PIONEER_TIMING, PIONEER_WALK } from '../../config/flavour/pioneers';
import { PIONEER_LINES } from '../../config/flavour/lines';
import { CYCLING } from '../../config/flavour/cycling';
import { range } from '../../sim/random';
import { fade, walkTo } from './actors';
import type { Pack, PackDeps } from './index';
import { bikeProp } from './props';

/**
 * Easter eggs (config/flavour/pioneers.ts): now and then one of five
 * pioneers of psychedelic research and practice walks the ring road's outer
 * pavements, or, for Albert Hofmann, rides the bike lane, saying a line of
 * harm reduction sense in their spirit while in view. One at a time.
 */
export function buildPioneers({ pool, board, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const people = PIONEERS.map((p) => {
    const a = pool.add({ style: p.style, extra: p.extra ?? 'none', dress: p.dress });
    if (p.bike) { a.attach = bikeProp(root, 0x3a3a3e); a.pose = 'sit'; a.lift = 0.38; a.speed = 1; }
    return { p, a };
  });
  let current = -1;
  let last = -1;
  let wait = range(random, PIONEER_TIMING.gap) * 0.4;
  let leg = 0;
  let sayIn = 2;
  // The rider's line along the ring road's north side, eastbound, keeping right: the bike lane by the inner kerb.
  const lane = { z: -CYCLING.inner, x0: -62, x1: 62 };

  const start = () => {
    let i = Math.floor(random() * people.length);
    if (i === last) i = (i + 1) % people.length;
    current = last = i;
    leg = 1;
    sayIn = 2;
    const { p, a } = people[i];
    if (p.bike) { a.x = lane.x0; a.z = lane.z; a.heading = Math.PI / 2; }
    else { a.x = PIONEER_WALK[0].x; a.z = PIONEER_WALK[0].z; }
  };

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) { for (const { a } of people) a.shown = 0; current = -1; }
    },
    update(dt) {
      people.forEach(({ a }, i) => { if (i !== current) fade(a, false, dt); });
      if (current < 0) {
        if ((wait -= dt) <= 0) start();
        return;
      }
      const { p, a } = people[current];
      let done = false;
      if (p.bike) {
        fade(a, a.x < lane.x1 - 6, dt, 1);
        a.x += PIONEER_TIMING.ride * dt;
        a.pose = 'sit';
        done = a.x >= lane.x1;
      } else {
        const target = PIONEER_WALK[leg];
        fade(a, leg < PIONEER_WALK.length - 1 || Math.hypot(a.x - target.x, a.z - target.z) > 5, dt, 1);
        if (walkTo(a, target.x, target.z, PIONEER_TIMING.pace, dt)) leg++;
        done = leg >= PIONEER_WALK.length;
      }
      // A line now and then while they are near the middle of the view.
      if (a.detailed && a.shown > 0.9 && (sayIn -= dt) <= 0) {
        sayIn = PIONEER_TIMING.say;
        const lines = PIONEER_LINES[p.id];
        board.say(a.x, a.z, lines[Math.floor(random() * lines.length)]);
      }
      if (done) { current = -1; wait = range(random, PIONEER_TIMING.gap); }
    },
  };
}
