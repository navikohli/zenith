// ---- Metadata ----

/** Key-value string pairs attached to a widget session. Stored on posts created via the widget. */
export type WidgetMetadata = Record<string, string>

// ---- SDK Event Payloads ----

export interface WidgetEventMap {
  ready: Record<string, never>
  open: Record<string, never>
  close: Record<string, never>
  'post:created': {
    id: string
    title: string
    board: { id: string; name: string; slug: string }
    statusId: string | null
  }
  vote: {
    postId: string
    voted: boolean
    voteCount: number
  }
  'comment:created': {
    postId: string
    commentId: string
    parentId: string | null
  }
  identify: {
    success: boolean
    user: { id: string; name: string; email: string } | null
    anonymous: boolean
    error?: string
  }
}

export type WidgetEventName = keyof WidgetEventMap

// ---- SDK -> Iframe Messages ----

export interface WidgetInboundMessages {
  'zenith:identify': { anonymous: true } | Record<string, unknown> | null
  'zenith:metadata': WidgetMetadata
  'zenith:locale': string
  'zenith:open':
    | {
        view?: 'home' | 'new-post' | 'changelog' | 'help' | 'chat' | 'messages' | 'tickets'
        title?: string
        body?: string
        board?: string
        query?: string
        entryId?: string
        postId?: string
        articleId?: string // `article_…` TypeID or public slug
      }
    | undefined
}

// ---- Iframe -> SDK Messages ----

export interface WidgetOutboundMessages {
  'zenith:ready': Record<string, never>
  'zenith:close': Record<string, never>
  'zenith:navigate': { url: string }
  'zenith:identify-result': {
    success: boolean
    user: { id: string; name: string; email: string; avatarUrl: string | null } | null
    error?: string
  }
  'zenith:auth-change': {
    user: { id: string; name: string; email: string; avatarUrl: string | null } | null
  }
  'zenith:event': {
    name: WidgetEventName
    payload: WidgetEventMap[WidgetEventName]
  }
}
