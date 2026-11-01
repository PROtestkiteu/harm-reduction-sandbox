import { Group, type CanvasTexture, type MeshLambertMaterial, type Object3D, type Scene } from 'three';
import { PALETTE } from '../config/palette';
import type { ServiceId } from '../sim/types';
import { add, box, cylinder, pixelTextTexture, signBoard } from './kit';
import { EDGE, HOME_CAMPER, ROAD, VENUE_FRAME, toWorld, type Frame } from './layout';
import { glowMat, mat } from './materials';
import { car } from './vehicles';

/** What the context makes visible in the world. Derived from simulation state, never set on its own. */
export interface WorldContext {
  checkingSites: readonly ServiceId[];
  collectionPoint: boolean;
  publicAlerts: boolean;
  /** A patrol car parked by the crossing (visible-deterrence policing). */
  policeCar: boolean;
  /** The outreach camper has a parking permit; without one it drives off. */
  camperPermitted: boolean;
}

const SIGN_FG = '#123a34';
const SIGN_BG = '#8fe0c8';

/** A lit "DRUG CHECK" board on two legs, facing +z; sized per site so it reads at diorama scale. */
function checkSign(width: number, height: number, legs: number): Group {
  const g = new Group();
  for (const x of [-width * 0.38, width * 0.38]) add(g, cylinder(0.06, legs + 0.05, mat(PALETTE.metal), 5, x, 0, 0));
  const { mesh } = signBoard('DRUG CHECK', width, height, SIGN_FG, SIGN_BG, 1.2);
  mesh.position.y = legs;
  g.add(mesh);
  return g;
}

/**
 * Props that show the policy context in the scene: where samples are checked,
 * a lab drop box, a public early-warning board, a patrol car, and the outreach
 * camper leaving when it has no permit.
 */
export class ContextProps {
  /** Checking signs for the services that can host checking; the drug checking service has its own frontage. */
  private readonly signs: Partial<Record<ServiceId, Group>>;
  private readonly dropBox: Group;
  private readonly board: Group;
  private readonly boardFace: MeshLambertMaterial;
  private readonly calm = pixelTextTexture('INFO', '#9fe8d4', '#1a2a30');
  private readonly alarms = new Map<string, CanvasTexture>();
  private alarm = this.alarmTexture('ALERT');
  private readonly policeCar: Group;
  private readonly lightBar: [MeshLambertMaterial, MeshLambertMaterial];
  private alertLeft = 0;
  private alertShown = false;
  private camperAway = 0;
  private camperTarget = 0;
  private time = 0;

  constructor(scene: Scene, private readonly camper: { template: Object3D; drive: Object3D }, private readonly reducedMotion: () => boolean) {
    const root = add(scene, new Group());

    // Checking signs where the camera sees them: on the drop-in's front parapet,
    // along the camper roof (it drives off with the camper), beside the club stand.
    const dropIn = checkSign(4.4, 1.0, 0.35);
    placeAt(dropIn, VENUE_FRAME.dropIn, 8.0, 7.2, -7.75);
    const outreach = checkSign(3.8, 0.7, 0.25);
    outreach.position.set(0, 3.15, 3.65);
    outreach.rotation.y = Math.PI / 2;
    camper.template.add(outreach);
    const stand = checkSign(2.8, 0.62, 1.75);
    placeAt(stand, VENUE_FRAME.club, -13.2, 0.12, 6.9);
    root.add(dropIn, stand);
    this.signs = { dropIn, outreach, clubHr: stand };

    // Collection point: a lab drop box by the drop-in door.
    this.dropBox = add(root, new Group());
    add(this.dropBox, box(0.55, 1.0, 0.45, mat(PALETTE.centerAccent)));
    add(this.dropBox, box(0.4, 0.05, 0.08, mat(PALETTE.frame), 0, 0.82, 0.23));
    const label = signBoard('LAB', 0.5, 0.2, SIGN_FG, SIGN_BG, 0.7).mesh;
    label.position.set(0, 1.02, 0.05);
    this.dropBox.add(label);
    placeAt(this.dropBox, VENUE_FRAME.dropIn, 3.25, 0.12, -6.75);

    // Public early-warning board at the east kerb, facing the street.
    this.board = add(root, new Group());
    for (const dz of [-0.85, 0.85]) add(this.board, cylinder(0.06, 1.6, mat(PALETTE.metal), 5, 0, 0, dz));
    const face = signBoard('INFO', 2.1, 0.9, '#9fe8d4', '#1a2a30', 1.2);
    face.mesh.position.y = 1.45;
    face.mesh.rotation.y = Math.PI / 2;
    this.board.add(face.mesh);
    this.boardFace = face.material;
    this.board.position.set(2.25, 0.12, -0.35);

    // Patrol car parked between the crossing and the camper, light bar on.
    this.policeCar = add(root, car(PALETTE.policeVest, false));
    const blue = glowMat(0x2a3a7a, 0x5a8aff, 1.6);
    const red = glowMat(0x6a2a2a, 0xff5a4a, 0.2);
    add(this.policeCar, box(0.5, 0.12, 0.3, blue, -0.3, 1.32, -0.25));
    add(this.policeCar, box(0.5, 0.12, 0.3, red, 0.3, 1.32, -0.25));
    add(this.policeCar, box(1.82, 0.14, 1.2, mat(PALETTE.policeBand), 0, 0.55, 0.4));
    this.lightBar = [blue, red];
    this.policeCar.position.set(ROAD.parkX, 0.02, -0.9);

    this.set({ checkingSites: [], collectionPoint: false, publicAlerts: false, policeCar: false, camperPermitted: true });
  }

  set(c: WorldContext): void {
    for (const id of Object.keys(this.signs) as ServiceId[]) this.signs[id]!.visible = c.checkingSites.includes(id);
    this.dropBox.visible = c.collectionPoint;
    this.board.visible = c.publicAlerts;
    if (!c.publicAlerts) this.alertLeft = 0;
    this.policeCar.visible = c.policeCar;
    this.camperTarget = c.camperPermitted ? 0 : 1;
  }

  /** A check found something unexpected: the board flashes the word (the substance, during a supply event). */
  flashAlert(word = 'ALERT'): void {
    if (!this.board.visible) return;
    this.alarm = this.alarmTexture(word);
    this.alertShown = false;
    this.alertLeft = 12;
  }

  private alarmTexture(word: string): CanvasTexture {
    let tex = this.alarms.get(word);
    if (!tex) {
      tex = pixelTextTexture(word, '#2a1a10', '#ffc060');
      this.alarms.set(word, tex);
    }
    return tex;
  }

  /** Advances animations; returns true when something visible changed. */
  update(dt: number): boolean {
    this.time += dt;
    let changed = false;

    const alerting = this.alertLeft > 0;
    if (alerting) this.alertLeft -= dt;
    // Blinks while alerting unless reduced motion is on, then it stays lit.
    const showAlarm = alerting && (this.reducedMotion() || Math.floor(this.time * 2) % 2 === 0);
    if (showAlarm !== this.alertShown) {
      this.alertShown = showAlarm;
      this.boardFace.map = this.boardFace.emissiveMap = showAlarm ? this.alarm : this.calm;
      this.boardFace.needsUpdate = true;
      changed = true;
    }

    if (this.policeCar.visible && !this.reducedMotion()) {
      const phase = Math.floor(this.time * 3) % 2;
      this.lightBar[0].emissiveIntensity = phase ? 1.6 : 0.2;
      this.lightBar[1].emissiveIntensity = phase ? 0.2 : 1.6;
      changed = true;
    }

    // Without a permit the camper pulls into the lane and drives off out of the district.
    if (this.camperAway !== this.camperTarget) {
      const step = dt / 12;
      this.camperAway = this.camperTarget > this.camperAway ? Math.min(this.camperTarget, this.camperAway + step) : Math.max(this.camperTarget, this.camperAway - step);
      const p = this.camperAway;
      // In the van's own frame: out into the lane beside it, then on ahead.
      this.camper.drive.position.x = (ROAD.laneX - HOME_CAMPER.x) * Math.min(1, p * 3);
      this.camper.drive.position.z = Math.max(0, (p - 0.33) / 0.67) * (EDGE + 6);
      changed = true;
    }
    return changed;
  }
}

/** Puts a prop designed at (x, y, z) beside a venue where that venue stands this launch. */
function placeAt(o: Object3D, f: Frame, x: number, y: number, z: number): void {
  const w = toWorld(f, { x, z });
  o.position.set(w.x, y, w.z);
  o.rotation.y += f.rot;
}
