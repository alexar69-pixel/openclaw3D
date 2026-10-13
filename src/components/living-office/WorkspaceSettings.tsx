'use client';
import { ROLES, profileFor, type SpaceConfig, type SpacePlan, type WorkspaceRole } from '@/living-office/elastic-space-engine';
import type { OfficeAgent } from '@/living-office/agent-state-engine';
export default function WorkspaceSettings({ agent, config, plan, onChange }: { agent?: OfficeAgent; config: SpaceConfig; plan: SpacePlan; onChange: (config: SpaceConfig) => void }) {
  const workspace = plan.workspaces.find(w => w.agentId === agent?.id);
  const profile = agent ? profileFor(agent, config) : undefined;
  const setProfile = (patch: Partial<NonNullable<typeof profile>>) => {
    if (agent && profile) onChange({ ...config, profiles: { ...config.profiles, [agent.sessionKey]: { ...profile, ...patch } } });
  };
  return <section className="p-3 border border-cyan-900 rounded-xl bg-slate-900 text-xs space-y-3" aria-label="Asignación del espacio personal">
    <h3 className="font-semibold text-cyan-300">Espacio personal</h3>
    {!agent ? <p className="text-slate-400">Selecciona un agente para asignar función, equipo y estilo.</p> : <>
      <p className="break-words">{workspace?.id ?? 'Asignación pendiente'}</p>
      <label className="block">Función <select className="bg-slate-800 p-1 rounded" value={profile?.role} onChange={e => setProfile({ role: e.target.value as WorkspaceRole })}>{ROLES.map(role => <option key={role}>{role}</option>)}</select></label>
      <label className="block">Equipo <input aria-label="Equipo asignado" className="bg-slate-800 p-1 rounded max-w-40" placeholder="Sin asignación" value={profile?.team ?? ''} onChange={e => setProfile({ team: e.target.value.trim() || undefined })} /></label>
      <label className="block">Color <input aria-label="Color del espacio" type="color" value={profile?.color ?? workspace?.color ?? '#22d3ee'} onChange={e => setProfile({ color: e.target.value })} /></label>
      <label className="block">Planta de origen <select className="bg-slate-800 p-1 max-w-full" value={profile?.homeFloor ?? ''} onChange={e => setProfile({ homeFloor: e.target.value || undefined })}><option value="">Asignación automática</option>{config.floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <p className="text-slate-400">Origen: {workspace?.homeFloor} · Actual: {workspace?.floor}{workspace?.collaboration && ' · proyecto temporal'}</p>
    </>}
    <label className="block">Umbral de expansión <input aria-label="Agentes por planta" type="number" min={5} max={100} value={config.agentsPerFloor} className="w-16 bg-slate-800 p-1" onChange={e => onChange({ ...config, agentsPerFloor: Math.min(100, Math.max(5, Number(e.target.value) || 24)) })} /></label>
    <button className="border border-cyan-800 rounded px-3 py-2" onClick={() => {
      const floors = [...config.floors];
      // Materialize automatic floors before adding a genuinely new storey.
      while (floors.length < plan.floors.length + 1) {
        let index = floors.length + 1; while (floors.some(f => f.id === `floor-${index}`)) index++;
        floors.push({ id: `floor-${index}`, name: `Planta ${index}` });
      }
      onChange({ ...config, floors });
    }} disabled={plan.floors.length >= 100}>Añadir planta</button>
    <button className="border border-cyan-800 rounded px-3 py-2 ml-2" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'living-office-spaces.json'; anchor.click(); URL.revokeObjectURL(url);
    }}>Exportar configuración</button>
    <p className="text-slate-500">Las asignaciones organizan el espacio; no crean evidencia de colaboración.</p>
  </section>;
}
