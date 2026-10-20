import { z } from 'zod'

export const feedbackScreenshotStatus = z.enum(['captured', 'failed', 'disabled', 'unavailable'])

/** Intake is untrusted. Raw image bytes never become public post content. */
export const feedbackDiagnosticsSchema = z.object({
  version: z.literal(1),
  capturedAt: z.string().datetime(),
  page: z.object({ url: z.string().max(4000), title: z.string().max(300) }),
  browser: z.object({
    userAgent: z.string().max(1000),
    platform: z.string().max(200),
    language: z.string().max(100),
    timeZone: z.string().max(100),
    viewport: z.string().max(100),
    screen: z.string().max(100),
    pixelRatio: z.number().finite().min(0.1).max(20),
    online: z.boolean(),
  }),
  errors: z
    .array(
      z.object({
        kind: z.enum(['console.error', 'error', 'unhandledrejection']),
        timestamp: z.string().datetime(),
        message: z.string().max(2000),
        stack: z.string().max(4000).optional(),
      })
    )
    .max(20),
  screenshot: z.object({
    status: feedbackScreenshotStatus,
    dataUrl: z
      .string()
      .max(2_800_000)
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/)
      .optional(),
  }),
})

export type FeedbackDiagnosticsInput = z.infer<typeof feedbackDiagnosticsSchema>
export type FeedbackDiagnostics = Omit<FeedbackDiagnosticsInput, 'screenshot'> & {
  screenshot: { status: z.infer<typeof feedbackScreenshotStatus>; url?: string }
}
