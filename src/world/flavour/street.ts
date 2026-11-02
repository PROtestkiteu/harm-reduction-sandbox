import { Group } from 'three';
import type { Archetype } from '../../agents/character';
import { DEAL_SPOTS as FIXED_DEALS, RESIDENT_USERS as FIXED_RESIDENTS, SQUAT_SEATS, STREET, USE_SPOTS as FIXED_USES, pocketScene, type DealSpot, type P, type UseSpot } from '../../config/flavour/street';
import { POCKET_PARKS } from '../infill';
import { range } from '../../sim/random';
import { fade, walkTo, type Actor } from './actors';
import type { FlavourContext, Pack, PackDeps } from './index';
import { belongings, bikeProp } from './props';

/**
 * The street drug scene: sellers at a few fixed spots with lookouts, a runner
 * on a bike bringing them more, buyers who come for a quick exchange and leave
 * or stay to use nearby, people using at the squat's door and in the parks.
 * More of it with a bigger street market (the simulation's), less under heavy
 * policing; wardens passing change nothing. Someone now and then nods off flat
 * and a friend crouches by them until they come round.
 */

const BUYER_STYLES: readonly Archetype[] = ['everyday', 'worker', 'unhoused', 'punk', 'hiphop', 'everyday', 'office', 'unhoused'];

interface Buyer {
  a: Actor;
  state: 'away' | 'in' | 'deal' | 'toUse' | 'use' | 'out';
  timer: number;
  spot: number;
  use: number;
  /** Where they leave by. */
  exit: P;
  nodIn: number;
  lightIn: number;
}

interface Sitter { a: Actor; spot: UseSpot; nodIn: number; lightIn: number }

/**
 * The fixed spots plus this launch's pocket parks: the first gets a seller and
 * the flow of buyers, the second (if there is one) people who stay put.
 */
function layout(): { DEAL_SPOTS: DealSpot[]; USE_SPOTS: UseSpot[]; RESIDENT_USERS: UseSpot[] } {
  const deals: DealSpot[] = FIXED_DEALS.map((d) => ({ ...d }));
  const uses = [...FIXED_USES];
  const residents = [...FIXED_RESIDENTS];
  POCKET_PARKS.slice(0, 2).forEach((q, i) => {
    const scene = pocketScene((q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, (q.x1 - q.x0) / 2, (q.z1 - q.z0) / 2, `pocket${i}`);
    if (i === 0) {
      scene.deal.uses = scene.uses.map((_, k) => uses.length + k);
      uses.push(...scene.uses);
      deals.splice(2, 0, scene.deal);
    } else residents.push(...scene.uses);
  });
  return { DEAL_SPOTS: deals, USE_SPOTS: uses, RESIDENT_USERS: residents };
}

export function buildStreet({ pool, board, random, scene }: PackDeps): Pack {
  const { DEAL_SPOTS, USE_SPOTS, RESIDENT_USERS } = layout();
  const root = new Group();
  scene.add(root);
  let enabled = false;
  let market = 0;
  let spotsOn = 1;
  const active = (i: number) => i < spotsOn || (spotsOn === 0 && !!DEAL_SPOTS[i].stubborn);

  const dealers = DEAL_SPOTS.map((d, i) => {
    const a = pool.add({ style: 'technoBlack', kit: { hood: 'up' } }, d.at.x, d.at.z);
    a.heading = d.face;
    a.voice = 'dealer';
    const look = d.lookout ? pool.add({ style: i % 2 ? 'hiphop' : 'everyday', kit: { hood: i % 2 ? 'down' : 'up' } }, d.lookout.x, d.lookout.z) : null;
    if (look) { look.voice = 'lookout'; look.glow = 'phone'; look.heading = d.face + Math.PI; }
    return { a, look };
  });

  // The runner rides the ring's east pavement between the two spots there.
  const runner = pool.add({ style: 'everyday', kit: { hood: 'up' }, extra: 'backpack' }, 46.8, -44);
  runner.attach = bikeProp(root, 0x2a3a4a);
  runner.lift = 0.38;
  const ride: P[] = [{ x: 46.8, z: -44 }, { x: 46.4, z: DEAL_SPOTS[0].at.z - 1.2 }, { x: 46.4, z: DEAL_SPOTS[1].at.z - 1.2 }, { x: 46.8, z: 44 }];
  let leg = 0;
  let dir = 1;
  let runnerWait = 20;
  /** Out along the pavement, a stop at each open spot on the way, then gone a while before riding back. */
  const tickRunner = (dt: number) => {
    runner.pose = 'sit';
    if (runnerWait > 0) {
      runnerWait -= dt;
      const atSpot = leg === 1 || leg === 2;
      fade(runner, atSpot, dt);
      if (atSpot) runner.heading = DEAL_SPOTS[leg - 1].face + Math.PI;
      return;
    }
    fade(runner, true, dt);
    const next = ride[leg + dir];
    if (!next) {
      dir = -dir;
      runnerWait = 30 + random() * 40;
      return;
    }
    if (walkTo(runner, next.x, next.z, STREET.runnerSpeed, dt)) {
      leg += dir;
      if ((leg === 1 || leg === 2) && active(leg - 1)) runnerWait = STREET.runnerStop;
    }
    runner.pose = 'sit';
  };

  const taken = new Set<number>();
  const buyers: Buyer[] = Array.from({ length: STREET.buyers }, (_, i) => ({
    a: pool.add({ style: BUYER_STYLES[i % BUYER_STYLES.length], extra: i % 3 ? 'none' : 'backpack' }),
    state: 'away' as const, timer: random() * 15, spot: 0, use: -1, exit: { x: 0, z: 0 }, nodIn: 8, lightIn: 1,
  }));
  for (const b of buyers) b.a.voice = 'buyer';

  // People who stay put: the residents of the parks, and those at the squat's door.
  const sitter = (spot: UseSpot): Sitter => {
    const a = pool.add({ style: 'unhoused', kit: { bedroll: true }, extra: 'backpack' }, spot.at.x, spot.at.z);
    a.heading = spot.face;
    a.pose = spot.pose;
    a.voice = 'user';
    return { a, spot, nodIn: 10 + random() * 30, lightIn: random() * 40 };
  };
  const residents = RESIDENT_USERS.map(sitter);
  const squatters: Sitter[] = [];
  const squatBags: Group[] = [];
  for (let door = 0; door < 2; door++) {
    for (const s of SQUAT_SEATS) squatters.push(sitter({ at: { x: 0, z: 0 }, face: 0, pose: s.pose, group: `squat${door}` }));
    const bag = belongings(root);
    bag.visible = false;
    squatBags.push(bag);
  }
  let squatShown = 0;
  const sitters = [...residents, ...squatters];

  // Wardens stop by the people sitting out; they never move anyone on.
  for (const s of sitters) board.checks.push({ get x() { return s.a.x; }, get z() { return s.a.z; }, live: () => enabled && s.a.shown > 0.5 });
  for (let i = 0; i < USE_SPOTS.length; i++) {
    const u = USE_SPOTS[i];
    board.checks.push({ x: u.at.x, z: u.at.z, live: () => enabled && taken.has(i) });
  }

  /** Someone using: now and then a light (a lighter, then the smoke), and the slow nod of opioids between. */
  const tickUser = (a: Actor, s: { nodIn: number; lightIn: number }, dt: number) => {
    s.lightIn -= dt;
    if (s.lightIn <= 0) {
      a.glow = a.glow === 'flame' ? 'none' : 'flame';
      a.smokes = a.glow === 'flame';
      s.lightIn = a.glow === 'flame' ? 5 + random() * 4 : 25 + random() * 50;
    }
    s.nodIn -= dt;
    if (s.nodIn <= 0) {
      a.body = a.body === 'nod' ? 'normal' : 'nod';
      s.nodIn = a.body === 'nod' ? 15 + random() * 25 : 10 + random() * 20;
    }
  };

  /** Nods off flat now and then; the nearest person in their group crouches by them until they come round. */
  const slumps = new Map<Actor, { friend: Actor | null; back: { x: number; z: number; pose: Actor['pose']; heading: number } | null; left: number }>();
  const trySlump = (a: Actor, group: string, dt: number) => {
    if (a.lying || slumps.has(a) || random() >= (STREET.slumpPerMinute / 60) * dt) return;
    a.lying = true;
    a.glow = 'none';
    a.smokes = false;
    const mates = sitters.filter((s) => s.a !== a && s.spot.group === group && s.a.shown > 0.9 && !s.a.lying && !slumps.has(s.a));
    const friend = mates[0]?.a ?? null;
    let back = null;
    if (friend) {
      back = { x: friend.x, z: friend.z, pose: friend.pose, heading: friend.heading };
      friend.x = a.x + 0.7;
      friend.z = a.z + 0.3;
      friend.pose = 'crouch';
      friend.heading = Math.atan2(a.x - friend.x, a.z - friend.z);
      friend.voice = 'friend';
    }
    slumps.set(a, { friend, back, left: 25 + random() * 15 });
  };
  const tickSlumps = (dt: number) => {
    for (const [a, s] of slumps) {
      s.left -= dt;
      if (s.left > 0 && enabled) continue;
      a.lying = false;
      a.body = 'normal';
      if (s.friend && s.back) {
        Object.assign(s.friend, { x: s.back.x, z: s.back.z, pose: s.back.pose, heading: s.back.heading });
        s.friend.voice = 'user';
      }
      slumps.delete(a);
    }
  };

  const freeUse = (spot: number): number => {
    const options = DEAL_SPOTS[spot].uses.filter((u) => !taken.has(u));
    return options.length ? options[Math.floor(random() * options.length)] : -1;
  };

  const tickBuyer = (b: Buyer, dt: number) => {
    const a = b.a;
    const d = DEAL_SPOTS[b.spot];
    switch (b.state) {
      case 'away': {
        fade(a, false, dt, 2);
        b.timer -= dt * (0.4 + market);
        if (b.timer > 0 || a.shown > 0) return;
        const open = DEAL_SPOTS.map((_, i) => i).filter(active);
        if (!open.length) { b.timer = 5; return; }
        b.spot = open[Math.floor(random() * open.length)];
        const ends = DEAL_SPOTS[b.spot].approach;
        const from = ends[Math.floor(random() * 2)];
        a.x = from.x;
        a.z = from.z;
        b.exit = ends[Math.floor(random() * 2)];
        a.body = 'normal';
        a.glow = 'none';
        b.state = 'in';
        return;
      }
      case 'in': {
        fade(a, true, dt, 2);
        // Up to the seller, a little to one side, to face them.
        const tx = d.at.x + Math.sin(d.face) * 0.85;
        const tz = d.at.z + Math.cos(d.face) * 0.85;
        if (walkTo(a, tx, tz, 1.25, dt)) {
          a.heading = d.face + Math.PI;
          a.pose = 'talk';
          dealers[b.spot].a.pose = 'talk';
          b.timer = range(random, STREET.exchange);
          b.state = 'deal';
        }
        return;
      }
      case 'deal': {
        b.timer -= dt;
        if (b.timer > 0) return;
        dealers[b.spot].a.pose = 'stand';
        b.use = random() < STREET.staysToUse ? freeUse(b.spot) : -1;
        if (b.use >= 0) taken.add(b.use);
        b.state = b.use >= 0 ? 'toUse' : 'out';
        return;
      }
      case 'toUse': {
        const u = USE_SPOTS[b.use];
        if (walkTo(a, u.at.x, u.at.z, 1.1, dt)) {
          a.heading = u.face;
          a.pose = u.pose;
          a.voice = 'user';
          b.timer = range(random, STREET.useFor);
          b.state = 'use';
        }
        return;
      }
      case 'use': {
        tickUser(a, b, dt);
        trySlump(a, USE_SPOTS[b.use].group, dt);
        b.timer -= dt;
        if (b.timer > 0 || a.lying) return;
        taken.delete(b.use);
        a.glow = 'none';
        a.smokes = false;
        a.body = 'normal';
        a.voice = 'buyer';
        b.use = -1;
        b.state = 'out';
        return;
      }
      case 'out': {
        if (walkTo(a, b.exit.x, b.exit.z, 1.2, dt)) {
          b.state = 'away';
          b.timer = range(random, STREET.away);
        }
        return;
      }
    }
  };

  const placeSquat = (ctx: FlavourContext) => {
    let n = 0;
    ctx.squatDoors.slice(0, 2).forEach((door, d) => {
      SQUAT_SEATS.forEach((seat, i) => {
        const s = squatters[d * SQUAT_SEATS.length + i];
        s.a.x = door.x + door.ax * seat.along + door.nx * (seat.out - 0.6);
        s.a.z = door.z + door.az * seat.along + door.nz * (seat.out - 0.6);
        s.a.heading = Math.atan2(door.nx, door.nz);
        n++;
      });
      const bag = squatBags[d];
      bag.position.set(door.x + door.ax * -2.3 + door.nx * -0.2, 0, door.z + door.az * -2.3 + door.nz * -0.2);
      bag.rotation.y = Math.atan2(door.ax, door.az) + Math.PI / 2;
    });
    return n;
  };
  let doorsSeen: FlavourContext['squatDoors'] | null = null;

  return {
    setEnabled(on) {
      enabled = on;
      root.visible = on;
      if (!on) {
        for (const x of [...dealers.flatMap((d) => [d.a, d.look]), runner, ...buyers.map((b) => b.a), ...residents.map((r) => r.a), ...squatters.map((s) => s.a)]) if (x) x.shown = 0;
        taken.clear();
        for (const b of buyers) { b.state = 'away'; b.timer = random() * 10; }
        tickSlumps(0);
      }
    },
    update(dt, ctx) {
      market = Math.max(0, Math.min(1, ctx.market));
      spotsOn = ctx.patrol >= STREET.scatterAt ? 0 : Math.min(DEAL_SPOTS.length, 1 + Math.floor(market * 3.2));
      dealers.forEach((d, i) => {
        fade(d.a, active(i), dt);
        if (d.look) fade(d.look, active(i), dt);
      });
      tickRunner(dt);
      for (const b of buyers) tickBuyer(b, dt);
      for (const r of residents) {
        fade(r.a, true, dt, 0.8);
        tickUser(r.a, r, dt);
        trySlump(r.a, r.spot.group, dt);
      }
      // The squat's door: more people out front as it fills.
      // The list is replaced only when the squats change.
      if (ctx.squatDoors !== doorsSeen) { doorsSeen = ctx.squatDoors; squatShown = placeSquat(ctx); }
      const want = Math.max(1, Math.round(ctx.squat * SQUAT_SEATS.length));
      squatters.forEach((s, i) => {
        const seat = i % SQUAT_SEATS.length;
        fade(s.a, i < squatShown && seat < want, dt, 0.8);
        tickUser(s.a, s, dt);
        trySlump(s.a, s.spot.group, dt);
      });
      squatBags.forEach((b, d) => { b.visible = d * SQUAT_SEATS.length < squatShown; });
      tickSlumps(dt);
    },
  };
}
