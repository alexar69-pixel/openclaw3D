import * as THREE from 'three';
import { isExecuting, type OfficeAgent } from '@/living-office/agent-state-engine';
import type { SpacePlan, Workspace } from '@/living-office/elastic-space-engine';
import { moveTowards } from '@/living-office/movement-engine';
interface Batch { mesh: THREE.InstancedMesh; owners: string[] }
interface Position { x: number; z: number; y: number }
const STATE_COLORS = { offline: '#64748b', idle: '#94a3b8', working: '#22d3ee', researching: '#a78bfa', collaborating: '#34d399', waiting: '#fbbf24', error: '#fb7185' };
function box(width: number, height: number, depth: number, color: string) {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: .8 }));
}
function label(text: string, color = '#e2e8f0') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d')!; ctx.font = 'bold 44px monospace'; ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.fillText(text.slice(0, 30), 256, 56);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false })); sprite.scale.set(3.5, .66, 1);
  return sprite;
}
/** Instanced geometry: one batch per furniture part, rather than per workstation. */
export class OfficeScene3D {
  readonly group = new THREE.Group();
  readonly pickables: THREE.InstancedMesh[] = [];
  readonly bounds: { width: number; depth: number; elevation: number };
  private batches = new Map<string, Batch>();
  private labels = new Map<string, THREE.Sprite>();
  private floorIndex: number;
  private matrix = new THREE.Matrix4();
  private vector = new THREE.Vector3();
  private color = new THREE.Color();
  private sphere = new THREE.Sphere(new THREE.Vector3(), 2.5);
  private highlight = new THREE.Mesh(new THREE.TorusGeometry(1.4, .035, 8, 48), new THREE.MeshBasicMaterial({ color: '#f0f9ff' }));
  constructor(private plan: SpacePlan, private floorId: string, private agents: OfficeAgent[]) {
    const floor = plan.floors.find(f => f.id === floorId) ?? plan.floors[0];
    this.floorIndex = floor?.index ?? 0;
    this.bounds = { width: floor?.width ?? 12, depth: floor?.depth ?? 12, elevation: this.floorIndex * 6 };
    const { width, depth, elevation } = this.bounds;
    const slab = box(width, .25, depth, '#0f172a'); slab.position.set(width / 2, elevation - .16, depth / 2); this.group.add(slab);
    for (const pod of floor?.pods ?? []) {
      const carpet = box(pod.width, .035, pod.depth, pod.kind === 'project' ? '#0d302c' : '#172033');
      carpet.position.set(pod.x + pod.width / 2, elevation + .01, pod.z + pod.depth / 2); this.group.add(carpet);
      const strip = box(pod.width, .045, .045, pod.color); strip.position.set(pod.x + pod.width / 2, elevation + .05, pod.z + .2); this.group.add(strip);
      const title = label(pod.name, pod.color); title.position.set(pod.x + pod.width / 2, elevation + 1.5, pod.z + .4); this.group.add(title);
    }
    // Side rails establish physical architecture while leaving pods open to reflow.
    for (const x of [0, width]) { const rail = box(.08, .65, depth, '#164e63'); rail.position.set(x, elevation + .32, depth / 2); this.group.add(rail); }
    this.batch('desk', [2, .14, 1.2], '#334155');
    this.batch('accent', [2, .035, .05], '#ffffff');
    this.batch('legs', [.09, .85, .09], '#64748b', 4);
    this.batch('monitor', [.9, .55, .08], '#0f172a');
    this.batch('screen', [.76, .41, .015], '#ffffff', 1, true);
    this.batch('chair', [.58, .66, .58], '#1e293b');
    this.batch('head', [.42, .42, .42], '#ffffff');
    this.batch('body', [.5, .52, .32], '#ffffff');
    this.batch('eyes', [.075, .07, .02], '#020617', 2);
    this.batch('ownership', [2.65, .025, 2.4], '#1e293b');
    this.batch('researcher', [.35, 1.3, .85], '#7c3aed');
    this.batch('engineer', [.35, .4, .3], '#164e63');
    this.batch('coordinator', [1.3, .8, .07], '#ecfdf5');
    this.batch('reviewer', [.45, .025, .4], '#fbbf24');
    this.batch('support', [.18, .32, .18], '#38bdf8');
    for (const workspace of plan.workspaces) {
      if (workspace.floor !== floorId) continue;
      const name = label(workspace.name, workspace.color); this.labels.set(workspace.agentId, name); this.group.add(name);
    }
    this.highlight.rotation.x = Math.PI / 2; this.highlight.visible = false; this.group.add(this.highlight);
  }
  private batch(name: string, dimensions: [number, number, number], color: string, multiplier = 1, emissive = false) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: .75, ...(emissive ? { emissive: '#ffffff', emissiveIntensity: .3 } : {}) });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(...dimensions), material, Math.max(1, this.plan.workspaces.length * multiplier));
    mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
    const batch = { mesh, owners: [] as string[] }; this.batches.set(name, batch); this.group.add(mesh); this.pickables.push(mesh);
  }
  private add(name: string, owner: string, point: Position, offset: [number, number, number], color?: string) {
    const batch = this.batches.get(name)!; const index = batch.mesh.count++;
    this.matrix.makeTranslation(point.x + offset[0], point.y + offset[1], point.z + offset[2]);
    batch.mesh.setMatrixAt(index, this.matrix); batch.owners[index] = owner;
    if (color) batch.mesh.setColorAt(index, this.color.set(color));
  }
  setActivity(plan: SpacePlan, agents: OfficeAgent[]) { this.plan = plan; this.agents = agents; }
  ownerOf(object: THREE.Object3D, instance?: number) {
    if (instance === undefined) return;
    for (const batch of this.batches.values()) if (batch.mesh === object) return batch.owners[instance];
  }
  update(seconds: number, frustum: THREE.Frustum, positions: Map<string, Position>, filter: string, selected?: string) {
    for (const batch of this.batches.values()) { batch.mesh.count = 0; batch.owners = []; }
    this.highlight.visible = false;
    const byId = new Map(this.agents.map(a => [a.id, a]));
    for (const workspace of this.plan.workspaces) {
      const index = this.plan.floors.find(f => f.id === workspace.floor)!.index;
      const elevation = index * 6;
      const prior = positions.get(workspace.agentId) ?? { ...workspace.target, y: elevation };
      // Cross-floor transfer uses a new floor origin; horizontal geometry interpolates.
      const next = prior.y === elevation ? moveTowards({ x: prior.x, y: prior.z }, { x: workspace.target.x, y: workspace.target.z }, seconds, 10) : { x: workspace.target.x, y: workspace.target.z };
      const point = { x: next.x, z: next.y, y: elevation }; positions.set(workspace.agentId, point);
      const agent = byId.get(workspace.agentId)!;
      if (workspace.homeFloor === this.floorId && workspace.collaboration) this.add('ownership', workspace.agentId, { ...workspace.home, y: this.bounds.elevation }, [0, .03, 0]);
      const name = this.labels.get(workspace.agentId);
      this.sphere.center.set(point.x, point.y + 1, point.z);
      const visible = workspace.floor === this.floorId && frustum.intersectsSphere(this.sphere) && (filter === 'all' || agent.state === filter);
      if (name) { name.visible = visible; name.position.set(point.x, elevation + 2.55, point.z); }
      if (!visible) continue;
      this.drawWorkspace(workspace, agent, point);
      if (selected === workspace.agentId) { this.highlight.visible = true; this.highlight.position.set(point.x, elevation + .1, point.z); }
    }
    for (const batch of this.batches.values()) {
      batch.mesh.instanceMatrix.needsUpdate = true;
      if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
      batch.mesh.computeBoundingSphere();
    }
  }
  private drawWorkspace(workspace: Workspace, agent: OfficeAgent, point: Position) {
    const id = workspace.agentId;
    this.add('desk', id, point, [0, .96, 0]);
    this.add('accent', id, point, [0, 1.05, .61], workspace.color);
    for (const x of [-.9, .9]) for (const z of [-.48, .48]) this.add('legs', id, point, [x, .45, z]);
    this.add('monitor', id, point, [0, 1.37, -.32]);
    this.add('screen', id, point, [0, 1.37, -.267], isExecuting(agent.state) ? STATE_COLORS[agent.state] : '#0f172a');
    this.add('chair', id, point, [0, .36, .95]);
    if (workspace.role !== 'unassigned') {
      const offsets: Record<string, [number, number, number]> = { researcher: [-1.25, .65, 0], engineer: [.7, 1.23, -.2], coordinator: [0, 1.8, -1], reviewer: [.7, 1.05, 0], support: [.7, 1.2, 0] };
      this.add(workspace.role, id, point, offsets[workspace.role]);
    }
    if (workspace.occupied || workspace.waiting) {
      const z = workspace.waiting ? 1.8 : .8;
      this.add('head', id, point, [0, 1.68, z], workspace.color);
      this.add('body', id, point, [0, 1.2, z], workspace.color);
      for (const x of [-.11, .11]) this.add('eyes', id, point, [x, 1.7, z + .22]);
    }
  }
  dispose() {
    const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>();
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
      if (object instanceof THREE.InstancedMesh) object.dispose();
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material); const map = (material as THREE.MeshStandardMaterial).map; if (map) textures.add(map);
        }
      }
    });
    for (const geometry of geometries) geometry.dispose(); for (const texture of textures) texture.dispose(); for (const material of materials) material.dispose();
  }
}
