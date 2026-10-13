import type { OfficeAgent } from '@/living-office/agent-state-engine';
import type { CollaborationGroup } from '@/living-office/collaboration-engine';
export default function AgentInspector({ agent, groups }: { agent?: OfficeAgent; groups: CollaborationGroup[] }) {
  return <aside className="w-full lg:w-80 shrink-0 border border-cyan-900 rounded-xl p-4 bg-slate-950 overflow-auto" aria-label="Inspector de agentes">
    <h2 className="text-cyan-300 font-semibold mb-4">Agent Inspector</h2>
    {!agent ? <p className="text-slate-400 text-sm">Selecciona un agente en el plano o en la lista.</p> : <>
      <h3 className="text-lg text-white break-words">{agent.name}</h3>
      <dl className="text-sm space-y-3 mt-4 break-words">
        <div><dt className="text-slate-400">Modelo</dt><dd>{agent.model}</dd></div>
        <div><dt className="text-slate-400">Estado</dt><dd>{agent.state}{!agent.activityKnown && ' · sin evidencia de actividad'}</dd></div>
        <div><dt className="text-slate-400">Sesión observada</dt><dd>{agent.sessionKey}</dd></div>
        <div><dt className="text-slate-400">Run activo</dt><dd>{agent.runId ?? 'No observado'}</dd></div>
        <div><dt className="text-slate-400">Tarea actual</dt><dd>{agent.task ?? 'No disponible en los eventos recibidos'}</dd></div>
        <div><dt className="text-slate-400">Herramientas observadas</dt><dd>{agent.tools.join(', ') || 'Ninguna observada'}</dd></div>
        <div><dt className="text-slate-400">Relaciones confirmadas</dt><dd>{groups.filter(g => g.members.includes(agent.id)).map(g => <p key={g.id}>{g.roles[agent.id]} · {g.members.join(', ')}</p>)}{!groups.some(g => g.members.includes(agent.id)) && 'Sin evidencia suficiente'}</dd></div>
      </dl>
      <h3 className="mt-5 text-cyan-300">Historial observado ({agent.events.length}/80)</h3>
      <ol className="text-xs space-y-2 mt-2">{[...agent.events].reverse().map(e => <li key={e.id} className={e.type === 'error' ? 'text-red-300' : 'text-slate-300'}>{new Date(e.at).toLocaleTimeString()} · {e.type}{e.tool && ` · ${e.tool}`}</li>)}</ol>
      <p className="text-xs text-slate-400 mt-4">Errores: {agent.events.filter(e => e.type === 'error').length} observados. Detalles sensibles omitidos.</p>
    </>}
  </aside>;
}
