import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AgentInspector from '@/components/living-office/AgentInspector';
import { demoAgents } from '@/living-office/demo';
import OfficePage from '@/app/office/page';
vi.mock('@/hooks/useLivingOffice', () => ({ useLivingOffice: () => ({ agents: [], connected: false, message: 'Gateway no disponible' }) }));
vi.mock('@/components/living-office/OfficeRenderer', () => ({ default: () => <div>Canvas</div> }));
afterEach(cleanup);
describe('Living Office user flow', () => {
  it('starts disconnected without simulated agents and explicitly enables labelled demo', () => {
    render(<OfficePage />);
    expect(screen.getByText(/No hay sesiones observadas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Modo DEMO' }));
    expect(screen.getByText(/DEMO · datos simulados/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cantidad de agentes demo'), { target: { value: '100' } });
    expect(screen.getByText(/100 sesiones/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Agent 01/ }));
    expect(screen.getByText('DEMO / simulated')).toBeInTheDocument();
    expect(screen.getByText('demo-run:0')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado' }), { target: { value: 'waiting' } });
    expect(screen.queryByRole('button', { name: /Agent 01/ })).not.toBeInTheDocument();
  });
  it('reports missing task and observed errors without fabricated task names', () => {
    render(<AgentInspector agent={demoAgents(5)[4]} groups={[]} />);
    expect(screen.getByText('No disponible en los eventos recibidos')).toBeInTheDocument();
    expect(screen.getByText(/Errores: 1 observados/)).toBeInTheDocument();
    expect(screen.getByText('Sin evidencia suficiente')).toBeInTheDocument();
  });
});
