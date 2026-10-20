export type InboundMessage =
  | { type: 'zenith:init'; data?: unknown }
  | { type: 'zenith:identify'; data: unknown }
  | { type: 'zenith:device'; data: string }
  | { type: 'zenith:metadata'; data: Record<string, string> }
  | { type: 'zenith:open'; data?: unknown }
  | { type: 'zenith:locale'; data: string }
  | { type: 'zenith:mobile'; data: boolean }
  | { type: 'zenith:diagnostics'; data: unknown }

export type OutboundMessage =
  | { type: 'zenith:ready' }
  | { type: 'zenith:close' }
  | { type: 'zenith:navigate'; url: string }
  | { type: 'zenith:expand'; expanded: boolean }
  | { type: 'zenith:identify-result'; success: boolean; user?: unknown; error?: string }
  | { type: 'zenith:auth-change'; user: unknown }
  | { type: 'zenith:event'; name: string; payload: unknown }
  | { type: 'zenith:unread'; count: number }
  | { type: 'zenith:capture-diagnostics'; requestId: string }

export interface BridgeOptions {
  getIframe: () => HTMLIFrameElement | null
  origin: string
}

export interface Bridge {
  send(type: InboundMessage['type'], data?: unknown): void
  onMessage(handler: (msg: OutboundMessage) => void): () => void
  dispose(): void
}

export function createBridge(opts: BridgeOptions): Bridge {
  const handlers = new Set<(msg: OutboundMessage) => void>()

  const listener = (event: MessageEvent) => {
    if (event.origin !== opts.origin) return
    const msg = event.data
    if (!msg || typeof msg !== 'object' || typeof (msg as { type?: unknown }).type !== 'string')
      return
    // Capturing the host page is permitted only to this SDK's own frame.
    if (msg.type === 'zenith:capture-diagnostics' && event.source !== opts.getIframe()?.contentWindow) return
    for (const h of handlers) {
      try {
        h(msg as OutboundMessage)
      } catch {
        /* swallow */
      }
    }
  }
  window.addEventListener('message', listener)

  return {
    send(type, data) {
      const iframe = opts.getIframe()
      if (!iframe?.contentWindow) return
      iframe.contentWindow.postMessage({ type, data }, opts.origin)
    },
    onMessage(handler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    dispose() {
      window.removeEventListener('message', listener)
      handlers.clear()
    },
  }
}
