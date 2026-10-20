import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import html2canvas from 'html2canvas-pro'
import {
  createDiagnosticsCollector,
  maskDiagnosticDocument,
  redactDiagnosticText,
} from '../src/core/diagnostics'

vi.mock('html2canvas-pro', () => ({ default: vi.fn() }))
let collector: ReturnType<typeof createDiagnosticsCollector> | undefined
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(html2canvas).mockResolvedValue({
    toDataURL: () => 'data:image/jpeg;base64,/9j/2Q==',
  } as HTMLCanvasElement)
})
afterEach(() => {
  collector?.stop()
  collector = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('automatic diagnostics', () => {
  it('captures the host at request time, including a bounded set of errors', async () => {
    collector = createDiagnosticsCollector()
    for (let i = 0; i < 25; i++) console.error('failure', i)
    document.title = 'Current task'
    const snapshot = await collector.capture()
    expect(snapshot.page.title).toBe('Current task')
    expect(snapshot.browser.userAgent).toBe(navigator.userAgent)
    expect(snapshot.errors).toHaveLength(20)
    expect(snapshot.errors[0].message).toBe('failure 5')
    expect(snapshot.screenshot.status).toBe('captured')
    expect(html2canvas).toHaveBeenCalledWith(
      document.documentElement,
      expect.objectContaining({
        width: innerWidth,
        height: innerHeight,
        logging: false,
        allowTaint: false,
      })
    )
  })
  it('redacts common credentials in strings, URL queries and structured error values', async () => {
    collector = createDiagnosticsCollector()
    console.error(
      'https://app.example/tasks?token=private#secret',
      { token: 'sensitive', authorization: 'private', reason: 'failed' },
      'Bearer abc.def.ghi'
    )
    const snapshot = await collector.capture()
    const text = JSON.stringify(snapshot.errors)
    expect(text).not.toContain('sensitive')
    expect(text).not.toContain('private')
    expect(text).not.toContain('abc.def.ghi')
    expect(text).toContain('failed')
    expect(redactDiagnosticText('password="abc" api_key=def')).not.toMatch(/abc|def/)
  })
  it('masks detached form controls and private regions without altering real inputs', () => {
    document.body.innerHTML =
      '<input value="secret"><textarea>private</textarea><div data-zenith-private>account number</div>'
    const clone = document.implementation.createHTMLDocument()
    clone.body.innerHTML = document.body.innerHTML
    maskDiagnosticDocument(clone)
    expect(clone.querySelector('input')?.value).toBe('')
    expect(clone.querySelector('textarea')?.value).toBe('')
    expect(clone.querySelector('[data-zenith-private]')?.textContent).toBe('[hidden]')
    expect(document.querySelector('input')?.value).toBe('secret')
    expect(document.querySelector('[data-zenith-private]')?.textContent).toBe('account number')
  })
  it('still returns browser/errors when screenshot rendering fails', async () => {
    vi.mocked(html2canvas).mockRejectedValue(new Error('not supported'))
    collector = createDiagnosticsCollector()
    console.error('the useful error')
    const snapshot = await collector.capture()
    expect(snapshot.screenshot).toEqual({ status: 'failed' })
    expect(snapshot.errors[0].message).toBe('the useful error')
  })
  it('aborts slow captures and clears old-user errors on logout', async () => {
    vi.useFakeTimers()
    vi.mocked(html2canvas).mockReturnValue(new Promise(() => {}))
    collector = createDiagnosticsCollector()
    console.error('old user')
    collector.clear()
    const result = collector.capture()
    await vi.advanceTimersByTimeAsync(7001)
    expect((await result).errors).toHaveLength(0)
    expect((await result).screenshot.status).toBe('failed')
    expect(vi.mocked(html2canvas).mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(true)
  })
  it('restores the previous console function and removes listeners on destroy', () => {
    const previous = console.error
    collector = createDiagnosticsCollector()
    expect(console.error).not.toBe(previous)
    collector.stop()
    expect(console.error).toBe(previous)
  })
})
