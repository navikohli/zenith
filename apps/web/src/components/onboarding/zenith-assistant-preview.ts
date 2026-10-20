import type { ConversationMessageId } from '@zenith/ids'
import type { AgentThreadCache } from '@/components/conversation/events-reducer'
import { asAgentMessage, type ConversationStreamEvent } from '@/lib/shared/conversation/types'

/** The one placeholder row a streaming ZenithAssistant turn occupies until its reply lands. */
export const ZENITH_ASSISTANT_PREVIEW_ID = 'conversation_msg_zenithAssistant_preview' as ConversationMessageId

function withoutPreview(thread: AgentThreadCache): AgentThreadCache {
  if (!thread.messages.some((m) => m.id === ZENITH_ASSISTANT_PREVIEW_ID)) return thread
  return { ...thread, messages: thread.messages.filter((m) => m.id !== ZENITH_ASSISTANT_PREVIEW_ID) }
}

/**
 * Show ZenithAssistant's live turn in an inbox thread: each delta carries the whole
 * answer so far, an empty one retracts it, and the persisted reply replaces it.
 * Every other event leaves the thread to the regular reducer.
 */
export function applyZenithAssistantPreview(
  thread: AgentThreadCache | undefined,
  event: ConversationStreamEvent
): AgentThreadCache | undefined {
  if (!thread) return thread
  if (event.kind === 'message') return event.message.isAssistant ? withoutPreview(thread) : thread
  if (event.kind !== 'assistant_delta') return thread
  const rest = withoutPreview(thread)
  if (!event.text) return rest
  const author = [...rest.messages].reverse().find((m) => m.isAssistant)?.author ?? null
  const preview = asAgentMessage({
    id: ZENITH_ASSISTANT_PREVIEW_ID,
    conversationId: thread.conversation.id,
    ticketId: null,
    senderType: 'agent',
    content: event.text,
    createdAt: event.at,
    author,
    attachments: [],
    citations: [],
    isAssistant: true,
    isInternal: false,
    contentJson: null,
    viaEmail: false,
    systemEvent: null,
  })
  return { ...rest, messages: [...rest.messages, preview] }
}
