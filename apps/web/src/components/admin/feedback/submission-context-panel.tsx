const labels: Record<string, string> = {
  pageUrl: 'Page URL',
  productName: 'Product',
  productKey: 'Product ID',
  selectedTaskTitle: 'Selected task',
  selectedTaskId: 'Task ID',
  environment: 'Environment',
  appVersion: 'App version',
  route: 'Page route',
  viewport: 'Screen size',
  view: 'Current view',
  taskFilter: 'Task filter',
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Staff-only: app metadata may contain private page URLs or record details. */
export function SubmissionContextPanel({ metadata }: { metadata?: Record<string, string> | null }) {
  const entries = Object.entries(metadata ?? {}).filter(([, value]) => value.trim() !== '')
  const keys = Object.keys(labels)
  entries.sort(([a], [b]) => {
    const rank = (key: string) => (keys.includes(key) ? keys.indexOf(key) : keys.length)
    return rank(a) - rank(b) || a.localeCompare(b)
  })

  return (
    <section
      aria-label="Submission context"
      className="mt-6 rounded-lg border border-border bg-muted/20 p-4"
    >
      <h3 className="text-sm font-medium">Submission context</h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No page context was attached to this submission.
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className={key === 'pageUrl' ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
                <dt className="text-xs text-muted-foreground">
                  {Object.hasOwn(labels, key)
                    ? labels[key]
                    : key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ')}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                  {key === 'pageUrl' && isWebUrl(value) ? (
                    <a
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            App-supplied details attached to this submission.
          </p>
        </>
      )}
    </section>
  )
}
