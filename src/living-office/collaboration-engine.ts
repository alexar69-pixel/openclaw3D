import { isExecuting, type OfficeAgent } from './agent-state-engine';
export interface CollaborationGroup { id: string; coordinator: string; members: string[]; roles: Record<string, 'coordinator' | 'executor' | 'waiting'> }
/** Only explicit, current-run delegation evidence creates relationships. */
export function collaborationGroups(agents: OfficeAgent[]): CollaborationGroup[] {
  const byKey = new Map(agents.map(a => [a.sessionKey, a]));
  const groups = new Map<string, CollaborationGroup>();
  for (const agent of agents) for (const event of agent.events) {
    if (event.type !== 'delegation' || !event.runId || event.runId !== agent.runId || !event.parentSessionKey || !event.childSessionKey) continue;
    const parent = byKey.get(event.parentSessionKey), child = byKey.get(event.childSessionKey);
    if (!parent || !child || parent === child || !isExecuting(parent.state) || !(isExecuting(child.state) || child.state === 'waiting')) continue;
    const id = `${parent.id}:${event.runId}`;
    const group = groups.get(id) ?? { id, coordinator: parent.id, members: [parent.id], roles: { [parent.id]: 'coordinator' as const } };
    if (!group.members.includes(child.id)) group.members.push(child.id);
    group.roles[child.id] = child.state === 'waiting' ? 'waiting' : 'executor';
    groups.set(id, group);
  }
  return [...groups.values()];
}
