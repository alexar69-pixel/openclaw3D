'use client';
import { useEffect, useRef, useState } from 'react';
import { ElasticSpaceEngine, type SpaceConfig, type SpacePlan } from '@/living-office/elastic-space-engine';
import type { OfficeAgent } from '@/living-office/agent-state-engine';
import type { CollaborationGroup } from '@/living-office/collaboration-engine';
export function useElasticOffice(agents: OfficeAgent[], groups: CollaborationGroup[], config: SpaceConfig, demo: boolean) {
  const engines = useRef(new Map<boolean, ElasticSpaceEngine>());
  const [plan, setPlan] = useState<SpacePlan>(() => new ElasticSpaceEngine().plan([], [], config));
  useEffect(() => {
    let engine = engines.current.get(demo);
    const storageKey = `living-office:spaces:v1:${demo ? 'demo' : 'live'}`;
    if (!engine) {
      engine = new ElasticSpaceEngine();
      try { const saved = localStorage.getItem(storageKey); if (saved) engine.restore(JSON.parse(saved)); } catch { /* Storage is optional. */ }
      engines.current.set(demo, engine);
    }
    const next = engine.plan(agents, groups, config); setPlan(next);
    try { localStorage.setItem(storageKey, JSON.stringify(engine.snapshot())); } catch { /* Preserve functionality without browser storage. */ }
  }, [agents, groups, config, demo]);
  return plan;
}
