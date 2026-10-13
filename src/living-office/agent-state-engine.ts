export const STATES = ['offline', 'idle', 'working', 'researching', 'collaborating', 'waiting', 'error'] as const;
export type AgentState = typeof STATES[number];
export interface OfficeEvent {
  id: string; sessionKey: string; runId?: string; at: number;
  type: 'start' | 'end' | 'working' | 'researching' | 'waiting' | 'error' | 'delegation';
  tool?: string; parentSessionKey?: string; childSessionKey?: string;
}
export interface OfficeAgent {
  id: string; name: string; model: string; sessionKey: string;
  state: AgentState; activityKnown: boolean; runId?: string; task?: string;
  tools: string[]; events: OfficeEvent[]; lastAt: number; completedRuns: string[];
}
export function createAgent(sessionKey: string, name = sessionKey, model = 'No disponible'): OfficeAgent {
  return { id: sessionKey, sessionKey, name, model, state: 'idle', activityKnown: false, tools: [], events: [], lastAt: 0, completedRuns: [] };
}
export function applyEvent(agent: OfficeAgent, event: OfficeEvent): OfficeAgent {
  if (event.sessionKey !== agent.sessionKey || event.at < agent.lastAt || agent.events.some(e => e.id === event.id)) return agent;
  if (event.runId && agent.completedRuns.includes(event.runId)) return agent;
  if (event.type === 'end' && event.runId && agent.runId && event.runId !== agent.runId) return agent;
  const newRun = event.runId && event.runId !== agent.runId;
  const retired = newRun && agent.runId ? [...agent.completedRuns, agent.runId].slice(-80) : agent.completedRuns;
  const state: AgentState = event.type === 'end' ? 'idle' : event.type === 'start' || event.type === 'delegation' ? 'working' : event.type;
  return { ...agent, state, activityKnown: true, runId: event.type === 'end' ? undefined : event.runId ?? agent.runId,
    tools: event.tool ? [...new Set([...(newRun ? [] : agent.tools), event.tool])].slice(-30) : newRun ? [] : agent.tools,
    events: [...agent.events, event].slice(-80), lastAt: event.at,
    completedRuns: event.type === 'end' && event.runId ? [...retired, event.runId].slice(-80) : retired };
}
export const isExecuting = (state: AgentState) => ['working', 'researching', 'collaborating'].includes(state);
