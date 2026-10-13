import type { SpaceConfig, WorkspaceRole } from './elastic-space-engine';
/** Explicit demo assignments, never applied to real Gateway inventory. */
export function demoSpaceConfig(): SpaceConfig {
  const roles: WorkspaceRole[] = ['engineer', 'researcher', 'coordinator', 'reviewer', 'support'];
  return { version: 1, agentsPerFloor: 24, floors: [{ id: 'floor-1', name: 'DEMO · Operations 01' }],
    teams: { platform: { name: 'DEMO · Platform', color: '#22d3ee' }, knowledge: { name: 'DEMO · Knowledge', color: '#a78bfa' }, delivery: { name: 'DEMO · Delivery', color: '#34d399' } },
    profiles: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`demo:${i}`, { role: roles[i % roles.length], team: ['platform', 'knowledge', 'delivery'][Math.floor(i / 8) % 3] }])),
  };
}
