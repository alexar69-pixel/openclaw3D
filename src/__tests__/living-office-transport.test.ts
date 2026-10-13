// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import { GatewayConnection } from '@/lib/gateway-connection';
import { normalizeLiveEvent } from '@/living-office/gateway-adapter';
import { applyEvent, createAgent } from '@/living-office/agent-state-engine';
describe('Gateway protocol integration with isolated local fixture', () => {
  it('authenticates with read scope and consumes real protocol frames through run completion', async () => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Fixture port unavailable');
    const keys = ['OPENCLAW_CONFIG_PATH', 'OPENCLAW_GATEWAY_PORT', 'OPENCLAW_GATEWAY_TOKEN'] as const;
    const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    process.env.OPENCLAW_CONFIG_PATH = '/tmp/living-office-nonexistent-config.json';
    process.env.OPENCLAW_GATEWAY_PORT = String(address.port);
    process.env.OPENCLAW_GATEWAY_TOKEN = 'local-test-fixture';
    const connection = new GatewayConnection(true);
    let socket: WebSocket | undefined, scopes: string[] = [], state = createAgent('agent:fixture:main');
    server.on('connection', client => {
      socket = client;
      client.send(JSON.stringify({ type: 'event', event: 'connect.challenge', payload: { nonce: 'fixture-nonce' } }));
      client.on('message', raw => {
        const frame = JSON.parse(raw.toString());
        if (frame.method === 'connect') { scopes = frame.params.scopes; client.send(JSON.stringify({ type: 'res', id: frame.id, ok: true, payload: {} })); }
        else if (frame.method === 'agents.list') client.send(JSON.stringify({ type: 'res', id: frame.id, ok: true, payload: { agents: [{ id: 'fixture', name: 'Fixture' }] } }));
        else if (frame.method === 'sessions.list') client.send(JSON.stringify({ type: 'res', id: frame.id, ok: true, payload: { sessions: [{ key: 'agent:fixture:main' }] } }));
        else throw new Error('Unexpected RPC');
      });
    });
    connection.subscribe((_key, live) => { const event = normalizeLiveEvent(live); if (event) state = applyEvent(state, event); });
    try {
      connection.ensureStarted();
      await vi.waitFor(() => expect(connection.isReady).toBe(true));
      expect(scopes).toEqual(['operator.read']);
      const snapshot = await connection.request<{ sessions: { key: string }[] }>('sessions.list');
      expect(snapshot.sessions[0].key).toBe('agent:fixture:main');
      const send = (event: string, payload: object) => socket!.send(JSON.stringify({ type: 'event', event, payload: { sessionKey: state.sessionKey, runId: 'fixture-run', ...payload } }));
      send('agent', { stream: 'lifecycle', data: { phase: 'start' } });
      await vi.waitFor(() => expect(state.state).toBe('working'));
      send('agent', { stream: 'tool', data: { name: 'web_search', phase: 'start', args: 'never exposed' } });
      await vi.waitFor(() => expect(state.state).toBe('researching'));
      send('chat', { state: 'final' });
      await vi.waitFor(() => expect(state.state).toBe('idle'));
      expect(state.tools).toEqual(['web_search']);
      expect(JSON.stringify(state)).not.toContain('never exposed');
    } finally {
      connection.destroy();
      for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
