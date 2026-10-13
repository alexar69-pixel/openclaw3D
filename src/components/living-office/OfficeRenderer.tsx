'use client';
import { useEffect, useRef } from 'react';
import { type OfficeAgent } from '@/living-office/agent-state-engine';
import { officeLayout, type Layout, type Point } from '@/living-office/office-layout-engine';
import { type CollaborationGroup } from '@/living-office/collaboration-engine';
import { inViewport, moveTowards } from '@/living-office/movement-engine';
const COLORS: Record<OfficeAgent['state'], string> = { offline: '#64748b', idle: '#94a3b8', working: '#22d3ee', researching: '#a78bfa', collaborating: '#34d399', waiting: '#fbbf24', error: '#fb7185' };
export default function OfficeRenderer(props: { agents: OfficeAgent[]; groups: CollaborationGroup[]; layout: Layout; floor: string; filter: string; zoom: number; selected?: string; onSelect: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null), hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props), positions = useRef<Record<string, Point>>({}), pan = useRef<Point>({ x: 0, y: 0 });
  const hit = useRef<{ id: string; point: Point }[]>([]), size = useRef({ width: 1, height: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  useEffect(() => { latest.current = props; });
  useEffect(() => {
    const canvas = canvasRef.current!, host = hostRef.current!;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect; size.current = { width: rect.width, height: rect.height };
      const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    }); observer.observe(host);
    let frame = 0, previous = 0;
    const render = (time: number) => {
      const p = latest.current, { width, height } = size.current, ctx = canvas.getContext('2d');
      const dt = previous ? Math.min((time - previous) / 1000, .05) : 0; previous = time;
      if (ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, width, height);
        ctx.translate(pan.current.x, pan.current.y); ctx.scale(p.zoom, p.zoom);
        const scene = officeLayout(p.layout, p.agents, p.groups);
        for (const room of scene.rooms.filter(r => r.floor === p.floor)) {
          ctx.fillStyle = '#0f172a'; ctx.fillRect(room.x, room.y, room.width, room.height);
          ctx.strokeStyle = '#164e63'; ctx.strokeRect(room.x, room.y, room.width, room.height);
          ctx.fillStyle = '#67e8f9'; ctx.font = '14px monospace'; ctx.fillText(room.name, room.x + 14, room.y + 24);
          ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace'; ctx.fillText(room.department, room.x + 14, room.y + 42);
          if (room.kind !== 'lounge') for (let n = 0; n < room.capacity; n++) {
            const pos = { x: room.x + 48 + n % room.columns * 64, y: room.y + 88 + Math.floor(n / room.columns) * 64 };
            if (!inViewport(pos, width, height, p.zoom, pan.current)) continue;
            ctx.fillStyle = '#1e293b'; ctx.fillRect(pos.x - 22, pos.y - 20, 44, 28);
            ctx.fillStyle = '#334155'; ctx.fillRect(pos.x - 12, pos.y - 28, 24, 12);
          }
        }
        hit.current = [];
        for (const id of Object.keys(positions.current)) if (!scene.positions[id]) delete positions.current[id];
        for (const a of p.agents) {
          const target = scene.positions[a.id]; if (!target) continue;
          const current = positions.current[a.id] ?? target;
          const point = moveTowards(current, target, dt); positions.current[a.id] = point;
          const room = scene.rooms.find(r => r.id === target.room);
          if (room?.floor !== p.floor || (p.filter !== 'all' && a.state !== p.filter) || !inViewport(point, width, height, p.zoom, pan.current, 80)) continue;
          const collaborating = p.groups.some(g => g.members.includes(a.id));
          ctx.fillStyle = COLORS[collaborating && a.state !== 'waiting' ? 'collaborating' : a.state];
          ctx.fillRect(point.x - 8, point.y - 10, 16, 16); ctx.fillRect(point.x - 11, point.y + 8, 22, 12);
          ctx.fillStyle = '#020617'; ctx.fillRect(point.x - 5, point.y - 5, 3, 3); ctx.fillRect(point.x + 2, point.y - 5, 3, 3);
          if (p.selected === a.id) { ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2; ctx.strokeRect(point.x - 16, point.y - 15, 32, 40); }
          ctx.fillStyle = '#e2e8f0'; ctx.font = '10px monospace'; ctx.fillText(a.name.slice(0, 13), point.x - 26, point.y + 34);
          hit.current.push({ id: a.id, point: { x: point.x * p.zoom + pan.current.x, y: point.y * p.zoom + pan.current.y } });
        }
      }
      frame = requestAnimationFrame(render);
    }; frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  return <div ref={hostRef} className="relative flex-1 min-h-[380px] rounded-xl overflow-hidden border border-cyan-900">
    <canvas ref={canvasRef} aria-label="Plano cenital de la oficina. Selecciona agentes con la lista accesible." className="w-full h-full absolute inset-0 touch-none" onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => {
      if (!drag.current) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
      pan.current = { x: pan.current.x + dx, y: pan.current.y + dy }; drag.current.x = e.clientX; drag.current.y = e.clientY;
    }} onPointerUp={e => {
      if (drag.current && !drag.current.moved) { const rect = e.currentTarget.getBoundingClientRect(); const match = hit.current.find(h => Math.hypot(h.point.x - e.clientX + rect.left, h.point.y - e.clientY + rect.top) < 25); if (match) latest.current.onSelect(match.id); }
      drag.current = null;
    }} onPointerCancel={() => { drag.current = null; }} />
    <button className="absolute bottom-3 right-3 bg-slate-800 text-cyan-200 rounded px-3 py-2 text-xs" onClick={() => { pan.current = { x: 0, y: 0 }; }}>Centrar plano</button>
  </div>;
}
