import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  feedbackDiagnosticsSchema,
  type FeedbackDiagnosticsInput,
} from '@/lib/shared/feedback-diagnostics'
import { storeFeedbackDiagnostics, readFeedbackDiagnostics } from '../post.diagnostics'

const upload = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/storage/s3', () => ({
  uploadImageBuffer: upload,
  getPublicUrlOrNull: (key: string) => `/api/storage/${key}?read=test&exp=9999999999999`,
}))
vi.mock('@/lib/server/config', () => ({ getBaseUrl: () => 'https://zenith.example' }))
const sample: FeedbackDiagnosticsInput = {
  version: 1,
  capturedAt: '2026-10-20T05:00:00.000Z',
  page: { url: 'https://app.example/tasks', title: 'Tasks' },
  browser: {
    userAgent: 'Chrome',
    platform: 'Windows',
    language: 'en',
    timeZone: 'UTC',
    viewport: '1000x800',
    screen: '1920x1080',
    pixelRatio: 1,
    online: true,
  },
  errors: [{ kind: 'console.error', timestamp: '2026-10-20T05:00:00.000Z', message: 'failed' }],
  screenshot: { status: 'captured', dataUrl: `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString('base64')}` },
}
beforeEach(() => {
  upload
    .mockReset()
    .mockResolvedValue({
      key: 'feedback-diagnostics/2026/10/12345678-abcd-1234-abcd-123456789abc-rehost-123.jpeg',
    })
})

describe('stored feedback diagnostics', () => {
  it('stores an image privately and returns a staff read URL without raw image data', async () => {
    const metadata = await storeFeedbackDiagnostics({ productKey: 'orbit' }, sample)
    expect(upload).toHaveBeenCalledOnce()
    expect(JSON.stringify(metadata)).not.toContain('data:image')
    const detail = readFeedbackDiagnostics(metadata)
    expect(detail.widgetMetadata).toEqual({ productKey: 'orbit' })
    expect(detail.diagnostics?.screenshot.url).toMatch(
      /^https:\/\/zenith.example\/api\/storage\/feedback-diagnostics\//
    )
    expect(detail.diagnostics?.errors).toEqual(sample.errors)
  })
  it('strips caller-supplied reserved metadata and never signs unrelated storage keys', async () => {
    expect(
      await storeFeedbackDiagnostics({ __zenithDiagnostics: 'forged', productKey: 'orbit' })
    ).toEqual({ productKey: 'orbit' })
    expect(
      readFeedbackDiagnostics({
        __zenithDiagnostics: JSON.stringify({
          ...sample,
          screenshot: { status: 'captured', key: 'attachments/private.pdf' },
        }),
      }).diagnostics
    ).toBeNull()
  })
  it('preserves browser/errors if image upload fails', async () => {
    upload.mockRejectedValue(new Error('storage down'))
    const detail = readFeedbackDiagnostics(await storeFeedbackDiagnostics(undefined, sample))
    expect(detail.diagnostics?.screenshot.status).toBe('failed')
    expect(detail.diagnostics?.errors).toEqual(sample.errors)
  })
  it('does not upload files whose bytes do not match JPEG', async () => {
    const detail = readFeedbackDiagnostics(
      await storeFeedbackDiagnostics(undefined, {
        ...sample,
        screenshot: { status: 'captured', dataUrl: 'data:image/jpeg;base64,aGVsbG8=' },
      })
    )
    expect(upload).not.toHaveBeenCalled()
    expect(detail.diagnostics?.screenshot.status).toBe('failed')
  })
  it('rejects oversized images and too many errors at the intake boundary', () => {
    expect(
      feedbackDiagnosticsSchema.safeParse({
        ...sample,
        screenshot: { status: 'captured', dataUrl: 'x'.repeat(2_800_001) },
      }).success
    ).toBe(false)
    expect(
      feedbackDiagnosticsSchema.safeParse({ ...sample, errors: Array(21).fill(sample.errors[0]) })
        .success
    ).toBe(false)
  })
  it('accepts old submissions without diagnostics and ignores corrupt metadata', () => {
    expect(readFeedbackDiagnostics(null)).toEqual({ widgetMetadata: null, diagnostics: null })
    expect(readFeedbackDiagnostics({ __zenithDiagnostics: '{bad', route: '/tasks' })).toEqual({
      widgetMetadata: { route: '/tasks' },
      diagnostics: null,
    })
  })
})
