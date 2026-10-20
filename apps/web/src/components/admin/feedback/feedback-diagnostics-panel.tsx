import type { FeedbackDiagnostics } from '@/lib/shared/feedback-diagnostics'

export function FeedbackDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics?: FeedbackDiagnostics | null
}) {
  if (!diagnostics) return null
  const { browser, screenshot, errors } = diagnostics
  return (
    <section
      aria-label="Browser diagnostics"
      className="mt-4 rounded-lg border border-border bg-muted/20 p-4"
    >
      <h3 className="text-sm font-medium">Browser diagnostics</h3>
      <p className="mt-1 break-words text-xs text-muted-foreground">
        {diagnostics.page.title} · {diagnostics.capturedAt}
      </p>
      {screenshot.url ? (
        <a href={screenshot.url} target="_blank" rel="noopener noreferrer" className="mt-3 block">
          <img
            src={screenshot.url}
            alt="Application page when feedback was submitted"
            className="max-h-80 w-full rounded border border-border object-contain"
            loading="lazy"
          />
          <span className="mt-1 block text-xs text-primary underline">Open screenshot</span>
        </a>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Screenshot {screenshot.status === 'disabled' ? 'disabled' : 'unavailable'}. Browser
          details and any recorded errors are shown below.
        </p>
      )}
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Page at submission</dt>
          <dd className="break-words [overflow-wrap:anywhere]">{diagnostics.page.url}</dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Browser / user agent</dt>
          <dd className="break-words">{browser.userAgent}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Platform</dt>
          <dd>{browser.platform}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Language / timezone</dt>
          <dd>
            {browser.language} / {browser.timeZone}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Viewport / screen</dt>
          <dd>
            {browser.viewport} / {browser.screen}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Pixel ratio / connection</dt>
          <dd>
            {browser.pixelRatio} / {browser.online ? 'Online' : 'Offline'}
          </dd>
        </div>
      </dl>
      <h4 className="mt-4 text-sm font-medium">Recent errors ({errors.length})</h4>
      {errors.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          No errors recorded since the widget started (last five minutes).
        </p>
      ) : (
        <div className="mt-2 max-h-72 space-y-2 overflow-auto">
          {errors.map((error, index) => (
            <details key={index} className="rounded border border-border p-2 text-xs">
              <summary className="cursor-pointer whitespace-pre-wrap break-words">
                {error.kind}: {error.message}
              </summary>
              <p className="mt-1 text-muted-foreground">{error.timestamp}</p>
              {error.stack && (
                <pre className="mt-2 whitespace-pre-wrap break-words">{error.stack}</pre>
              )}
            </details>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Captured from the app at submission. Up to 20 recent errors; common credentials are
        redacted. Visible to the team.
      </p>
    </section>
  )
}
