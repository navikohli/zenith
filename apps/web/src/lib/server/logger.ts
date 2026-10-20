/**
 * Web app logger — thin wrapper over the shared @zenith/logger package.
 *
 * The package owns the implementation (pino, redaction, the OpenTelemetry
 * trace-context mixin, and the AsyncLocalStorage request context). This wrapper
 * binds `service_name` from the process role so a worker replica is not
 * ingested as "zenith-web". Because the context lives in the shared
 * package, logs from @zenith/db and @zenith/email emitted within a
 * request inherit the same request_id/workspace_key automatically.
 *
 * Server-only: the Vite config aliases this module to logger.client-stub.ts for
 * the client environment so pino + node:async_hooks never enter the browser.
 *
 * Usage:
 *   import { logger } from '@/lib/server/logger'
 *   logger.info({ post_id }, 'post created')
 *   const log = logger.child({ component: 'feedback' })
 */
import {
  createLogger as createBaseLogger,
  type CreateLoggerOptions,
  type LogLevel,
} from '@zenith/logger'

export type { CreateLoggerOptions, LogLevel }

/**
 * Log-store identity for this process.
 *
 * Read from the environment rather than `getProcessRole()`: process-role
 * imports this module, so going the other way is a cycle. Trim matches the
 * role parser; case is not folded. `OTEL_SERVICE_NAME` wins when an operator
 * sets one. `all` (self-host default) and unrecognised values stay
 * `zenith-web` — the closed direction, same as the role fallback.
 */
export function serviceNameForProcess(env: NodeJS.ProcessEnv = process.env): string {
  const otel = env.OTEL_SERVICE_NAME?.trim()
  if (otel) return otel
  switch (env.ZENITH_ROLE?.trim()) {
    case 'worker':
      return 'zenith-worker'
    case 'migrator':
      return 'zenith-migrator'
    default:
      return 'zenith-web'
  }
}

/** Build a logger bound to this service. Tests inject a destination here. */
export function createLogger(options: CreateLoggerOptions = {}) {
  return createBaseLogger({
    ...options,
    base: { service_name: serviceNameForProcess(), ...options.base },
  })
}

/** Shared application logger. Level comes from config (LOG_LEVEL). */
export const logger = createLogger()
