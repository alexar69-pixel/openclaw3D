import { describe, it, expect } from 'vitest';
import { ElasticSpaceEngine, validateSpaceConfig, profileFor } from '@/living-office/elastic-space-engine';
import { demoScenario } from '@/living-office/demo';
import { collaborationGroups } from '@/living-office/collaboration-engine';
import defaultConfig from '@/living-office/space-config.json';
import { demoSpaceConfig } from '@/living-office/demo-space-config';
describe('Elastic spatial ownership', () => {
  it('expands from one to five floors for 100 agents and keeps ownership under inventory reorder', () => {
    const engine = new ElasticSpaceEngine(), config = validateSpaceConfig({ ...defaultConfig, agentsPerFloor: 20 });
    const agents = demoScenario(100, 'solo');
    const plan = engine.plan(agents, [], config);
    expect(plan.floors).toHaveLength(5); expect(plan.workspaces).toHaveLength(100);
    expect(new Set(plan.workspaces.map(w => w.id)).size).toBe(100);
    expect(new Set(plan.workspaces.map(w => `${w.floor}:${w.target.x}:${w.target.z}`)).size).toBe(100);
    const reordered = engine.plan([...agents].reverse(), [], config);
    for (const workspace of plan.workspaces) expect(reordered.workspaces.find(w => w.id === workspace.id)?.homeFloor).toBe(workspace.homeFloor);
  });
  it('moves owned furniture into project pods and returns it after collaboration ends', () => {
    const engine = new ElasticSpaceEngine(), config = demoSpaceConfig();
    const solo = demoScenario(20, 'solo'), team = demoScenario(20, 'team');
    const homes = engine.plan(solo, [], config);
    const grouped = engine.plan(team, collaborationGroups(team), config);
    expect(grouped.floors[0].pods.some(p => p.kind === 'project')).toBe(true);
    for (const w of grouped.workspaces.filter(w => w.collaboration)) {
      const home = homes.workspaces.find(h => h.id === w.id)!;
      expect(w.home).toEqual(home.home); expect(w.homeFloor).toBe(home.homeFloor); expect(w.target).not.toEqual(w.home);
    }
    const completed = demoScenario(20, 'completed');
    const released = engine.plan(completed, collaborationGroups(completed), config);
    expect(released.floors.every(f => f.pods.every(p => p.kind !== 'project'))).toBe(true);
    for (const w of released.workspaces.slice(0, 6)) { expect(w.target).toEqual(w.home); expect(w.occupied).toBe(false); }
  });
  it('keeps cross-floor teams together without duplicating their desks', () => {
    const engine = new ElasticSpaceEngine(), config = { ...demoSpaceConfig(), agentsPerFloor: 5 };
    const agents = demoScenario(20, 'team');
    const plan = engine.plan(agents, collaborationGroups(agents), config);
    const project = plan.workspaces.filter(w => w.collaboration);
    expect(project).toHaveLength(6); expect(new Set(project.map(w => w.floor)).size).toBe(1);
    expect(project.some(w => w.homeFloor !== w.floor)).toBe(true);
    expect(plan.workspaces).toHaveLength(20);
  });
  it('uses only declared roles/teams and lets a new floor receive a personal space', () => {
    const engine = new ElasticSpaceEngine(), config = validateSpaceConfig({ ...defaultConfig,
      floors: [...defaultConfig.floors, { id: 'research', name: 'Research' }],
      profiles: { 'demo:0': { role: 'researcher', team: 'science', color: '#a78bfa', homeFloor: 'research' } },
      teams: { science: { name: 'Science', color: '#a78bfa' } },
    });
    const agents = demoScenario(5, 'solo'); const plan = engine.plan(agents, [], config);
    expect(plan.workspaces[0]).toMatchObject({ role: 'researcher', team: 'science', homeFloor: 'research', color: '#a78bfa' });
    expect(profileFor(agents[1], config)).toEqual({ role: 'unassigned' });
    expect(plan.floors[1].pods[0].name).toBe('Science');
  });
  it('restores leases across reload and refuses hostile floor indices', () => {
    const engine = new ElasticSpaceEngine(), config = validateSpaceConfig(defaultConfig), agents = demoScenario(100, 'solo');
    const plan = engine.plan(agents, [], config); const restored = new ElasticSpaceEngine(); restored.restore(engine.snapshot());
    expect(restored.plan([...agents].reverse(), [], config).workspaces.map(w => w.homeFloor)).toEqual(plan.workspaces.map(w => w.homeFloor));
    const fresh = new ElasticSpaceEngine(); fresh.restore([['demo:0', { floor: 999999, order: -1 }]]);
    expect(fresh.plan(agents.slice(0, 1), [], config).floors).toHaveLength(1);
  });
  it('rejects invalid layouts, duplicate floors and malformed customizations', () => {
    expect(() => validateSpaceConfig({ ...defaultConfig, agentsPerFloor: NaN })).toThrow();
    expect(() => validateSpaceConfig({ ...defaultConfig, floors: [...defaultConfig.floors, ...defaultConfig.floors] })).toThrow();
    expect(() => validateSpaceConfig({ ...defaultConfig, profiles: { a: { role: 'unknown' } } })).toThrow();
    expect(() => validateSpaceConfig({ ...defaultConfig, teams: { a: { name: 'A', color: 'javascript:alert(1)' } } })).toThrow();
  });
});
