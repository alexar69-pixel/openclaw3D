import { GatewayConnection, type SessionsListResult } from '@/lib/gateway-connection';
import { applyEvent, createAgent, type OfficeAgent } from './agent-state-engine';
import { normalizeLiveEvent } from './gateway-adapter';
class GatewayMonitor {
  readonly connection = new GatewayConnection(true);
  private states = new Map<string, OfficeAgent>();
  private readonly maxSessions = 1000;
  constructor() {
    this.connection.subscribeConnection(ready => {
      if (!ready) for (const [key, state] of this.states) this.states.set(key, { ...state, state: 'idle', activityKnown: false, runId: undefined });
    });
    this.connection.subscribe((key, live) => {
      const event = normalizeLiveEvent(live);
      if (event) {
        if (!this.states.has(key) && this.states.size >= this.maxSessions) this.states.delete(this.states.keys().next().value!);
        this.states.set(key, applyEvent(this.states.get(key) ?? createAgent(key), event));
      }
    });
  }
  async snapshot() {
    this.connection.ensureStarted();
    const result = await this.connection.request<SessionsListResult>('sessions.list');
    const inventory = this.connection.getAgents();
    // Keep separate sessions: choosing the one with most tokens hides concurrent runs.
    const agents = result.sessions.slice(0, 100).map(session => {
      const identity = inventory.get(session.key.split(':')[1]);
      const agent = this.states.get(session.key) ?? createAgent(session.key);
      return { ...agent, name: identity?.identity?.name ?? identity?.name ?? session.displayName ?? session.key,
        model: session.model ?? result.defaults?.model ?? 'No disponible', state: this.connection.isReady ? agent.state : 'offline' as const };
    });
    // Known agents without a session remain visible with no fabricated activity.
    for (const identity of inventory.values()) {
      if (agents.length >= 100) break;
      if (!result.sessions.some(s => s.key.split(':')[1] === identity.id)) {
        agents.push({ ...createAgent(`agent:${identity.id}`, identity.identity?.name ?? identity.name ?? identity.id), state: this.connection.isReady ? 'idle' : 'offline' });
      }
    }
    return { connected: this.connection.isReady, agents, truncated: result.sessions.length > 100, observedAt: Date.now() };
  }
}
const key = Symbol.for('living-office-monitor');
export function getMonitor(): GatewayMonitor {
  const globals = globalThis as Record<symbol, unknown>;
  if (!globals[key]) globals[key] = new GatewayMonitor();
  return globals[key] as GatewayMonitor;
}
