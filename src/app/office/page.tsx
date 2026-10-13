'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLivingOffice } from '@/hooks/useLivingOffice';
import { STATES } from '@/living-office/agent-state-engine';
import { collaborationGroups } from '@/living-office/collaboration-engine';
import { officeLayout, validateLayout } from '@/living-office/office-layout-engine';
import defaultLayout from '@/living-office/layout.json';
import { demoScenario, type DemoScenario } from '@/living-office/demo';
import { demoSpaceConfig } from '@/living-office/demo-space-config';
import { validateSpaceConfig } from '@/living-office/elastic-space-engine';
import defaultSpaceConfig from '@/living-office/space-config.json';
import { useElasticOffice } from '@/hooks/useElasticOffice';
import OfficeRenderer3D from '@/components/living-office/OfficeRenderer3D';
import WorkspaceSettings from '@/components/living-office/WorkspaceSettings';
import OfficeRenderer from '@/components/living-office/OfficeRenderer';
import AgentInspector from '@/components/living-office/AgentInspector';
export default function OfficePage() {
  const [demo, setDemo] = useState(false), [count, setCount] = useState(20);
  const [layout, setLayout] = useState(() => validateLayout(defaultLayout));
  const [floor, setFloor] = useState(defaultLayout.floors[0].id), [filter, setFilter] = useState('all');
  const [zoom, setZoom] = useState(.7), [selected, setSelected] = useState<string>(), [layoutError, setLayoutError] = useState('');
  const [view, setView] = useState<'3d' | '2d'>('3d'), [scenario, setScenario] = useState<DemoScenario>('mixed');
  const [liveSpaceConfig, setLiveSpaceConfig] = useState(() => validateSpaceConfig(defaultSpaceConfig));
  const [demoConfig, setDemoConfig] = useState(demoSpaceConfig);
  const [spaceFloor, setSpaceFloor] = useState('floor-1');
  const spaceConfig = demo ? demoConfig : liveSpaceConfig;
  const setSpaceConfig = demo ? setDemoConfig : setLiveSpaceConfig;
  useEffect(() => {
    try { const saved = localStorage.getItem('living-office:config:v1'); if (saved) setLiveSpaceConfig(validateSpaceConfig(JSON.parse(saved))); const demoSaved = localStorage.getItem('living-office:config:v1:demo'); if (demoSaved) setDemoConfig(validateSpaceConfig(JSON.parse(demoSaved))); } catch { /* Invalid browser configuration leaves safe defaults. */ }
  }, []);
  const updateSpaceConfig = (next: typeof spaceConfig) => { setSpaceConfig(next); try { localStorage.setItem(demo ? 'living-office:config:v1:demo' : 'living-office:config:v1', JSON.stringify(next)); } catch { /* Export remains available. */ } };
  const live = useLivingOffice(demo);
  const baseAgents = useMemo(() => demo ? demoScenario(count, scenario) : live.agents.map(a => live.connected ? a : { ...a, state: 'offline' as const }), [demo, count, scenario, live.agents, live.connected]);
  const groups = useMemo(() => collaborationGroups(baseAgents), [baseAgents]);
  const agents = useMemo(() => baseAgents.map(a => groups.some(g => g.members.includes(a.id)) && a.state !== 'waiting' ? { ...a, state: 'collaborating' as const } : a), [baseAgents, groups]);
  const scene = useMemo(() => officeLayout(layout, agents, groups), [layout, agents, groups]);
  const spacePlan = useElasticOffice(agents, groups, spaceConfig, demo);
  const activeSpaceFloor = spacePlan.floors.some(f => f.id === spaceFloor) ? spaceFloor : spacePlan.floors[0]?.id ?? 'floor-1';
  const shownAgents = agents.filter(a => (filter === 'all' || a.state === filter) && (view === '3d' ? spacePlan.workspaces.find(w => w.agentId === a.id)?.floor === activeSpaceFloor : scene.rooms.find(r => r.id === scene.positions[a.id]?.room)?.floor === floor));
  return <main className="min-h-screen lg:h-screen bg-slate-950 text-slate-200 flex flex-col p-4 gap-4 font-mono">
    <header className="flex flex-wrap justify-between gap-3 items-center">
      <div><h1 className="text-xl text-cyan-300 font-bold">OPENCLAW <span className="text-white">LIVING OFFICE</span></h1><p className="text-xs text-slate-400 mt-1">{demo ? 'DEMO · datos simulados · Gateway desconectado del visor' : live.message}</p></div>
      <nav className="flex gap-4 text-xs"><Link href="/">Dashboard</Link><Link href="/office/legacy">Oficina original</Link></nav>
    </header>
    <section className="flex flex-wrap gap-4 items-center text-xs bg-slate-900 p-3 rounded-xl border border-cyan-950" aria-label="Controles de oficina">
      <label><input type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)} /> Modo DEMO</label>
      {demo && <label>Agentes simulados <input aria-label="Cantidad de agentes demo" type="number" min={5} max={100} value={count} onChange={e => setCount(Number(e.target.value) || 5)} className="w-16 bg-slate-800 rounded p-1" /></label>}
      <label>Vista <select aria-label="Vista de oficina" className="bg-slate-800 p-1" value={view} onChange={e => setView(e.target.value as '3d' | '2d')}><option value="3d">3D elástica</option><option value="2d">2D cenital</option></select></label>
      {demo && <label>Escenario DEMO <select className="bg-slate-800 p-1" value={scenario} onChange={e => setScenario(e.target.value as DemoScenario)}><option value="mixed">Actividad mixta</option><option value="solo">Trabajo individual</option><option value="team">Crear proyecto</option><option value="completed">Finalizar proyecto</option></select></label>}
      {view === '3d' ? <label>Planta <select className="bg-slate-800 p-1" value={activeSpaceFloor} onChange={e => setSpaceFloor(e.target.value)}>{spacePlan.floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label> : <label>Planta <select className="bg-slate-800 p-1" value={floor} onChange={e => setFloor(e.target.value)}>{layout.floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
      <label>Estado <select className="bg-slate-800 p-1" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos</option>{STATES.map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="flex items-center gap-2">Zoom <input aria-label="Zoom" type="range" min={.15} max={2} step={.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} />{Math.round(zoom * 100)}%</label>
      <label className="cursor-pointer text-cyan-300">Cargar plano JSON<input aria-label="Cargar plano JSON" type="file" accept="application/json,.json" className="block max-w-48" onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return;
        try { if (file.size > 100000) throw new Error('Plano demasiado grande'); const input = JSON.parse(await file.text()); if (view === '3d') { const next = validateSpaceConfig(input); updateSpaceConfig(next); setSpaceFloor(next.floors[0].id); } else { const next = validateLayout(input); setLayout(next); setFloor(next.floors[0].id); } setLayoutError(''); }
        catch (error) { setLayoutError(error instanceof Error ? error.message : 'Plano inválido'); }
      }} /></label>
      <span>{agents.length} sesiones · {groups.length} grupos confirmados{view === '3d' && ` · ${spacePlan.floors.length} plantas · ${spacePlan.workspaces.length} puestos personales`}</span>
    </section>
    {(layoutError || (view === '2d' && scene.overflow.length > 0)) && <p role="alert" className="text-amber-300 text-sm">{layoutError || `${scene.overflow.length} agentes sin capacidad en el plano`}</p>}
    {!demo && !live.connected && <p role="status" className="text-amber-200 text-xs">Sin conexión verificada. No se muestran tareas simuladas. Offline describe la conexión del monitor.</p>}
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4">
      <div className="flex flex-1 min-w-0 flex-col gap-3">
        {view === '3d' ? <OfficeRenderer3D plan={spacePlan} agents={agents} floor={activeSpaceFloor} filter={filter} zoom={zoom} selected={selected} onSelect={setSelected} onFallback={() => setView('2d')} /> : <OfficeRenderer agents={agents} groups={groups} layout={layout} floor={floor} filter={filter} zoom={zoom} selected={selected} onSelect={setSelected} />}
        <div className="flex flex-wrap gap-2 max-h-32 overflow-auto" aria-label="Seleccionar agente">{shownAgents.map(a => <button key={a.id} aria-pressed={selected === a.id} className="text-xs border border-cyan-900 rounded px-3 py-2 hover:bg-cyan-950" onClick={() => setSelected(a.id)}>{a.name} · {groups.some(g => g.members.includes(a.id)) && a.state !== 'waiting' ? 'collaborating' : a.state}</button>)}</div>
        {!agents.length && <p className="text-slate-400 text-sm">No hay sesiones observadas. Activa DEMO para explorar la oficina.</p>}
      </div>
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-3 overflow-auto">
        {view === '3d' && <WorkspaceSettings agent={agents.find(a => a.id === selected)} config={spaceConfig} plan={spacePlan} onChange={updateSpaceConfig} />}
        <AgentInspector agent={agents.find(a => a.id === selected)} groups={groups} />
      </div>
    </div>
    <footer className="text-[11px] text-slate-500">3D: arrastra para orbitar, botón derecho para desplazar · Puestos personales vacíos en reposo · Sin replay del Gateway: el historial empieza al conectar · Colaboración exige delegación explícita</footer>
  </main>;
}
