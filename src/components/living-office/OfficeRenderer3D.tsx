'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OfficeScene3D } from './scene-3d';
import type { SpacePlan } from '@/living-office/elastic-space-engine';
import type { OfficeAgent } from '@/living-office/agent-state-engine';
interface Props { quality?: 'auto' | 'high' | 'light'; plan: SpacePlan; agents: OfficeAgent[]; floor: string; filter: string; selected?: string; zoom: number; onSelect: (id: string) => void; onFallback: () => void }
export default function OfficeRenderer3D(props: Props) {
  const host = useRef<HTMLDivElement>(null), latest = useRef(props), reset = useRef(() => {}), focus = useRef(() => {});
  const [error, setError] = useState(false), [moving, setMoving] = useState(false);
  const quality = props.quality ?? 'auto';
  useEffect(() => { latest.current = props; });
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor('#070c18'); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    const software = Boolean(debug && /swiftshader|llvmpipe|software/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))));
    const detailed = quality === 'high' || (quality === 'auto' && !software);
    renderer.domElement.dataset.graphicsBackend = detailed ? 'detailed' : 'light';
    renderer.shadowMap.enabled = detailed; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label', 'Oficina 3D dinámica. Selecciona puestos con el plano o la lista accesible.');
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.environmentIntensity = .25;
    let environmentMap: THREE.WebGLRenderTarget | undefined;
    if (detailed) {
      const environment = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
      environmentMap = pmrem.fromScene(environment, .04); scene.environment = environmentMap.texture;
      environment.dispose(); pmrem.dispose();
    }
    scene.add(new THREE.HemisphereLight('#dbeafe', '#182138', 1.0));
    const sun = new THREE.DirectionalLight('#e5edf8', 1.8); sun.position.set(10, 25, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = .04; scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#78c5f5', .55); fill.position.set(-15, 12, -10); scene.add(fill);
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 2000);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.1; controls.minDistance = 4; controls.maxDistance = 400;
    const positions = new Map<string, { x: number; z: number; y: number }>();
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
    let model: OfficeScene3D | undefined, previousProps: Props | undefined, frame = 0, previousTime = 0, disposed = false, needsFrame = true, geometryKey = '', activityKey = '', wasMoving = false, renderedFrames = 0;
    const invalidate = () => { needsFrame = true; }; controls.addEventListener('change', invalidate);
    const fit = () => {
      if (!model) return;
      const { width, depth, elevation } = model.bounds;
      const radius = Math.hypot(width, depth) / 2 + 2;
      const extent = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect) * 1.1;
      controls.target.set(width / 2, elevation, depth / 2);
      sun.position.set(width / 2 + radius * .5, elevation + radius * 1.5, depth / 2 + radius * .8); sun.target.position.copy(controls.target);
      Object.assign(sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: .1, far: radius * 5 }); sun.shadow.camera.updateProjectionMatrix();
      camera.position.copy(new THREE.Vector3(.7, .9, .85).normalize().multiplyScalar(extent).add(controls.target));
      camera.near = .1; camera.far = Math.max(1000, extent * 8); camera.updateProjectionMatrix(); controls.update();
    }; reset.current = fit;
    focus.current = () => {
      const p = latest.current, workspace = p.plan.workspaces.find(w => w.agentId === p.selected);
      if (!workspace || workspace.floor !== p.floor) return;
      const point = positions.get(workspace.agentId) ?? { ...workspace.target, y: model?.bounds.elevation ?? 0 };
      controls.target.set(point.x, point.y + .9, point.z);
      camera.position.set(point.x + 5.2, point.y + 4.1, point.z + 6.4); camera.zoom = 1;
      camera.updateProjectionMatrix(); controls.update(); needsFrame = true;
    };
    const resize = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width <= 0 || height <= 0) return;
      needsFrame = true; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
      if (model) fit();
    }); resize.observe(container);
    let down: { x: number; y: number } | undefined;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(down.x - e.clientX, down.y - e.clientY) > 5 || !model) { down = undefined; return; }
      down = undefined;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const match = raycaster.intersectObjects(model.pickables, false)[0];
      if (match) { const id = model.ownerOf(match.object, match.instanceId); if (id) latest.current.onSelect(id); }
    };
    const contextLost = (e: Event) => { e.preventDefault(); disposed = true; cancelAnimationFrame(frame); setError(true); };
    renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    const animate = (time: number) => {
      if (disposed) return;
      const p = latest.current;
      const changed = !previousProps || previousProps.plan !== p.plan || previousProps.agents !== p.agents || previousProps.floor !== p.floor;
      const nextGeometry = changed ? JSON.stringify([p.floor, p.plan.floors, p.plan.workspaces.map(w => [w.id, w.name, w.role, w.color, w.floor, w.homeFloor, w.home, w.target, w.collaboration])]) : geometryKey;
      const nextActivity = changed ? p.agents.map(a => `${a.id}:${a.state}`).join('|') : activityKey;
      if (!model || nextGeometry !== geometryKey) {
        needsFrame = true;
        const floorChanged = !model || previousProps?.floor !== p.floor;
        const oldBounds = model?.bounds;
        if (model) { scene.remove(model.group); model.dispose(); }
        model = new OfficeScene3D(p.plan, p.floor, p.agents); scene.add(model.group);
        if (floorChanged || (oldBounds && Math.max(model.bounds.width / oldBounds.width, model.bounds.depth / oldBounds.depth) > 1.05)) fit();
      }
      if (changed) model.setActivity(p.plan, p.agents);
      if (nextActivity !== activityKey) needsFrame = true;
      geometryKey = nextGeometry; activityKey = nextActivity;
      if (previousProps?.filter !== p.filter || previousProps?.selected !== p.selected) needsFrame = true;
      if (previousProps?.zoom !== p.zoom) { needsFrame = true; camera.zoom = Math.max(.3, p.zoom / .7); camera.updateProjectionMatrix(); }
      previousProps = p; controls.update(); camera.updateMatrixWorld();
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projection);
      const moving = p.plan.workspaces.some(w => { const current = positions.get(w.agentId); return !current || Math.hypot(current.x - w.target.x, current.z - w.target.z) > .001; });
      if (moving !== wasMoving) { wasMoving = moving; setMoving(moving); }
      if (needsFrame || moving) {
        model.update(previousTime ? Math.min(.25, (time - previousTime) / 1000) : 0, frustum, positions, p.filter, p.selected);
        renderer.render(scene, camera); renderer.domElement.dataset.renderedFrames = String(++renderedFrames); needsFrame = false;
      }
      previousTime = time;
      const ids = new Set(p.plan.workspaces.map(w => w.agentId)); for (const id of positions.keys()) if (!ids.has(id)) positions.delete(id);
      frame = requestAnimationFrame(animate);
    }; frame = requestAnimationFrame(animate);
    return () => {
      disposed = true; cancelAnimationFrame(frame); resize.disconnect(); controls.removeEventListener('change', invalidate); controls.dispose(); model?.dispose(); environmentMap?.dispose(); sun.shadow.dispose(); renderer.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.domElement.remove(); reset.current = () => {}; focus.current = () => {};
    };
  }, [quality]);
  return <div data-space-motion={moving ? 'moving' : 'settled'} className="relative flex-1 min-h-[380px] rounded-xl border border-cyan-900 overflow-hidden">
    <div ref={host} className="absolute inset-0" />
    {moving && <span className="absolute top-3 left-3 rounded bg-slate-900/90 px-3 py-2 text-xs text-cyan-300">Reorganizando puestos…</span>}
    {!error && props.selected && <button className="absolute bottom-3 left-3 bg-slate-800 text-cyan-200 rounded px-3 py-2 text-xs" onClick={() => focus.current()}>Ver puesto</button>}
    {error ? <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-slate-950 text-sm"><p>WebGL no está disponible. Puedes usar la oficina 2D.</p><button onClick={props.onFallback} className="px-4 py-2 border border-cyan-700 rounded">Usar vista 2D</button></div> : <button className="absolute bottom-3 right-3 bg-slate-800 text-cyan-200 rounded px-3 py-2 text-xs" onClick={() => reset.current()}>Encuadrar planta</button>}
  </div>;
}
