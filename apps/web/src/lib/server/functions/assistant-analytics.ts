/**
 * ZenithAssistant performance server function:
 * involvement, resolution, and escalation rates over a date range, for the
 * automation/assistant page. Read-only, gated on analytics.view like the rest
 * of the analytics surface.
 */
import { createServerFn } from '@tanstack/react-start'
import { getZenithAssistantPerformance } from '@/lib/server/domains/analytics/zenith-assistant-performance'
import { requireAuth } from './auth-helpers'
import { PERMISSIONS } from '@/lib/shared/permissions'
import { dateRangeSchema } from '@/lib/shared/schemas'

export const getZenithAssistantPerformanceFn = createServerFn({ method: 'GET' })
  .validator(dateRangeSchema)
  .handler(async ({ data }) => {
    await requireAuth({ permission: PERMISSIONS.ANALYTICS_VIEW })
    return getZenithAssistantPerformance(new Date(data.from), new Date(data.to))
  })
