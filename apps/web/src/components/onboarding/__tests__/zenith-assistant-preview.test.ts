import { describe, expect, it } from 'vitest'
import type { ConversationId, ConversationMessageId, PrincipalId } from '@zenith/ids'
import type { AgentThreadCache } from '@/components/conversation/events-reducer'
import { asAgentMessage, type ConversationMessageDTO } from '@/lib/shared/conversation/types'
import { ZENITH_ASSISTANT_PREVIEW_ID, applyZenithAssistantPreview } from '../zenith-assistant-preview'

const CONV = 'conversation_01kw8qxn1eeh4t2rek7varh032' as ConversationId
const ZENITH_ASSISTANT = {
  principalId: 'principal_zenithAssistant' as PrincipalId,
  displayName: 'Zenith Assistant',
  avatarUrl: null,
}

function message(over: Partial<ConversationMessageDTO>): ConversationMessageDTO {
  return {
    id: 'conversation_msg_1' as ConversationMessageId,
    conversationId: CONV,
    ticketId: null,
    senderType: 'visitor',
    content: 'Hi! Is anyone there?',
    createdAt: '2026-10-04T10:00:00.000Z',
    author: null,
    attachments: [],
    citations: [],
    isAssistant: false,
    isInternal: false,
    contentJson: null,
    viaEmail: false,
    systemEvent: null,
    ...over,
  }
}

function thread(messages: ConversationMessageDTO[]): AgentThreadCache {
  return {
    conversation: { id: CONV } as AgentThreadCache['conversation'],
    messages: messages.map(asAgentMessage),
  }
}

const delta = (text: string) => ({
  kind: 'assistant_delta' as const,
  conversationId: CONV,
  text,
  at: '2026-10-04T10:00:01.000Z',
})

describe('applyZenithAssistantPreview', () => {
  it('shows a streaming ZenithAssistant turn as one growing message', () => {
    const base = thread([
      message({}),
      message({
        id: 'conversation_msg_0' as ConversationMessageId,
        senderType: 'agent',
        isAssistant: true,
        author: ZENITH_ASSISTANT,
      }),
    ])
    const first = applyZenithAssistantPreview(base, delta('Hi!'))!
    const second = applyZenithAssistantPreview(first, delta('Hi! I am here.'))!
    const previews = second.messages.filter((m) => m.id === ZENITH_ASSISTANT_PREVIEW_ID)
    expect(previews).toHaveLength(1)
    expect(previews[0]).toMatchObject({
      content: 'Hi! I am here.',
      isAssistant: true,
      senderType: 'agent',
      author: ZENITH_ASSISTANT,
    })
    expect(second.messages.at(-1)!.id).toBe(ZENITH_ASSISTANT_PREVIEW_ID)
  })

  it('drops the preview when the turn retracts it or the real reply lands', () => {
    const streaming = applyZenithAssistantPreview(thread([message({})]), delta('Hi!'))!
    expect(applyZenithAssistantPreview(streaming, delta(''))!.messages.map((m) => m.id)).toEqual([
      'conversation_msg_1',
    ])
    const landed = applyZenithAssistantPreview(streaming, {
      kind: 'message',
      conversationId: CONV,
      message: message({
        id: 'conversation_msg_2' as ConversationMessageId,
        isAssistant: true,
        senderType: 'agent',
      }),
    })!
    expect(landed.messages.some((m) => m.id === ZENITH_ASSISTANT_PREVIEW_ID)).toBe(false)
  })

  it('leaves the thread alone for other events and before it has loaded', () => {
    const base = thread([message({})])
    expect(
      applyZenithAssistantPreview(base, { kind: 'typing', conversationId: CONV, side: 'visitor', at: '' })
    ).toBe(base)
    expect(applyZenithAssistantPreview(undefined, delta('Hi!'))).toBeUndefined()
  })
})
