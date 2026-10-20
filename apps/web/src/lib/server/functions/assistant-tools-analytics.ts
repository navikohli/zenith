/** Action metrics server function for the ZenithAssistant performance area. */
import { createServerFn } from '@tanstack/react-start'
import { getZenithAssistantToolMetrics } from '@/lib/server/domains/analytics/zenith-assistant-tools'
import { requireAuth } from './auth-helpers'
import { PERMISSIONS } from '@/lib/shared/permissions'
import { dateRangeSchema } from '@/lib/shared/schemas'

export const getZenithAssistantToolMetricsFn = createServerFn({ method: 'GET' })
  .validator(dateRangeSchema)
  .handler(async ({ data }) => {
    await requireAuth({ permission: PERMISSIONS.ANALYTICS_VIEW })
    return getZenithAssistantToolMetrics(new Date(data.from), new Date(data.to))
  })
