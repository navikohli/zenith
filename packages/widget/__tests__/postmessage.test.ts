// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createBridge } from '../src/core/postmessage'

describe('postmessage bridge', () => {
  let postMessage: ReturnType<typeof vi.fn>
  let fakeIframe: { contentWindow: { postMessage: typeof postMessage } }

  beforeEach(() => {
    postMessage = vi.fn()
    fakeIframe = { contentWindow: { postMessage } }
  })

  afterEach(() => vi.restoreAllMocks())

  it('send posts a typed message to the iframe origin', () => {
    const bridge = createBridge({
      getIframe: () => fakeIframe as unknown as HTMLIFrameElement,
      origin: 'https://feedback.acme.com',
    })
    bridge.send('zenith:identify', { anonymous: true })
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'zenith:identify', data: { anonymous: true } },
      'https://feedback.acme.com'
    )
  })

  it('ignores events from other origins', () => {
    const onRecv = vi.fn()
    const bridge = createBridge({
      getIframe: () => fakeIframe as unknown as HTMLIFrameElement,
      origin: 'https://feedback.acme.com',
    })
    bridge.onMessage(onRecv)
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        data: { type: 'zenith:ready' },
      })
    )
    expect(onRecv).not.toHaveBeenCalled()
  })

  it('forwards valid messages from the iframe origin', () => {
    const onRecv = vi.fn()
    const bridge = createBridge({
      getIframe: () => fakeIframe as unknown as HTMLIFrameElement,
      origin: 'https://feedback.acme.com',
    })
    bridge.onMessage(onRecv)
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://feedback.acme.com',
        data: { type: 'zenith:ready' },
      })
    )
    expect(onRecv).toHaveBeenCalledWith({ type: 'zenith:ready' })
  })

  it('ignores non-object data', () => {
    const onRecv = vi.fn()
    const bridge = createBridge({
      getIframe: () => fakeIframe as unknown as HTMLIFrameElement,
      origin: 'https://feedback.acme.com',
    })
    bridge.onMessage(onRecv)
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://feedback.acme.com',
        data: 'hello',
      })
    )
    expect(onRecv).not.toHaveBeenCalled()
  })

  it('accepts capture requests only from the registered iframe window and origin', () => {
    const received = vi.fn()
    const bridge = createBridge({ getIframe: () => fakeIframe as unknown as HTMLIFrameElement, origin: 'https://feedback.acme.com' })
    bridge.onMessage(received)
    const data = { type: 'zenith:capture-diagnostics', requestId: 'test' }
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://feedback.acme.com', data }))
    expect(received).not.toHaveBeenCalled()
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://feedback.acme.com', source: fakeIframe.contentWindow as unknown as Window, data }))
    expect(received).toHaveBeenCalledWith(data)
    bridge.dispose()
  })

  it('dispose removes the window listener', () => {
    const onRecv = vi.fn()
    const bridge = createBridge({
      getIframe: () => fakeIframe as unknown as HTMLIFrameElement,
      origin: 'https://feedback.acme.com',
    })
    bridge.onMessage(onRecv)
    bridge.dispose()
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://feedback.acme.com',
        data: { type: 'zenith:ready' },
      })
    )
    expect(onRecv).not.toHaveBeenCalled()
  })
})
