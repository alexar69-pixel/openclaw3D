import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import WorkspaceSettings from '@/components/living-office/WorkspaceSettings';
import { ElasticSpaceEngine, validateSpaceConfig } from '@/living-office/elastic-space-engine';
import { demoAgents } from '@/living-office/demo';
import { demoSpaceConfig } from '@/living-office/demo-space-config';
afterEach(cleanup);
it('adds a sixth floor rather than renaming an existing automatic floor', () => {
  const config = demoSpaceConfig(), plan = new ElasticSpaceEngine().plan(demoAgents(100), [], config), onChange = vi.fn();
  render(<WorkspaceSettings config={config} plan={plan} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Añadir planta' }));
  const next = validateSpaceConfig(onChange.mock.calls[0][0]);
  expect(next.floors).toHaveLength(6); expect(next.floors.at(-1)?.id).toBe('floor-6');
});
