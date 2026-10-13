import { isExecuting, type OfficeAgent } from './agent-state-engine';
import type { CollaborationGroup } from './collaboration-engine';
export type WorkspaceRole = 'engineer' | 'researcher' | 'coordinator' | 'reviewer' | 'support' | 'unassigned';
export interface SpaceProfile { role: WorkspaceRole; team?: string; color?: string; homeFloor?: string }
export interface SpaceConfig {
  version: 1; agentsPerFloor: number; floors: { id: string; name: string }[];
  profiles: Record<string, SpaceProfile>; teams: Record<string, { name: string; color: string }>;
}
export interface SpacePoint { x: number; z: number }
export interface Pod { id: string; name: string; kind: 'department' | 'project'; color: string; x: number; z: number; width: number; depth: number }
export interface SpaceFloor { id: string; name: string; index: number; width: number; depth: number; pods: Pod[] }
export interface Workspace {
  id: string; agentId: string; name: string; role: WorkspaceRole; team: string; color: string;
  homeFloor: string; floor: string; home: SpacePoint; target: SpacePoint;
  occupied: boolean; waiting: boolean; collaboration?: string;
}
export interface SpacePlan { floors: SpaceFloor[]; workspaces: Workspace[] }
interface Lease { floor: number; order: number }
export const ROLES: WorkspaceRole[] = ['engineer', 'researcher', 'coordinator', 'reviewer', 'support', 'unassigned'];
const colorPattern = /^#[0-9a-fA-F]{6}$/;
export function validateSpaceConfig(input: unknown): SpaceConfig {
  if (!input || typeof input !== 'object') throw new Error('Configuración espacial inválida');
  const config = input as SpaceConfig;
  if (config.version !== 1 || !Number.isInteger(config.agentsPerFloor) || config.agentsPerFloor < 5 || config.agentsPerFloor > 100 || !Array.isArray(config.floors) || !config.floors.length || config.floors.length > 100 || !config.profiles || Array.isArray(config.profiles) || typeof config.profiles !== 'object' || !config.teams || Array.isArray(config.teams) || typeof config.teams !== 'object') throw new Error('Plano elástico v1 inválido');
  const ids = new Set<string>();
  for (const floor of config.floors) {
    if (!floor || typeof floor.id !== 'string' || !floor.id || typeof floor.name !== 'string' || !floor.name || ids.has(floor.id) || /^auto-/.test(floor.id)) throw new Error('Plantas inválidas (auto- reservado)');
    ids.add(floor.id);
  }
  for (const profile of Object.values(config.profiles)) {
    if (!profile || !ROLES.includes(profile.role) || (profile.color !== undefined && !colorPattern.test(profile.color)) || (profile.team !== undefined && typeof profile.team !== 'string') || (profile.homeFloor !== undefined && !ids.has(profile.homeFloor))) throw new Error('Perfil inválido');
  }
  for (const team of Object.values(config.teams)) if (!team || typeof team.name !== 'string' || !colorPattern.test(team.color)) throw new Error('Equipo inválido');
  return config;
}
/** Explicit profiles only: shared prefixes or simultaneous runs never imply a team. */
export function profileFor(agent: OfficeAgent, config: SpaceConfig): SpaceProfile {
  // Exact session overrides an explicitly configured agent identity.
  const identity = agent.sessionKey.startsWith('agent:') ? agent.sessionKey.split(':')[1] : undefined;
  const exact = Object.hasOwn(config.profiles, agent.sessionKey) ? config.profiles[agent.sessionKey] : undefined;
  const configured = identity && Object.hasOwn(config.profiles, `agent:${identity}`) ? config.profiles[`agent:${identity}`] : undefined;
  return exact ?? configured ?? { role: 'unassigned' };
}
/** Stable ownership and home-floor leases; geometry changes with actual occupancy. */
export class ElasticSpaceEngine {
  private leases = new Map<string, Lease>();
  private sequence = 0;
  reset() { this.leases.clear(); this.sequence = 0; }
  snapshot(): [string, Lease][] { return [...this.leases]; }
  restore(input: unknown) {
    if (!Array.isArray(input) || input.length > 1000) return;
    for (const entry of input) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !entry[1]) continue;
      const { floor, order } = entry[1];
      if (!Number.isInteger(floor) || floor < 0 || floor >= 100 || !Number.isInteger(order) || order < 0) continue;
      this.leases.set(entry[0], { floor, order }); this.sequence = Math.max(this.sequence, order + 1);
    }
  }
  plan(agents: OfficeAgent[], groups: CollaborationGroup[], config: SpaceConfig): SpacePlan {
    const unique = [...new Map(agents.map(a => [a.id, a])).values()].slice(0, 100);
    const counts = new Map<number, number>();
    for (const agent of unique) {
      const lease = this.leases.get(agent.id); if (lease) counts.set(lease.floor, (counts.get(lease.floor) ?? 0) + 1);
    }
    for (const agent of unique) {
      const requested = profileFor(agent, config).homeFloor;
      let lease = this.leases.get(agent.id);
      const requestedIndex = requested ? config.floors.findIndex(f => f.id === requested) : -1;
      if (lease && requestedIndex >= 0 && lease.floor !== requestedIndex) { counts.set(lease.floor, (counts.get(lease.floor) ?? 1) - 1); lease = undefined; }
      if (!lease) {
        let floor = requestedIndex >= 0 ? requestedIndex : 0;
        // Capacity is a growth threshold; an explicit home floor can grow elastically.
        if (requestedIndex < 0) while ((counts.get(floor) ?? 0) >= config.agentsPerFloor) floor++;
        lease = { floor, order: this.sequence++ }; this.leases.set(agent.id, lease);
        counts.set(floor, (counts.get(floor) ?? 0) + 1);
      }
    }
    if (this.leases.size > 1000) for (const id of this.leases.keys()) { if (!unique.some(a => a.id === id)) this.leases.delete(id); if (this.leases.size <= 1000) break; }
    const floorCount = Math.max(config.floors.length, ...unique.map(a => this.leases.get(a.id)!.floor + 1));
    const floors: SpaceFloor[] = Array.from({ length: floorCount }, (_, i) => ({
      id: config.floors[i]?.id ?? `auto-${i + 1}`, name: config.floors[i]?.name ?? `Expansion ${String(i + 1).padStart(2, '0')}`,
      index: i, width: 12, depth: 12, pods: [],
    }));
    const homes = new Map<string, SpacePoint>();
    const targets = new Map<string, { point: SpacePoint; floor: string; collaboration?: string }>();
    const ordered = unique.sort((a, b) => this.leases.get(a.id)!.order - this.leases.get(b.id)!.order);
    const byId = new Map(ordered.map(a => [a.id, a]));
    const seen = new Set<string>();
    const validGroups = groups.filter(g => byId.has(g.coordinator) && g.members.length > 1 && g.members.every(id => byId.has(id) && !seen.has(id)) && g.members.every(id => isExecuting(byId.get(id)!.state) || byId.get(id)!.state === 'waiting'))
      .filter(g => { if (g.members.some(id => seen.has(id))) return false; g.members.forEach(id => seen.add(id)); return true; });
    // Department pods describe configured organizational assignment, not collaboration.
    for (const floor of floors) {
      const departments = new Map<string, OfficeAgent[]>();
      for (const a of ordered.filter(a => this.leases.get(a.id)!.floor === floor.index)) {
        const team = profileFor(a, config).team ?? 'unassigned';
        departments.set(team, [...(departments.get(team) ?? []), a]);
      }
      let cursorX = 0, cursorZ = 0, rowDepth = 0, column = 0;
      for (const [team, members] of departments) {
        const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(members.length))));
        const width = columns * 3.5 + 2, depth = Math.ceil(members.length / columns) * 3.5 + 3;
        const color = config.teams[team]?.color ?? '#22d3ee';
        const pod: Pod = { id: `department:${floor.id}:${team}`, name: config.teams[team]?.name ?? (team === 'unassigned' ? 'Sin equipo asignado' : team), kind: 'department', color, x: cursorX, z: cursorZ, width, depth };
        floor.pods.push(pod);
        members.forEach((a, i) => {
          const point = { x: cursorX + 2.7 + (i % columns) * 3.5, z: cursorZ + 3 + Math.floor(i / columns) * 3.5 };
          homes.set(a.id, point); targets.set(a.id, { point, floor: floor.id });
        });
        rowDepth = Math.max(rowDepth, depth);
        floor.width = Math.max(floor.width, cursorX + width + 1); floor.depth = Math.max(floor.depth, cursorZ + depth + 1);
        cursorX += width + 1; column++;
        if (column % 2 === 0) { cursorZ += rowDepth + 1; cursorX = 0; rowDepth = 0; }
      }
    }
    // Confirmed groups get temporary configurable-sized project pods. Ownership stays.
    for (const group of validGroups) {
      const floor = floors[this.leases.get(group.coordinator)!.floor];
      const columns = Math.min(5, Math.ceil(Math.sqrt(group.members.length)));
      const width = columns * 3.5 + 2, depth = Math.ceil(group.members.length / columns) * 3.5 + 3;
      const x = floor.width + 1, z = 0;
      const pod: Pod = { id: group.id, name: `Proyecto · ${byId.get(group.coordinator)!.name}`, kind: 'project', color: '#34d399', x, z, width, depth };
      floor.pods.push(pod); floor.width = x + width + 1; floor.depth = Math.max(floor.depth, depth + 2);
      group.members.forEach((id, i) => targets.set(id, { floor: floor.id, collaboration: group.id, point: { x: x + 2.7 + i % columns * 3.5, z: z + 3 + Math.floor(i / columns) * 3.5 } }));
    }
    return { floors, workspaces: ordered.map(a => {
      const profile = profileFor(a, config), homeFloor = floors[this.leases.get(a.id)!.floor].id, target = targets.get(a.id)!;
      return { id: `workspace:${a.id}`, agentId: a.id, name: a.name, role: profile.role,
        team: profile.team ?? 'unassigned', color: profile.color ?? config.teams[profile.team ?? '']?.color ?? '#22d3ee',
        homeFloor, home: homes.get(a.id)!, floor: target.floor, target: target.point,
        collaboration: target.collaboration, occupied: isExecuting(a.state), waiting: a.state === 'waiting' };
    }) };
  }
}
