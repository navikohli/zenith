import { queryOptions } from '@tanstack/react-query'
import { getZenithAssistantPerformanceFn } from '@/lib/server/functions/assistant-analytics'

/** ZenithAssistant performance (involvement/resolution/escalation) for a date range (ISO strings). */
export const zenithAssistantPerformanceQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ['zenith-assistant-performance', from, to],
    queryFn: () => getZenithAssistantPerformanceFn({ data: { from, to } }),
    staleTime: 5 * 60 * 1000,
  })
