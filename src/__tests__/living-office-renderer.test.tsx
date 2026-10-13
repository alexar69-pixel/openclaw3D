import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import OfficeRenderer from '@/components/living-office/OfficeRenderer';
import { demoAgents } from '@/living-office/demo';
import { validateLayout } from '@/living-office/office-layout-engine';
import layout from '@/living-office/layout.json';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('renders a resized canvas and omits agents outside the viewport', () => {
  let nextFrame: FrameRequestCallback = () => {};
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { nextFrame = callback; return 1; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: (entries: unknown[]) => void) {}
    observe() { this.callback([{ contentRect: { width: 640, height: 480 } }]); }
    disconnect() {}
  });
  const context = { setTransform: vi.fn(), fillRect: vi.fn(), translate: vi.fn(), scale: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const { container } = render(<OfficeRenderer agents={demoAgents(5)} groups={[]} layout={validateLayout(layout)} floor="operations" filter="all" zoom={1} onSelect={() => {}} />);
  nextFrame(16);
  expect(container.querySelector('canvas')?.width).toBe(640);
  const labels = context.fillText.mock.calls.map(call => call[0]);
  expect(labels).toContain('Agent 01');
  expect(labels).not.toContain('Agent 02');
  expect(labels).not.toContain('Agent 04');
});
