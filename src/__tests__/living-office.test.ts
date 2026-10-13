import { describe, it, expect } from 'vitest';
import { applyEvent, createAgent, type OfficeEvent } from '@/living-office/agent-state-engine';
import { collaborationGroups } from '@/living-office/collaboration-engine';
import { officeLayout, validateLayout } from '@/living-office/office-layout-engine';
import { moveTowards, inViewport } from '@/living-office/movement-engine';
import { normalizeLiveEvent } from '@/living-office/gateway-adapter';
import { GatewayConnection, type SessionLiveState } from '@/lib/gateway-connection';
import { demoAgents } from '@/living-office/demo';
import layout from '@/living-office/layout.json';
const event = (type: OfficeEvent['type'], at: number, runId = 'run'): OfficeEvent => ({ id: `${type}:${at}`, sessionKey: 'a', type, at, runId });
describe('Living Office state contracts', () => {
  it('ends runs, rejects stale and duplicate frames, and recovers after errors', () => {
    let a = applyEvent(createAgent('a'), event('researching', 1));
    a = applyEvent(a, event('end', 2)); expect(a.state).toBe('idle');
    expect(applyEvent(a, event('working', 3))).toBe(a);
    a = applyEvent(a, event('start', 4, 'next')); expect(a.state).toBe('working');
    expect(applyEvent(a, event('end', 5, 'run'))).toBe(a);
    expect(applyEvent(a, event('error', 2, 'next'))).toBe(a);
    a = applyEvent(a, event('error', 6, 'next')); expect(a.state).toBe('error');
    a = applyEvent(a, event('start', 7, 'third')); expect(a.state).toBe('working');
    expect(applyEvent(a, event('error', 8, 'next'))).toBe(a);
  });
  it('bounds history and does not use session age', () => {
    let a = createAgent('a'); expect(a.state).toBe('idle');
    for (let i = 1; i <= 120; i++) a = applyEvent(a, event('working', i));
    expect(a.events).toHaveLength(80); expect(a.state).toBe('working');
  });
  it('requires explicit delegation and dissolves completed groups', () => {
    let parent = applyEvent(createAgent('a'), event('start', 1));
    const child = { ...createAgent('child'), state: 'working' as const };
    expect(collaborationGroups([parent, child])).toEqual([]);
    parent = applyEvent(parent, { ...event('delegation', 2), parentSessionKey: 'a', childSessionKey: 'child' });
    expect(collaborationGroups([parent, child])[0].members).toEqual(['a', 'child']);
    parent = applyEvent(parent, event('end', 3)); expect(collaborationGroups([parent, child])).toEqual([]);
  });
  it('lays out 100 agents without overlaps, leaves idle desks empty and reports overflow', () => {
    const agents = demoAgents(100), validated = validateLayout(layout);
    const scene = officeLayout(validated, agents, collaborationGroups(agents));
    expect(Object.keys(scene.positions)).toHaveLength(100);
    expect(new Set(Object.values(scene.positions).map(p => `${p.x}:${p.y}`)).size).toBe(100);
    for (const a of agents.filter(a => a.state === 'idle' || a.state === 'error')) expect(scene.positions[a.id].desk).toBe(false);
    expect(officeLayout({ ...validated, rooms: validated.rooms.map(r => ({ ...r, capacity: 1 })) }, agents, []).overflow.length).toBeGreaterThan(0);
    expect(() => validateLayout({ ...layout, rooms: [{ ...layout.rooms[0], capacity: NaN }] })).toThrow();
  });
  it('moves without overshoot and culls off-screen agents', () => {
    expect(moveTowards({ x: 0, y: 0 }, { x: 10, y: 0 }, 1)).toEqual({ x: 10, y: 0 });
    expect(moveTowards({ x: 0, y: 0 }, { x: 100, y: 0 }, .1).x).toBe(18);
    expect(inViewport({ x: 999, y: 0 }, 100, 100, 1, { x: 0, y: 0 })).toBe(false);
  });
  it('uses latest event instead of stale chat errors and never exports arbitrary payload', () => {
    const live: SessionLiveState = { sessionKey: 'a', agent: null, chatStatus: 'error', agentStatus: 'lifecycle', agentEventData: { phase: 'start', token: 'secret' }, lastChatEventAt: 1, lastAgentEventAt: 2, lastRunId: 'next' };
    expect(normalizeLiveEvent(live)?.type).toBe('start');
    expect(JSON.stringify(normalizeLiveEvent(live))).not.toContain('secret');
    expect(normalizeLiveEvent({ ...live, agentStatus: 'tool', agentEventData: { name: 'web_search', phase: 'end' } })?.type).toBe('working');
    expect(normalizeLiveEvent({ ...live, lastChatEventAt: 3, chatStatus: 'final' })?.type).toBe('end');
  });
  it('blocks all mutating RPCs before making any connection', async () => {
    const monitor = new GatewayConnection(true);
    await expect(monitor.request('chat.send')).rejects.toThrow('Read-only monitor');
    await expect(monitor.request('sessions.reset')).rejects.toThrow('Read-only monitor');
    monitor.destroy();
  });
});
