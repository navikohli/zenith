interface NativeBridge {
  dispatch: (event: string, data: unknown) => void
}

declare global {
  interface Window {
    __zenithNative?: Partial<NativeBridge>
  }
}

export function sendToHost(message: Record<string, unknown>): void {
  if (window.__zenithNative?.dispatch) {
    const rawType = typeof message.type === 'string' ? message.type : ''
    const eventType = rawType.startsWith('zenith:')
      ? rawType.slice('zenith:'.length)
      : rawType || 'unknown'
    window.__zenithNative.dispatch(eventType, message)
    return
  }
  window.parent.postMessage(message, '*')
}

export function isNativeWidget(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('source') === 'native'
}
