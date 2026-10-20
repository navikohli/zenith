// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { FeedbackDiagnostics } from '@/lib/shared/feedback-diagnostics'
import { FeedbackDiagnosticsPanel } from '../feedback-diagnostics-panel'

afterEach(cleanup)
const sample: FeedbackDiagnostics = {
  version: 1,
  capturedAt: '2026-10-20T05:00:00.000Z',
  page: { title: 'Task details', url: 'https://orbit.example/tasks/1' },
  browser: {
    userAgent: 'Chrome test',
    platform: 'Windows',
    language: 'en',
    timeZone: 'UTC',
    viewport: '1000x800',
    screen: '1920x1080',
    pixelRatio: 1,
    online: true,
  },
  errors: [
    {
      kind: 'console.error',
      timestamp: '2026-10-20T05:00:00.000Z',
      message: '<img src=x onerror=alert(1)>',
      stack: 'safe stack',
    },
  ],
  screenshot: {
    status: 'captured',
    url: 'https://zenith.example/api/storage/feedback-diagnostics/test.jpeg?read=test',
  },
}
describe('FeedbackDiagnosticsPanel', () => {
  it('shows the screenshot, browser context and errors as text', () => {
    render(<FeedbackDiagnosticsPanel diagnostics={sample} />)
    expect(screen.getByRole('region', { name: 'Browser diagnostics' })).toBeVisible()
    expect(screen.getByRole('img')).toHaveAttribute('src', sample.screenshot.url)
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('Chrome test')).toBeVisible()
    expect(screen.getByText('Recent errors (1)')).toBeVisible()
    expect(screen.getByText(/console.error: <img/)).toBeVisible()
    expect(document.querySelectorAll('img')).toHaveLength(1)
  })
  it('shows useful browser context even when a screenshot is unavailable', () => {
    render(
      <FeedbackDiagnosticsPanel
        diagnostics={{ ...sample, screenshot: { status: 'failed' }, errors: [] }}
      />
    )
    expect(screen.getByText(/Screenshot unavailable/)).toBeVisible()
    expect(screen.getByText(/No errors recorded/)).toBeVisible()
    expect(screen.queryByRole('img')).toBeNull()
  })
  it('does not invent diagnostics for old feedback', () => {
    render(<FeedbackDiagnosticsPanel diagnostics={null} />)
    expect(screen.queryByRole('region')).toBeNull()
  })
})
