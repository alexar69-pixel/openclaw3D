import { applyEvent, createAgent, type OfficeAgent } from './agent-state-engine';
/** Deterministic fixtures, exclusively selected by the explicit DEMO control. */
export function demoAgents(count: number): OfficeAgent[] {
  return Array.from({ length: Math.min(100, Math.max(5, count)) }, (_, i) => {
    let agent = createAgent(`demo:${i}`, `Agent ${String(i + 1).padStart(2, '0')}`, 'DEMO / simulated');
    const type = (['start', 'researching', 'waiting', 'end', 'error'] as const)[i % 5];
    agent = applyEvent(agent, { id: `demo-event:${i}`, sessionKey: agent.sessionKey, runId: `demo-run:${i}`, at: 1, type, ...(type === 'researching' ? { tool: 'web_search' } : {}) });
    if (i === 0) agent = applyEvent(agent, { id: 'demo-delegation', sessionKey: agent.sessionKey, runId: 'demo-run:0', at: 2, type: 'delegation', parentSessionKey: 'demo:0', childSessionKey: 'demo:1' });
    return agent;
  });
}

export type DemoScenario = 'mixed' | 'solo' | 'team' | 'completed';
export function demoScenario(count: number, scenario: DemoScenario): OfficeAgent[] {
  const agents = demoAgents(count);
  if (scenario === 'mixed') return agents;
  const participants = Math.min(6, agents.length);
  for (let i = 0; i < participants; i++) {
    agents[i] = { ...agents[i], events: agents[i].events.filter(e => e.type !== 'delegation') };
    if (scenario === 'completed') {
      agents[i] = applyEvent(agents[i], { id: `demo-end:${i}`, sessionKey: agents[i].sessionKey, runId: agents[i].runId, at: 200, type: 'end' });
    } else if (agents[i].state !== 'working' && agents[i].state !== 'researching' && agents[i].state !== 'waiting') {
      agents[i] = applyEvent(agents[i], { id: `demo-start:${i}`, sessionKey: agents[i].sessionKey, runId: `demo-project:${i}`, at: 10, type: 'start' });
    }
  }
  if (scenario === 'team') for (let i = 1; i < participants; i++) agents[0] = applyEvent(agents[0], {
    id: `demo-project-delegation:${i}`, sessionKey: agents[0].sessionKey, runId: agents[0].runId,
    at: 20 + i, type: 'delegation', parentSessionKey: agents[0].sessionKey, childSessionKey: agents[i].sessionKey,
  });
  return agents;
}
