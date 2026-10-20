import html2canvas from 'html2canvas-pro'

export interface CapturedDiagnostics {
  version: 1
  capturedAt: string
  page: { url: string; title: string }
  browser: {
    userAgent: string
    platform: string
    language: string
    timeZone: string
    viewport: string
    screen: string
    pixelRatio: number
    online: boolean
  }
  errors: {
    kind: 'console.error' | 'error' | 'unhandledrejection'
    timestamp: string
    message: string
    stack?: string
  }[]
  screenshot: { status: 'captured' | 'failed' | 'disabled' | 'unavailable'; dataUrl?: string }
}

const SENSITIVE_KEY = /password|passwd|secret|token|authorization|cookie|api[-_]?key/i
const MAX_IMAGE_LENGTH = 2_800_000

export function redactDiagnosticText(text: string): string {
  return text
    .replace(/https?:\/\/[^\s"'<>]+/g, (value) => {
      try {
        const url = new URL(value)
        url.search = ''
        url.hash = ''
        url.username = ''
        url.password = ''
        return url.href
      } catch {
        return '[URL]'
      }
    })
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(
      /((?:password|passwd|secret|token|authorization|cookie|api[-_]?key)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      '$1[redacted]'
    )
    .slice(0, 4000)
}

function errorText(value: unknown): string {
  if (value instanceof Error) return redactDiagnosticText(`${value.name}: ${value.message}`)
  if (typeof value === 'string') return redactDiagnosticText(value)
  try {
    const seen = new WeakSet<object>()
    const bounded = (item: unknown, depth = 0): unknown => {
      if (typeof item === 'string') return item.slice(0, 1000)
      if (!item || typeof item !== 'object') return typeof item === 'bigint' ? String(item) : item
      if (seen.has(item)) return '[circular]'
      if (depth >= 3) return '[object]'
      seen.add(item)
      if (Array.isArray(item)) return item.slice(0, 10).map(entry => bounded(entry, depth + 1))
      const result: Record<string, unknown> = Object.create(null)
      let count = 0
      for (const key in item) {
        if (!Object.prototype.hasOwnProperty.call(item, key)) continue
        if (count++ >= 20) break
        const descriptor = Object.getOwnPropertyDescriptor(item, key)
        result[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : descriptor && 'value' in descriptor ? bounded(descriptor.value, depth + 1) : '[accessor]'
      }
      return result
    }
    return redactDiagnosticText(JSON.stringify(bounded(value)) ?? String(value))
  } catch {
    return '[unserializable error]'
  }
}

/** Mask a detached clone; never mutate the application's real inputs. */
export function maskDiagnosticDocument(doc: Document): void {
  for (const node of doc.querySelectorAll<HTMLElement>(
    'input, textarea, select, [contenteditable], [data-zenith-private]'
  )) {
    node.style.setProperty('color', 'transparent', 'important')
    node.style.setProperty('text-shadow', 'none', 'important')
    node.style.setProperty('background', '#d1d5db', 'important')
    if (node.matches('input, textarea, select')) {
      ;(node as HTMLInputElement).value = ''
      node.removeAttribute('value')
      node.removeAttribute('placeholder')
    } else {
      node.replaceChildren(doc.createTextNode('[hidden]'))
    }
  }
}

/** Bounded, in-memory collection. Nothing is sent until feedback is submitted. */
export function createDiagnosticsCollector() {
  let errors: CapturedDiagnostics['errors'] = []
  const original = console.error
  function record(
    kind: CapturedDiagnostics['errors'][number]['kind'],
    values: unknown[],
    stack?: string
  ) {
    try {
      errors.push({
        kind,
        timestamp: new Date().toISOString(),
        message: values.map(errorText).join(' ').slice(0, 2000),
        ...(stack ? { stack: redactDiagnosticText(stack) } : {}),
      })
      errors = errors.slice(-20)
    } catch {
      /* Diagnostics must not break the host application. */
    }
  }
  const wrapped: typeof console.error = (...args) => {
    record('console.error', args, args.find((item) => item instanceof Error)?.stack)
    original.apply(console, args)
  }
  console.error = wrapped
  const onError = (event: ErrorEvent) =>
    record('error', [event.message], event.error instanceof Error ? event.error.stack : undefined)
  const onRejection = (event: PromiseRejectionEvent) =>
    record(
      'unhandledrejection',
      [event.reason],
      event.reason instanceof Error ? event.reason.stack : undefined
    )
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  let inFlight: Promise<CapturedDiagnostics> | null = null

  async function capture(): Promise<CapturedDiagnostics> {
    const snapshot: CapturedDiagnostics = {
      version: 1,
      capturedAt: new Date().toISOString(),
      page: { url: redactDiagnosticText(location.href), title: document.title.slice(0, 300) },
      browser: {
        userAgent: navigator.userAgent.slice(0, 1000),
        platform: navigator.platform.slice(0, 200),
        language: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: `${innerWidth}x${innerHeight}`,
        screen: `${screen.width}x${screen.height}`,
        pixelRatio: devicePixelRatio || 1,
        online: navigator.onLine,
      },
      errors: errors
        .filter((error) => Date.now() - Date.parse(error.timestamp) < 5 * 60_000)
        .map((error) => ({ ...error })),
      screenshot: { status: 'failed' },
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    try {
      const canvas = await Promise.race([
        html2canvas(document.documentElement, {
          width: innerWidth,
          height: innerHeight,
          x: scrollX,
          y: scrollY,
          windowWidth: innerWidth,
          windowHeight: innerHeight,
          scrollX,
          scrollY,
          scale: Math.min(1, 1600 / Math.max(1, innerWidth), 1000 / Math.max(1, innerHeight)),
          logging: false,
          allowTaint: false,
          useCORS: false,
          imageTimeout: 1500,
          signal: controller.signal,
          onclone: maskDiagnosticDocument,
          ignoreElements: (element) =>
            element.matches('.zenith-panel, .zenith-backdrop, .zenith-launcher, iframe, video'),
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(new Error('capture timeout'))
          }, 7000)
        }),
      ])
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
      if (dataUrl.startsWith('data:image/jpeg;base64,') && dataUrl.length <= MAX_IMAGE_LENGTH) {
        snapshot.screenshot = { status: 'captured', dataUrl }
      }
    } catch {
      /* Submit the browser/errors even if this page cannot be rendered. */
    } finally {
      clearTimeout(timer)
    }
    return snapshot
  }

  return {
    capture() {
      return (inFlight ??= capture().finally(() => {
        inFlight = null
      }))
    },
    clear() {
      errors = []
    },
    stop() {
      if (console.error === wrapped) console.error = original
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      errors = []
    },
  }
}
