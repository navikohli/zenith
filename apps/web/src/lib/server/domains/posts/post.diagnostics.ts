import { z } from 'zod'
import {
  feedbackDiagnosticsSchema,
  feedbackScreenshotStatus,
  type FeedbackDiagnosticsInput,
  type FeedbackDiagnostics,
} from '@/lib/shared/feedback-diagnostics'
import { uploadImageBuffer, getPublicUrlOrNull } from '@/lib/server/storage/s3'
import { sniffImageMime } from '@/lib/server/content/magic-bytes'
import { getBaseUrl } from '@/lib/server/config'

const KEY = '__zenithDiagnostics'
const storedSchema = feedbackDiagnosticsSchema.omit({ screenshot: true }).extend({
  screenshot: z.object({
    status: feedbackScreenshotStatus,
    key: z
      .string()
      .regex(/^feedback-diagnostics\/\d{4}\/\d{2}\/[a-zA-Z0-9.-]+\.jpeg$/)
      .optional(),
  }),
})

/** Called only after createPost has checked board access and quotas. */
export async function storeFeedbackDiagnostics(
  metadata?: Record<string, string>,
  input?: FeedbackDiagnosticsInput
): Promise<Record<string, string> | null> {
  const clean = { ...metadata }
  // A caller cannot make us sign arbitrary storage references through metadata.
  delete clean[KEY]
  if (!input) return Object.keys(clean).length ? clean : null
  const { screenshot, ...details } = input
  const stored: z.infer<typeof storedSchema> = {
    ...details,
    screenshot: { status: screenshot.status },
  }
  if (screenshot.status === 'captured') {
    stored.screenshot.status = 'failed'
    try {
      const bytes = Buffer.from(screenshot.dataUrl?.split(',')[1] ?? '', 'base64')
      if (
        bytes.length > 0 &&
        bytes.length <= 2 * 1024 * 1024 &&
        sniffImageMime(bytes) === 'image/jpeg'
      ) {
        const image = await uploadImageBuffer(bytes, 'image/jpeg', 'feedback-diagnostics')
        stored.screenshot = { status: 'captured', key: image.key }
      }
    } catch {
      /* Feedback still saves if storage is unavailable. */
    }
  }
  clean[KEY] = JSON.stringify(stored)
  return clean
}

/** Staff detail only. Public and widget reads do not call this. */
export function readFeedbackDiagnostics(metadata: Record<string, string> | null | undefined): {
  widgetMetadata: Record<string, string> | null
  diagnostics: FeedbackDiagnostics | null
} {
  const clean = { ...metadata }
  const raw = clean[KEY]
  delete clean[KEY]
  const result = {
    widgetMetadata: Object.keys(clean).length ? clean : null,
    diagnostics: null as FeedbackDiagnostics | null,
  }
  if (!raw || raw.length > 500_000) return result
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return result
    const { screenshot, ...details } = parsed.data
    const relativeUrl = screenshot.key ? getPublicUrlOrNull(screenshot.key) : null
    result.diagnostics = {
      ...details,
      screenshot: {
        status: screenshot.status,
        ...(relativeUrl ? { url: new URL(relativeUrl, getBaseUrl()).href } : {}),
      },
    }
  } catch {
    /* Invalid historical metadata cannot take down post detail. */
  }
  return result
}
