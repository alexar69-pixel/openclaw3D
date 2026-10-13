import { readOpenClawConfig } from '@/lib/gateway-connection';
import { getMonitor } from '@/living-office/gateway-monitor';
import { normalizeLiveEvent } from '@/living-office/gateway-adapter';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!readOpenClawConfig()) return new Response('Gateway no configurado', { status: 503 });
  const gw = getMonitor().connection;
  gw.ensureStarted();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder(); let closed = false;
      const send = (event: string, data: unknown) => { if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); };
      const subscriber: Parameters<typeof gw.subscribe>[0] = (_key, live) => {
        const event = normalizeLiveEvent(live); if (event) { try { send('activity', event); } catch { cleanup(); } }
      };
      const connectionSubscriber = (connected: boolean) => { try { send('connection', { connected }); } catch { cleanup(); } };
      const timer = setInterval(() => { try { send('connection', { connected: gw.isReady }); } catch { cleanup(); } }, 3000);
      cleanup = () => { if (closed) return; closed = true; clearInterval(timer); gw.unsubscribe(subscriber); gw.unsubscribeConnection(connectionSubscriber); request.signal.removeEventListener('abort', cleanup); try { controller.close(); } catch { /* already closed */ } };
      gw.subscribe(subscriber); gw.subscribeConnection(connectionSubscriber); request.signal.addEventListener('abort', cleanup, { once: true });
      send('connection', { connected: gw.isReady });
      if (request.signal.aborted) cleanup();
    }, cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
