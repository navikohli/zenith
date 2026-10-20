/**
 * Status mapping resolution.
 *
 * Maps external platform status names to Zenith StatusIds
 * using the statusMappings stored in integrations.config.
 */

import type { PostStatusId, TicketStatusId } from '@zenith/ids'

/**
 * Status mappings stored in integrations.config.statusMappings.
 * Key = external status name (case-sensitive as received from platform).
 * Value = Zenith PostStatusId or null (ignore this status).
 */
export type StatusMappings = Record<string, string | null>

/**
 * Resolve an external status name to a Zenith PostStatusId.
 * Returns null if no mapping exists or the mapping explicitly says to ignore.
 */
export function resolveStatusMapping(
  externalStatus: string,
  mappings: StatusMappings | undefined
): PostStatusId | null {
  if (!mappings) return null

  const mapped = mappings[externalStatus]
  if (mapped === undefined || mapped === null) return null

  return mapped as PostStatusId
}

/**
 * Resolve an external status name to a Zenith TicketStatusId, using the
 * ticketStatusMappings stored in integrations.config (the ticket-side sibling
 * of statusMappings — same shape, resolving to ticket_statuses ids).
 * Returns null if no mapping exists or the mapping explicitly says to ignore.
 */
export function resolveTicketStatusMapping(
  externalStatus: string,
  mappings: StatusMappings | undefined
): TicketStatusId | null {
  if (!mappings) return null

  const mapped = mappings[externalStatus]
  if (mapped === undefined || mapped === null) return null

  return mapped as TicketStatusId
}
