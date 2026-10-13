import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { OfficeScene3D } from '@/components/living-office/scene-3d';
import { ElasticSpaceEngine } from '@/living-office/elastic-space-engine';
import { demoSpaceConfig } from '@/living-office/demo-space-config';
import { demoAgents } from '@/living-office/demo';
afterEach(() => vi.restoreAllMocks());
describe('Actual Three.js scene contracts', () => {
  it('batches personal desks, preserves empty idle workstations and stands waiting avatars beside desks', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillText: vi.fn() } as unknown as CanvasRenderingContext2D);
    const agents = demoAgents(5), plan = new ElasticSpaceEngine().plan(agents, [], demoSpaceConfig());
    const scene = new OfficeScene3D(plan, 'floor-1', agents);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().makeScale(.001, .001, .001));
    scene.update(0, frustum, new Map(), 'all');
    expect((scene.group.getObjectByName('desk') as THREE.InstancedMesh).count).toBe(5);
    expect((scene.group.getObjectByName('head') as THREE.InstancedMesh).count).toBe(3);
    expect((scene.group.getObjectByName('researcher') as THREE.InstancedMesh).count).toBe(1);
    expect(scene.pickables.every(mesh => mesh instanceof THREE.InstancedMesh)).toBe(true);
    expect((scene.group.getObjectByName('head') as THREE.InstancedMesh).geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect((scene.group.getObjectByName('chair-spokes') as THREE.InstancedMesh).count).toBe(25);
    expect((scene.group.getObjectByName('foliage') as THREE.InstancedMesh).count).toBeGreaterThan(0);
    const deskMaterial = (scene.group.getObjectByName('desk') as THREE.InstancedMesh).material as THREE.MeshStandardMaterial;
    expect(deskMaterial.map).toBeInstanceOf(THREE.DataTexture);
    const releaseWood = vi.spyOn(deskMaterial.map!, 'dispose');
    const originalDesk = scene.group.getObjectByName('desk');
    const idle = agents.map(a => ({ ...a, state: 'idle' as const }));
    scene.setActivity(new ElasticSpaceEngine().plan(idle, [], demoSpaceConfig()), idle);
    scene.update(0, frustum, new Map(), 'all');
    expect(scene.group.getObjectByName('desk')).toBe(originalDesk);
    expect((scene.group.getObjectByName('head') as THREE.InstancedMesh).count).toBe(0);
    scene.dispose();
    expect(releaseWood).toHaveBeenCalledOnce();
  });
  it('removes off-camera instances from batches and keeps raycast ownership after filtering', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillText: vi.fn() } as unknown as CanvasRenderingContext2D);
    const agents = demoAgents(5), plan = new ElasticSpaceEngine().plan(agents, [], demoSpaceConfig());
    const scene = new OfficeScene3D(plan, 'floor-1', agents), positions = new Map();
    const offscreen = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().makeTranslation(1000, 1000, 1000));
    scene.update(0, offscreen, positions, 'all');
    const desks = scene.group.getObjectByName('desk') as THREE.InstancedMesh;
    expect(desks.count).toBe(0);
    const visible = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().makeScale(.001, .001, .001));
    scene.update(0, visible, positions, 'idle');
    expect(desks.count).toBe(1); expect(scene.ownerOf(desks, 0)).toBe('demo:3');
    expect((scene.group.getObjectByName('head') as THREE.InstancedMesh).count).toBe(0);
    scene.dispose();
  });
  it('handles inventory removal before the spatial snapshot catches up', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillText: vi.fn() } as unknown as CanvasRenderingContext2D);
    const agents = demoAgents(5), plan = new ElasticSpaceEngine().plan(agents, [], demoSpaceConfig());
    const scene = new OfficeScene3D(plan, 'floor-1', agents);
    scene.setActivity(plan, agents.slice(0, 2));
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().makeScale(.001, .001, .001));
    expect(() => scene.update(0, frustum, new Map(), 'all')).not.toThrow();
    expect((scene.group.getObjectByName('desk') as THREE.InstancedMesh).count).toBe(2);
    scene.dispose();
  });

});
