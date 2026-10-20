// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SubmissionContextPanel } from '../submission-context-panel'

afterEach(cleanup)

describe('SubmissionContextPanel', () => {
  it('shows the supplied page, task and product context with a usable page link', () => {
    render(
      <SubmissionContextPanel
        metadata={{
          selectedTaskId: 'task-101',
          selectedTaskTitle: 'Review the onboarding flow',
          productName: 'Orbit Tasks',
          pageUrl: 'http://127.0.0.1:3200/tasks/task-101',
          appVersion: '0.1.0',
          viewport: '525x591',
        }}
      />
    )
    expect(screen.getByRole('region', { name: 'Submission context' })).toBeVisible()
    expect(screen.getByText('Review the onboarding flow')).toBeVisible()
    expect(screen.getByText('Orbit Tasks')).toBeVisible()
    expect(screen.getByText('525x591')).toBeVisible()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'http://127.0.0.1:3200/tasks/task-101')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it.each([null, undefined, {}, { pageUrl: '  ' }])(
    'explains when no context was attached: %j',
    (metadata) => {
      render(<SubmissionContextPanel metadata={metadata} />)
      expect(screen.getByText('No page context was attached to this submission.')).toBeVisible()
      expect(screen.queryByRole('link')).toBeNull()
    }
  )

  it('renders additional app fields as text and does not turn unsafe URLs into links', () => {
    const text = '<img src=x onerror=alert(1)>'
    const { container } = render(
      <SubmissionContextPanel
        metadata={{
          pageUrl: 'javascript:alert(1)',
          customerPlan: text,
        }}
      />
    )
    expect(screen.getByText('javascript:alert(1)')).toBeVisible()
    expect(screen.getByText('customer Plan')).toBeVisible()
    expect(screen.getByText(text)).toBeVisible()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
