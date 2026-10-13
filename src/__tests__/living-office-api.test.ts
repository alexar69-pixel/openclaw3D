import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ config: vi.fn(), snapshot: vi.fn() }));
vi.mock('@/lib/gateway-connection', () => ({ readOpenClawConfig: mocks.config }));
vi.mock('@/living-office/gateway-monitor', () => ({ getMonitor: () => ({ snapshot: mocks.snapshot }) }));
import { GET } from '@/app/api/living-office/route';
afterEach(() => vi.resetAllMocks());
describe('read-only snapshot route', () => {
  it('does not access Gateway without configuration', async () => {
    mocks.config.mockReturnValue(null);
    expect((await GET()).status).toBe(503);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it('returns readiness and prevents raw credential errors from reaching clients', async () => {
    mocks.config.mockReturnValue({ token: 'private-token' });
    mocks.snapshot.mockRejectedValue(new Error('private-token'));
    const response = await GET(); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private-token');
    mocks.snapshot.mockResolvedValue({ connected: true, agents: [] });
    const ok = await GET(); expect(ok.status).toBe(200);
    expect(ok.headers.get('Cache-Control')).toBe('no-store');
  });
});
