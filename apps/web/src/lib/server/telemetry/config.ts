// Zenith does not send instance telemetry to an upstream project.
export const TELEMETRY_POSTHOG_HOST = ''
export const TELEMETRY_POSTHOG_KEY = ''

export function isTelemetryEnabled(): boolean {
  return false
}
