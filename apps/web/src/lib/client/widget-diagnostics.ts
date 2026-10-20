import {
  feedbackDiagnosticsSchema,
  type FeedbackDiagnosticsInput,
} from '@/lib/shared/feedback-diagnostics'
import { sendToHost } from './widget-bridge'

/** Request the host page at submit time, not a screenshot of our iframe. */
export function captureHostDiagnostics(): Promise<FeedbackDiagnosticsInput | undefined> {
  if (window.parent === window) return Promise.resolve(undefined)
  const requestId = crypto.randomUUID()
  return new Promise((resolve) => {
    const finish = (value?: FeedbackDiagnosticsInput) => {
      clearTimeout(timer)
      window.removeEventListener('message', listener)
      resolve(value)
    }
    const listener = (event: MessageEvent) => {
      if (
        event.source !== window.parent ||
        event.data?.type !== 'zenith:diagnostics' ||
        event.data?.data?.requestId !== requestId
      )
        return
      const parsed = feedbackDiagnosticsSchema.safeParse(event.data.data.diagnostics)
      finish(parsed.success ? parsed.data : undefined)
    }
    const timer = setTimeout(() => finish(), 9000)
    window.addEventListener('message', listener)
    sendToHost({ type: 'zenith:capture-diagnostics', requestId })
  })
}
