import type { Point } from './office-layout-engine';
export function moveTowards(current: Point, target: Point, seconds: number, speed = 180): Point {
  const dx = target.x - current.x, dy = target.y - current.y, distance = Math.hypot(dx, dy);
  const fraction = distance === 0 ? 1 : Math.min(1, Math.max(0, seconds) * speed / distance);
  return { x: current.x + dx * fraction, y: current.y + dy * fraction };
}
export function inViewport(point: Point, width: number, height: number, zoom: number, pan: Point, margin = 40) {
  const x = point.x * zoom + pan.x, y = point.y * zoom + pan.y;
  return x >= -margin && y >= -margin && x <= width + margin && y <= height + margin;
}
