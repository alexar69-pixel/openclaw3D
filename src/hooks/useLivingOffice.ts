'use client';
import { useEffect, useState } from 'react';
import { applyEvent, type OfficeAgent, type OfficeEvent } from '@/living-office/agent-state-engine';
export function useLivingOffice(demo: boolean) {
  const [agents, setAgents] = useState<OfficeAgent[]>([]);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('Conectando al Gateway…');
  useEffect(() => {
    if (demo) return;
    let active = true, inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (inFlight) return; inFlight = true;
      try {
        const response = await fetch('/api/living-office', { signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!active) return;
        setConnected(Boolean(data.connected));
        setMessage(data.error ?? (data.truncated ? 'Inventario limitado a 100 sesiones' : 'Solo lectura · actividad observada desde la conexión'));
        if (response.ok) setAgents(previous => (data.agents as OfficeAgent[]).map(a => {
          const existing = previous.find(p => p.id === a.id);
          return existing && existing.lastAt > a.lastAt ? { ...existing, name: a.name, model: a.model } : a;
        }));
      } catch { if (active) { setConnected(false); setMessage('Gateway no disponible'); } }
      finally { inFlight = false; }
    };
    const queued = new Map<string, OfficeEvent[]>(); let activityFrame = 0;
    const source = new EventSource('/api/living-office/events');
    source.addEventListener('activity', (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as OfficeEvent;
        if (!queued.has(event.sessionKey) && queued.size >= 100) return;
        queued.set(event.sessionKey, [...(queued.get(event.sessionKey) ?? []), event].slice(-80));
        if (!activityFrame) activityFrame = requestAnimationFrame(() => {
          activityFrame = 0; if (!active) return;
          const batch = new Map(queued); queued.clear();
          setAgents(previous => previous.map(a => (batch.get(a.sessionKey) ?? []).reduce(applyEvent, a)));
        });
      } catch { /* Malformed frames are ignored; the snapshot reconciles inventory. */ }
    });
    source.addEventListener('connection', (e: MessageEvent) => {
      try { setConnected(Boolean(JSON.parse(e.data).connected)); } catch { /* invalid frame */ }
    });
    source.onerror = () => { if (active) setConnected(false); };
    void refresh(); const timer = setInterval(() => void refresh(), 10000);
    return () => { active = false; controller.abort(); source.close(); clearInterval(timer); if (activityFrame) cancelAnimationFrame(activityFrame); queued.clear(); };
  }, [demo]);
  return { agents, connected, message };
}
