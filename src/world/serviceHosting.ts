import { Matrix4, Vector3 } from 'three';
import type { ServiceId, LocationId } from '../sim/types';
import type { ServiceSite } from '../sim/serviceSites';
import { frontDoor, frontFrame, type CityBuilding } from './cityBuildings';
import { CAMPER_SPOTS, PATROL, LOTS, SPOTS, SERVICE_NODES, nearestNodeTo, CENTER_QUEUE_DIR, STAND_QUEUE_DIR, VENUE_ROT, type P2 } from './layout';
import type { LocationVisual } from './buildings';

/** Rebind shared destinations in place, so queueing and subsequent routes use the chosen entrance. */
export class ServiceHosting {
  private readonly originals = new Map<ServiceId, { reset(): void }>();
  private readonly hosts = new Map<ServiceId, number>();
  constructor(private readonly locations: Record<LocationId, LocationVisual>, private readonly transformStage: (id: ServiceId, matrix: Matrix4) => void = () => {}) {}
  building(service: ServiceId): number | undefined { return this.hosts.get(service); }
  private placePatrol(id: number): void {
    const spot = CAMPER_SPOTS[id];
    if (!spot) return;
    const frame = PATROL.frame;
    const angle = spot.rot - frame.rot;
    const c = Math.cos(angle), s = Math.sin(angle);
    const transform = (p: P2): P2 => ({ x: spot.x + (p.x - frame.x) * c + (p.z - frame.z) * s, z: spot.z - (p.x - frame.x) * s + (p.z - frame.z) * c });
    const undo: (() => void)[] = [];
    const seen = new Set<P2>();
    const move = (p: P2, direction = false) => {
      if (seen.has(p)) return;
      seen.add(p);
      const before = { ...p };
      undo.push(() => Object.assign(p, before));
      Object.assign(p, direction ? { x: p.x * c + p.z * s, z: -p.x * s + p.z * c } : transform(p));
    };
    const loc = this.locations.footPatrol;
    loc.root.updateMatrix();
    const matrix = loc.root.matrix.clone();
    const anchor = loc.labelAnchor.clone(), footprint = { ...loc.footprint };
    const originalFrame = { ...frame };
    const node = SERVICE_NODES.footPatrol;
    const facing = PATROL.facing;
    undo.push(() => { loc.root.matrix.copy(matrix).decompose(loc.root.position, loc.root.quaternion, loc.root.scale); loc.labelAnchor.copy(anchor); Object.assign(loc.footprint, footprint); Object.assign(frame, originalFrame); SERVICE_NODES.footPatrol = node; PATROL.facing = facing; });
    const m = new Matrix4().makeTranslation(spot.x, 0, spot.z).multiply(new Matrix4().makeRotationY(angle)).multiply(new Matrix4().makeTranslation(-frame.x, 0, -frame.z));
    this.transformStage('footPatrol', m);
    undo.push(() => this.transformStage('footPatrol', m.clone().invert()));
    loc.root.applyMatrix4(m);
    loc.labelAnchor.applyMatrix4(m);
    Object.assign(loc.footprint, transform(footprint));
    if (Math.abs(s) > .5) { loc.footprint.rx = footprint.rz; loc.footprint.rz = footprint.rx; }
    move(PATROL.table); PATROL.staff.forEach(p => move(p)); PATROL.served.forEach(p => move(p));
    move(LOTS.footPatrol.door); move(LOTS.footPatrol.inside); move(LOTS.footPatrol.queueHead); move(LOTS.footPatrol.queueDir, true);
    Object.assign(frame, { x: spot.x, z: spot.z, rot: spot.rot });
    PATROL.facing = facing + angle;
    SERVICE_NODES.footPatrol = nearestNodeTo(PATROL.table);
    this.originals.set('footPatrol', { reset: () => undo.forEach(reset => reset()) });
  }
  set(service: ServiceId, site: ServiceSite, building?: CityBuilding): void {
    this.originals.get(service)?.reset();
    this.originals.delete(service);
    this.hosts.delete(service);
    if (service === 'footPatrol' && site.kind === 'curb') { this.placePatrol(site.id); return; }
    if (site.kind !== 'building' || !building || service === 'outreach' || service === 'footPatrol') return;
    const loc = this.locations[service === 'clubHr' ? 'club' : service];
    const snapshots: (() => void)[] = [];
    const point = (p: P2, next: P2) => {
      const before = { ...p };
      snapshots.push(() => Object.assign(p, before));
      Object.assign(p, next);
    };
    const { door, normal } = frontDoor(building, .25);
    const along = { x: normal.z, z: -normal.x };
    const at = (x: number, z: number): P2 => ({ x: door.x + along.x * x + normal.x * z, z: door.z + along.z * x + normal.z * z });
    const node = SERVICE_NODES[service];
    snapshots.push(() => { SERVICE_NODES[service] = node; });
    SERVICE_NODES[service] = nearestNodeTo(at(0, 1.2));
    if (service === 'dropIn') {
      point(SPOTS.centerDoor, at(0, 0)); point(SPOTS.centerInside, at(0, -1));
      point(SPOTS.centerFront, at(0, 1)); point(SPOTS.centerGreeter, at(-.8, .5));
      point(SPOTS.centerQueue, at(1, 1)); point(CENTER_QUEUE_DIR, along);
      SPOTS.centerSeats.forEach((p, i) => point(p, at(-1 + i * .5, -.7)));
      SPOTS.centerStanding.forEach((p, i) => point(p, at(-1 + i * .5, -.5)));
      const rot = VENUE_ROT.dropIn; snapshots.push(() => { VENUE_ROT.dropIn = rot; });
      VENUE_ROT.dropIn = frontFrame(building).rot;
    } else if (service === 'clubHr') {
      const rot = VENUE_ROT.clubHr; snapshots.push(() => { VENUE_ROT.clubHr = rot; });
      VENUE_ROT.clubHr = frontFrame(building).rot - Math.PI / 2;
      SPOTS.standCounter.forEach((p, i) => point(p, at(i * .8, .4)));
      SPOTS.standStaff.forEach((p, i) => point(p, at(i * .8, 0)));
      point(SPOTS.standQueueHead, at(-1, 1)); point(SPOTS.standApproach, at(-1, 1.4)); point(STAND_QUEUE_DIR, along);
    } else {
      const lot = LOTS[service];
      point(lot.door, at(0, 0)); point(lot.inside, at(0, -1));
      point(lot.queueHead, at(1, 1)); point(lot.queueDir, along);
    }
    const anchor = loc.labelAnchor.clone();
    const footprint = { ...loc.footprint };
    const visible = loc.root.visible;
    const vacantVisible = loc.vacantRoot?.visible;
    snapshots.push(() => { loc.labelAnchor.copy(anchor); Object.assign(loc.footprint, footprint); loc.root.visible = visible; if (loc.vacantRoot && vacantVisible !== undefined) loc.vacantRoot.visible = vacantVisible; });
    loc.labelAnchor.copy(new Vector3((building.x0 + building.x1) / 2, building.height + 2, (building.z0 + building.z1) / 2));
    Object.assign(loc.footprint, { x: (building.x0 + building.x1) / 2, z: (building.z0 + building.z1) / 2, rx: (building.x1 - building.x0) / 2, rz: (building.z1 - building.z0) / 2 });
    // The selected building supplies the shell; its service fit-out supplies the frontage.
    if (service !== 'clubHr') {
      loc.root.visible = false;
      if (loc.vacantRoot) loc.vacantRoot.visible = true;
    }
    else {
      const stand = loc.root.getObjectByName('clubStand');
      if (stand) { const visible = stand.visible; snapshots.push(() => { stand.visible = visible; }); stand.visible = false; }
    }
    this.originals.set(service, { reset: () => snapshots.forEach(reset => reset()) });
    this.hosts.set(service, building.id);
  }
}
