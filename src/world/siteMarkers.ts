import { BoxGeometry, BufferGeometry, Color, ConeGeometry, EdgesGeometry, Float32BufferAttribute, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, Vector3, type Object3D } from 'three';
export interface SiteFootprint { x: number; z: number; width: number; depth: number; height: number; rotation: number }
export const PLACEMENT_COLORS = { available: 0x2abb78, selected: 0x368fea } as const;
/** Batched highlights and invisible picking proxies exist only while choosing a site. */
export class SiteMarkers {
  private readonly root = new Group();
  private readonly cube = new BoxGeometry(1, 1, 1);
  private readonly edges = new EdgesGeometry(this.cube);
  private readonly lines = new BufferGeometry();
  private readonly lineColours: Float32BufferAttribute;
  private readonly pin = new ConeGeometry(.55, 1.1, 6);
  private readonly fill = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .16, depthWrite: false });
  private readonly outline = new LineBasicMaterial({ color: 0xffffff, vertexColors: true });
  private readonly pins = new MeshBasicMaterial({ color: 0xffffff });
  private readonly hit = new MeshBasicMaterial({ visible: false });
  private readonly available = new Color(PLACEMENT_COLORS.available);
  private readonly chosen = new Color(PLACEMENT_COLORS.selected);
  private readonly volumes: InstancedMesh;
  private readonly pinInstances: InstancedMesh;
  readonly targets: { id: number; root: Group }[];
  constructor(parent: Object3D, readonly footprints: readonly SiteFootprint[]) {
    this.root.name = 'serviceSiteMarkers';
    const proxies = new Group(); proxies.name = 'serviceSiteTargets'; this.root.add(proxies);
    this.targets = footprints.map((f, id) => {
      const root = new Group(); root.position.set(f.x, 0, f.z); root.rotation.y = f.rotation;
      const volume = new Group(); volume.position.y = f.height / 2 + .16;
      volume.scale.set(f.width + .2, Math.max(.12, f.height), f.depth + .2);
      volume.add(new Mesh(this.cube, this.hit));
      const pin = new Mesh(this.pin, this.hit); pin.position.y = Math.max(4.2, f.height + 1.1); pin.rotation.x = Math.PI;
      root.add(volume, pin); proxies.add(root); return { id, root };
    });
    parent.add(this.root); this.root.updateMatrixWorld(true);
    this.volumes = new InstancedMesh(this.cube, this.fill, footprints.length);
    this.pinInstances = new InstancedMesh(this.pin, this.pins, footprints.length);
    const inverse = this.root.matrixWorld.clone().invert(), matrix = new Matrix4(), point = new Vector3();
    const vertices: number[] = [], colours: number[] = [], source = this.edges.getAttribute('position');
    for (const { id, root } of this.targets) {
      matrix.multiplyMatrices(inverse, root.children[0].matrixWorld);
      this.volumes.setMatrixAt(id, matrix); this.volumes.setColorAt(id, this.available);
      for (let i = 0; i < source.count; i++) { point.fromBufferAttribute(source, i).applyMatrix4(matrix); vertices.push(point.x, point.y, point.z); colours.push(this.available.r, this.available.g, this.available.b); }
      matrix.multiplyMatrices(inverse, root.children[1].matrixWorld);
      this.pinInstances.setMatrixAt(id, matrix); this.pinInstances.setColorAt(id, this.available);
    }
    this.volumes.computeBoundingSphere(); this.pinInstances.computeBoundingSphere();
    this.lines.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    this.lineColours = new Float32BufferAttribute(colours, 3);
    this.lines.setAttribute('color', this.lineColours);
    this.root.add(this.volumes, this.pinInstances, new LineSegments(this.lines, this.outline));
  }
  private selected: number | null = null;
  select(id: number | null): void {
    if (id === this.selected || (id !== null && !this.targets[id])) return;
    for (const index of [this.selected, id]) {
      if (index === null || !this.targets[index]) continue;
      const colour = index === id ? this.chosen : this.available;
      this.volumes.setColorAt(index, colour); this.pinInstances.setColorAt(index, colour);
      const colours = this.lineColours;
      const count = this.edges.getAttribute('position').count, start = index * count;
      for (let vertex = start; vertex < start + count; vertex++) colours.setXYZ(vertex, colour.r, colour.g, colour.b);
      colours.addUpdateRange(start * 3, count * 3); colours.needsUpdate = true;
    }
    this.volumes.instanceColor!.needsUpdate = true; this.pinInstances.instanceColor!.needsUpdate = true;
    this.selected = id;
  }
  dispose(): void {
    this.root.removeFromParent(); this.volumes.dispose(); this.pinInstances.dispose();
    for (const item of [this.cube, this.edges, this.lines, this.pin, this.fill, this.outline, this.pins, this.hit]) item.dispose();
  }
}
