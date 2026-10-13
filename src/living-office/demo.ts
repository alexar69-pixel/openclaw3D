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
