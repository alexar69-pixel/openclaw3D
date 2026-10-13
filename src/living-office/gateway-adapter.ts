import type { SessionLiveState } from '@/lib/gateway-connection';
import type { OfficeEvent } from './agent-state-engine';
/** Explicit allowlists: arbitrary tool data/error text never reaches browser. */
const TOOL_NAMES = new Set(['read', 'write', 'edit', 'exec', 'web_search', 'web_fetch', 'browser', 'sessions_spawn', 'sessions_send', 'sessions_list', 'memory_search', 'memory_get']);
export function normalizeLiveEvent(live: SessionLiveState): OfficeEvent | null {
  const chat = live.lastEventKind ? live.lastEventKind === 'chat' : (live.lastChatEventAt ?? 0) >= (live.lastAgentEventAt ?? 0);
  const at = chat ? live.lastChatEventAt : live.lastAgentEventAt;
  if (!at) return null;
  const phase = String(live.agentEventData?.phase ?? live.agentEventData?.status ?? '').toLowerCase();
  const rawTool = typeof live.agentEventData?.name === 'string' ? live.agentEventData.name : '';
  const tool = TOOL_NAMES.has(rawTool) ? rawTool : undefined;
  let type: OfficeEvent['type'] | undefined;
  if (chat) {
    type = live.chatStatus === 'delta' ? 'working' : live.chatStatus === 'error' ? 'error' : ['final', 'aborted'].includes(live.chatStatus ?? '') ? 'end' : undefined;
  } else if (live.agentStatus === 'error' || phase === 'error') type = 'error';
  else if (live.agentStatus === 'lifecycle') type = phase === 'start' ? 'start' : phase === 'end' ? 'end' : undefined;
  else if (live.agentStatus === 'assistant') type = 'working';
  else if (live.agentStatus === 'tool') type = phase === 'waiting' ? 'waiting' : ['end', 'result', 'completed'].includes(phase) ? 'working' : ['read', 'web_search', 'web_fetch', 'memory_search', 'memory_get'].includes(tool ?? '') ? 'researching' : 'working';
  if (!type) return null;
  return { id: `${live.sessionKey}:${live.lastRunId ?? ''}:${at}:${type}:${tool ?? ''}`, sessionKey: live.sessionKey, runId: live.lastRunId, at, type, ...(tool ? { tool } : {}) };
}
