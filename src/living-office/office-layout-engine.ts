import { type OfficeAgent } from './agent-state-engine';
import { type CollaborationGroup } from './collaboration-engine';
export interface Point { x: number; y: number }
export interface Room { id: string; name: string; department: string; floor: string; kind: 'work' | 'research' | 'collaboration' | 'lounge'; capacity: number; columns: number }
export interface Layout { version: number; floors: { id: string; name: string }[]; rooms: Room[] }
export interface PlacedRoom extends Room { x: number; y: number; width: number; height: number }
export function validateLayout(input: unknown): Layout {
  if (!input || typeof input !== 'object') throw new Error('Plano inválido');
  const l = input as Layout;
  if (l.version !== 1 || !Array.isArray(l.floors) || !l.floors.length || !Array.isArray(l.rooms) || !l.rooms.length || l.rooms.length > 100) throw new Error('Plano v1 requiere plantas y salas');
  const ids = new Set<string>();
  for (const f of l.floors) { if (!f || typeof f.id !== 'string' || !f.id || typeof f.name !== 'string' || ids.has(f.id)) throw new Error('Planta inválida'); ids.add(f.id); }
  const rooms = new Set<string>();
  for (const r of l.rooms) {
    if (!r || typeof r.id !== 'string' || !r.id || rooms.has(r.id) || !ids.has(r.floor) || typeof r.name !== 'string' || typeof r.department !== 'string' || !['work', 'research', 'collaboration', 'lounge'].includes(r.kind) || !Number.isInteger(r.capacity) || r.capacity < 1 || r.capacity > 100 || !Number.isInteger(r.columns) || r.columns < 1 || r.columns > 20) throw new Error('Sala inválida');
    rooms.add(r.id);
  }
  return l;
}
export function officeLayout(layout: Layout, agents: OfficeAgent[], groups: CollaborationGroup[]) {
  const rooms: PlacedRoom[] = []; const floorX = new Map<string, number>();
  for (const room of layout.rooms) { const x = floorX.get(room.floor) ?? 24; const width = room.columns * 64 + 32, height = Math.ceil(room.capacity / room.columns) * 64 + 64; rooms.push({ ...room, x, y: 24, width, height }); floorX.set(room.floor, x + width + 24); }
  const positions: Record<string, Point & { room: string; desk: boolean }> = {};
  const used = new Map<string, number>(); const overflow: string[] = [];
  const ordered = [...agents].sort((a, b) => {
    const ga = groups.find(g => g.members.includes(a.id))?.id ?? a.id, gb = groups.find(g => g.members.includes(b.id))?.id ?? b.id;
    return ga.localeCompare(gb) || a.id.localeCompare(b.id);
  });
  for (const a of ordered) {
    const group = groups.find(g => g.members.includes(a.id));
    const kind = group ? 'collaboration' : a.state === 'researching' ? 'research' : a.state === 'working' ? 'work' : 'lounge';
    const room = rooms.find(r => r.kind === kind && (used.get(r.id) ?? 0) < r.capacity);
    if (!room) { overflow.push(a.id); continue; }
    const n = used.get(room.id) ?? 0; used.set(room.id, n + 1);
    positions[a.id] = { x: room.x + 48 + (n % room.columns) * 64, y: room.y + 88 + Math.floor(n / room.columns) * 64, room: room.id, desk: kind !== 'lounge' && a.state !== 'waiting' };
  }
  return { rooms, positions, overflow };
}
