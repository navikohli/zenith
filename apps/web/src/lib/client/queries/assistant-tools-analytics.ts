import { queryOptions } from '@tanstack/react-query'
import { getZenithAssistantToolMetricsFn } from '@/lib/server/functions/assistant-tools-analytics'

/** Per-tool action counts (calls/success rate/latency) for a date range (ISO strings). */
export const zenithAssistantToolMetricsQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ['zenith-assistant-tool-metrics', from, to],
    queryFn: () => getZenithAssistantToolMetricsFn({ data: { from, to } }),
    staleTime: 5 * 60 * 1000,
  })
