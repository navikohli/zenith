/**
 * The assistant's (ZenithAssistant's) service-principal id, memoized process-wide so
 * message loads can flag ZenithAssistant's turns (`isAssistant` on the DTO, via
 * `toMessageDTO`'s third arg) without a per-load lookup. Shared by every
 * thread loader that maps rows to DTOs — conversation.query.ts's
 * `listMessages` and the tickets domain's pair-thread union loader
 * (convergence Phase 2: the flag resolves identically whichever parent of the
 * pair a row hangs off).
 *
 * A resolved id is cached for the process; a null (ZenithAssistant not yet provisioned)
 * is re-checked periodically so enabling ZenithAssistant later heals without a restart.
 */
import type { PrincipalId } from '@zenith/ids'
import { getAssistantPrincipal } from '@/lib/server/domains/assistant/assistant.principal'
import { WorkspaceKeyedCache } from '@/lib/server/workspaces/workspace-keyed'

/**
 * Per workspace: a principal id is a row in one workspace's database, so a shared
 * memo flags a foreign id as "this is the assistant" in every other workspace —
 * mislabelling human agents' turns as the assistant's and vice versa.
 */
const cachedAssistantPrincipalId = new WorkspaceKeyedCache<PrincipalId>(256)
const checkedAt = new WorkspaceKeyedCache<number>(256)
const MEMO_KEY = 'assistant-principal'

export async function assistantPrincipalIdOnce(): Promise<PrincipalId | null> {
  const cached = cachedAssistantPrincipalId.get(MEMO_KEY)
  if (cached) return cached
  if (Date.now() - (checkedAt.get(MEMO_KEY) ?? 0) > 60_000) {
    const resolved = (await getAssistantPrincipal())?.id ?? null
    checkedAt.set(MEMO_KEY, Date.now())
    if (resolved) {
      cachedAssistantPrincipalId.set(MEMO_KEY, resolved)
      return resolved
    }
  }
  return null
}
