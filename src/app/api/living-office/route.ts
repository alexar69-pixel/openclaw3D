import { readOpenClawConfig } from '@/lib/gateway-connection';
import { getMonitor } from '@/living-office/gateway-monitor';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!readOpenClawConfig()) return Response.json({ connected: false, agents: [], error: 'Gateway no configurado' }, { status: 503 });
  try { return Response.json(await getMonitor().snapshot(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ connected: false, agents: [], error: 'Gateway no disponible' }, { status: 503 }); }
}
