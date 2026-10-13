import * as THREE from 'three';
import type { SpaceFloor } from '@/living-office/elastic-space-engine';
/** Procedural surfaces, shared across all workstations; no external asset downloads. */
export function surfaceTexture(kind: 'wood' | 'floor' | 'display' | 'shadow') {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const offset = (y * size + x) * 4;
    let r = 0, g = 0, b = 0, a = 255;
    if (kind === 'wood') {
      const grain = Math.sin(y * .38 + Math.sin(x * .035) * 3) * 8 + Math.sin(y * 1.7) * 2;
      r = 125 + grain; g = 83 + grain * .65; b = 54 + grain * .4;
    } else if (kind === 'floor') {
      const seam = x < 2 || y < 2, grain = (x * 7 + y * 13) % 5;
      r = seam ? 15 : 31 + grain; g = seam ? 23 : 43 + grain; b = seam ? 34 : 58 + grain;
    } else if (kind === 'display') {
      // Abstract UI motifs, deliberately not fabricated task text or metrics.
      r = 7; g = 18; b = 29;
      if (x > 8 && x < 119 && y > 9 && y < 19) { r = 46; g = 185; b = 210; }
      if (y > 30 && y < 107 && y % 12 < 3 && x > 12 + (Math.floor(y / 12) % 3) * 6 && x < 45 + (Math.floor(y / 12) % 4) * 17) { r = 136; g = 214; b = 210; }
      if (x > 100 && x < 117 && y > 30 && y < 100) { r = 40; g = 68; b = 107; }
    } else {
      const distance = Math.hypot((x - 64) / 64, (y - 64) / 64); a = Math.round(Math.max(0, 1 - distance) ** 1.8 * 125);
    }
    pixels.set([r, g, b, a], offset);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4; texture.generateMipmaps = true; texture.needsUpdate = true;
  if (kind === 'wood' || kind === 'floor') texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
interface DecorInstance { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: string; rx?: number; ry?: number; rz?: number }
function instances(group: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, items: DecorInstance[]) {
  if (!items.length) { geometry.dispose(); material.dispose(); return; }
  const mesh = new THREE.InstancedMesh(geometry, material, items.length); mesh.name = name;
  const transform = new THREE.Object3D(), color = new THREE.Color();
  items.forEach((item, index) => {
    transform.position.set(item.x, item.y, item.z); transform.scale.set(item.sx, item.sy, item.sz); transform.rotation.set(item.rx ?? 0, item.ry ?? 0, item.rz ?? 0); transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix); mesh.setColorAt(index, color.set(item.color));
  });
  mesh.computeBoundingSphere(); group.add(mesh);
}
/** Architectural framing and greenery are also batched by part, not by room. */
export function addArchitecture(group: THREE.Group, floor: SpaceFloor, elevation: number) {
  const pots: DecorInstance[] = [], foliage: DecorInstance[] = [], trunks: DecorInstance[] = [], glass: DecorInstance[] = [], frames: DecorInstance[] = [];
  for (const pod of floor.pods) {
    for (const x of [pod.x + .6, pod.x + pod.width - .6]) {
      const z = pod.z + pod.depth - .7;
      pots.push({ x, y: elevation + .25, z, sx: .48, sy: .5, sz: .48, color: '#566579' });
      trunks.push({ x, y: elevation + .85, z, sx: .08, sy: 1.2, sz: .08, color: '#7b5e40' });
      for (let leaf = 0; leaf < 28; leaf++) { const angle = leaf * 2.39996;
        foliage.push({ x: x + Math.cos(angle) * .23, y: elevation + .85 + leaf / 28 * .65, z: z + Math.sin(angle) * .23, sx: .11, sy: .25, sz: .022, ry: angle, rz: .65, color: ['#205741', '#367855', '#498b65'][leaf % 3] });
      }
    }
    const x = pod.x + pod.width / 2, z = pod.z + .08;
    glass.push({ x, y: elevation + .85, z, sx: pod.width - .7, sy: 1.55, sz: .025, color: pod.kind === 'project' ? '#7cd5be' : '#8aafcb' });
    frames.push({ x, y: elevation + 1.65, z, sx: pod.width - .6, sy: .055, sz: .06, color: '#65788e' });
    for (const side of [-1, 1]) frames.push({ x: x + side * (pod.width - .7) / 2, y: elevation + .85, z, sx: .055, sy: 1.65, sz: .06, color: '#65788e' });
  }
  instances(group, 'planters', new THREE.CylinderGeometry(.5, .4, 1, 32), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .7 }), pots);
  instances(group, 'foliage', new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85 }), foliage);
  instances(group, 'plant-stems', new THREE.CylinderGeometry(1, 1, 1, 16), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9 }), trunks);
  instances(group, 'glass-partitions', new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: .2, roughness: .1, metalness: .05, depthWrite: false }), glass);
  instances(group, 'partition-frames', new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: .6, roughness: .3 }), frames);
}
