import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addArchitecture, surfaceTexture } from './visual-assets';
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
  const ctx = canvas.getContext('2d')!; ctx.font = '500 40px Arial, sans-serif'; ctx.fillStyle = color;
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
    const slab = box(width, .35, depth, '#ffffff');
    const floorSurface = surfaceTexture('floor'); floorSurface.repeat.set(width / 2, depth / 2);
    (slab.material as THREE.MeshStandardMaterial).map = floorSurface; slab.receiveShadow = true; (slab.material as THREE.MeshStandardMaterial).roughness = .45; (slab.material as THREE.MeshStandardMaterial).metalness = .2; slab.position.set(width / 2, elevation - .16, depth / 2); this.group.add(slab);
    for (const pod of floor?.pods ?? []) {
      const carpet = box(pod.width, .035, pod.depth, pod.kind === 'project' ? '#172b2d' : '#202b39');
      carpet.position.set(pod.x + pod.width / 2, elevation + .01, pod.z + pod.depth / 2); this.group.add(carpet);
      const strip = box(pod.width, .045, .045, pod.color); strip.position.set(pod.x + pod.width / 2, elevation + .05, pod.z + .2); this.group.add(strip);
      const title = label(pod.name, pod.color); title.position.set(pod.x + pod.width / 2, elevation + 1.5, pod.z + .4); this.group.add(title);
    }
    if (floor) addArchitecture(this.group, floor, elevation);
    // Side rails establish physical architecture while leaving pods open to reflow.
    for (const x of [0, width]) { const rail = box(.08, .65, depth, '#164e63'); rail.position.set(x, elevation + .32, depth / 2); this.group.add(rail); }
    this.batch('contact-shadow', [3, .001, 3], '#ffffff');
    this.batch('desk', [2.25, .14, 1.35], '#ffffff');
    this.batch('accent', [2, .035, .05], '#ffffff');
    this.batch('legs', [.09, .85, .09], '#64748b', 4);
    this.batch('monitor', [.9, .55, .08], '#0f172a');
    this.batch('screen', [.76, .41, .015], '#ffffff', 1, true);
    this.batch('chair', [.62, .12, .66], '#24344c');
    this.batch('chair-back', [.62, .63, .12], '#2e4059');
    this.batch('chair-base', [.16, .06, .16], '#546578');
    this.batch('chair-spokes', [.4, .03, .04], '#64748b', 5);
    this.batch('chair-wheels', [.095, .095, .08], '#141d2a', 5);
    this.batch('armrests', [.065, .055, .5], '#34435b', 2);
    this.batch('chair-stem', [.08, .45, .08], '#8495a9');
    this.batch('keyboard', [.65, .035, .24], '#121c2b');
    this.batch('key-lines', [.57, .009, .025], '#7a93ad', 3);
    this.batch('mouse', [.1, .045, .15], '#bbcbdc');
    this.batch('monitor-neck', [.06, .2, .06], '#5a6c83');
    this.batch('monitor-foot', [.37, .025, .18], '#5a6c83');
    this.batch('desk-pad', [.85, .01, .4], '#25364a');
    this.batch('cup', [.12, .18, .12], '#dbe8f6');
    this.batch('status-light', [.07, .03, .07], '#ffffff', 1, true);
    this.batch('head', [.27, .34, .27], '#ffffff');
    this.batch('hair', [.28, .13, .275], '#343039');
    this.batch('neck', [.1, .14, .1], '#d3a082');
    this.batch('hands', [.075, .095, .065], '#d3a082', 2);
    this.batch('shoes', [.16, .08, .27], '#1b2530', 2);
    this.batch('arms', [.12, .38, .14], '#ffffff', 2);
    this.batch('human-legs', [.15, .48, .19], '#344255', 2);
    this.batch('thighs', [.17, .4, .22], '#344255', 2);
    this.batch('pelvis', [.38, .18, .26], '#344255');
    this.batch('chest-panel', [.26, .17, .02], '#ffffff', 1, true);
    this.batch('body', [.44, .56, .28], '#ffffff');
    this.batch('eyes', [.025, .02, .015], '#222a36', 2);
    this.batch('ownership', [2.65, .025, 2.4], '#1e293b');
    this.batch('researcher', [.06, 1.3, .9], '#45586b');
    this.batch('shelf-panels', [.4, .05, .9], '#657489', 3);
    this.batch('books', [.25, .29, .08], '#ffffff', 5);
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
    const material = new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .12, ...(emissive ? { emissive: '#ffffff', emissiveIntensity: .3 } : {}) });
    if (name === 'desk') { material.map = surfaceTexture('wood'); material.roughness = .38; material.metalness = .04; }
    if (name === 'contact-shadow') { material.map = surfaceTexture('shadow'); material.transparent = true; material.depthWrite = false; material.roughness = 1; }
    if (name === 'screen') { material.map = surfaceTexture('display'); material.emissiveIntensity = 0; }
    let geometry: THREE.BufferGeometry;
    if (name === 'contact-shadow') geometry = new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2);
    else if (['head', 'hair', 'mouse', 'hands', 'chair-wheels'].includes(name)) geometry = new THREE.SphereGeometry(.5, 24, 16).scale(...dimensions);
    else if (['arms', 'human-legs', 'neck', 'chair-stem', 'chair-base', 'thighs', 'cup'].includes(name)) geometry = new THREE.CylinderGeometry(dimensions[0] / 2, dimensions[0] / 2, dimensions[1], 24);
    else if (['desk', 'monitor', 'chair', 'chair-back', 'body', 'shoes', 'engineer', 'support'].includes(name)) geometry = new RoundedBoxGeometry(...dimensions, 2, Math.min(...dimensions) * .28);
    else geometry = new THREE.BoxGeometry(...dimensions);
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, this.plan.workspaces.length * multiplier));
    mesh.name = name; mesh.castShadow = ['desk', 'monitor', 'head', 'body'].includes(name); mesh.receiveShadow = name === 'desk';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
    const batch = { mesh, owners: [] as string[] }; this.batches.set(name, batch); this.group.add(mesh); this.pickables.push(mesh);
  }
  private add(name: string, owner: string, point: Position, offset: [number, number, number], color?: string, rotationY = 0) {
    const batch = this.batches.get(name)!; const index = batch.mesh.count++;
    this.matrix.makeRotationY(rotationY).setPosition(point.x + offset[0], point.y + offset[1], point.z + offset[2]);
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
      const agent = byId.get(workspace.agentId);
      if (!agent) { const staleLabel = this.labels.get(workspace.agentId); if (staleLabel) staleLabel.visible = false; continue; }
      if (workspace.homeFloor === this.floorId && workspace.collaboration) this.add('ownership', workspace.agentId, { ...workspace.home, y: this.bounds.elevation }, [0, .03, 0]);
      const name = this.labels.get(workspace.agentId);
      this.sphere.center.set(point.x, point.y + 1, point.z);
      const visible = workspace.floor === this.floorId && frustum.intersectsSphere(this.sphere) && (filter === 'all' || agent.state === filter);
      if (name) { name.visible = visible && selected === workspace.agentId; name.position.set(point.x, elevation + 2.55, point.z); }
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
    this.add('contact-shadow', id, point, [0, .052, .15]);
    const clothing = `#${new THREE.Color(workspace.color).lerp(new THREE.Color('#34435a'), .75).getHexString()}`;
    this.add('desk', id, point, [0, .96, 0]);
    this.add('desk-pad', id, point, [.04, 1.039, .21]);
    this.add('keyboard', id, point, [0, 1.065, .22]);
    for (const z of [.145, .22, .29]) this.add('key-lines', id, point, [0, 1.087, z]);
    this.add('mouse', id, point, [.55, 1.069, .22]);
    this.add('cup', id, point, [-.85, 1.12, .3]);
    this.add('status-light', id, point, [.96, 1.06, .49], STATE_COLORS[agent.state]);
    this.add('accent', id, point, [0, 1.05, .61], workspace.color);
    for (const x of [-.9, .9]) for (const z of [-.48, .48]) this.add('legs', id, point, [x, .45, z]);
    this.add('monitor', id, point, [0, 1.47, -.32]);
    this.add('monitor-neck', id, point, [0, 1.17, -.34]);
    this.add('monitor-foot', id, point, [0, 1.043, -.34]);
    this.add('screen', id, point, [0, 1.47, -.267], isExecuting(agent.state) ? STATE_COLORS[agent.state] : '#0f172a');
    this.add('chair', id, point, [0, .58, .95]);
    this.add('chair-back', id, point, [0, .97, 1.22]);
    this.add('chair-stem', id, point, [0, .3, .95]);
    this.add('chair-base', id, point, [0, .08, .95]);
    for (const side of [-1, 1]) this.add('armrests', id, point, [side * .35, .84, .93]);
    for (let leg = 0; leg < 5; leg++) { const angle = leg * Math.PI * 2 / 5;
      this.add('chair-spokes', id, point, [Math.cos(angle) * .18, .09, .95 + Math.sin(angle) * .18], undefined, -angle);
      this.add('chair-wheels', id, point, [Math.cos(angle) * .38, .05, .95 + Math.sin(angle) * .38]);
    }
    if (workspace.role !== 'unassigned') {
      const offsets: Record<string, [number, number, number]> = { researcher: [-1.25, .65, 0], engineer: [.7, 1.23, -.2], coordinator: [0, 1.8, -1], reviewer: [.7, 1.05, 0], support: [.7, 1.2, 0] };
      this.add(workspace.role, id, point, offsets[workspace.role]);
      if (workspace.role === 'researcher') {
        for (const y of [.1, .64, 1.26]) this.add('shelf-panels', id, point, [-1.08, y, 0]);
        for (let book = 0; book < 5; book++) this.add('books', id, point, [-1.08, .81, -.28 + book * .13], ['#7893a9', '#b9a283', '#70a6a4', '#8a83a3', '#c4ccd6'][book]);
      }
    }
    if (workspace.occupied || workspace.waiting) {
      const z = workspace.waiting ? 1.8 : .8;
      const skin = ['#d7aa89', '#b98464', '#edc7a7', '#8d6048'][this.plan.workspaces.indexOf(workspace) % 4];
      this.add('head', id, point, [0, 1.66, z], skin);
      this.add('hair', id, point, [0, 1.80, z + .015]);
      this.add('neck', id, point, [0, 1.42, z]);
      this.add('chest-panel', id, point, [.1, 1.25, z - .17], STATE_COLORS[agent.state]);
      this.add('body', id, point, [0, 1.14, z], clothing);
      this.add('pelvis', id, point, [0, .81, z]);
      for (const side of [-1, 1]) {
        this.add('arms', id, point, [side * .29, 1.1, z - .08], clothing);
        this.add('hands', id, point, [side * .28, .89, z - .1]);
        this.add('thighs', id, point, [side * .13, .72, z - (workspace.waiting ? 0 : .15)]);
        this.add('human-legs', id, point, [side * .13, .39, z - (workspace.waiting ? 0 : .18)]);
        this.add('shoes', id, point, [side * .13, .09, z - (workspace.waiting ? .05 : .23)]);
      }
      for (const x of [-.075, .075]) this.add('eyes', id, point, [x, 1.7, z - .136]);
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
