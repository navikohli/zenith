import { createHash } from 'node:crypto'
import { z } from 'zod'
import { ConflictError, ForbiddenError } from '@/lib/shared/errors'
import type { BoardAccess } from '@/lib/shared/db-types'

export function productAudience(access: BoardAccess, segmentId: string): BoardAccess {
  return {
    ...access,
    view: 'segments',
    vote: 'segments',
    comment: 'segments',
    submit: 'segments',
    segments: { view: [segmentId], vote: [segmentId], comment: [segmentId], submit: [segmentId] },
  }
}

export const digest = (value: unknown): string =>
  createHash('sha256').update(stableJson(value)).digest('hex')
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']'
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + stableJson(v))
        .join(',') +
      '}'
    )
  return JSON.stringify(value) ?? 'null'
}
export const commandSchema = z.object({
  command: z.string().min(1).max(200),
  args: z.array(z.string().max(500)).max(40),
})
export const planSchema = z.object({
  content: z.string().min(100).max(15000),
  decision: z.enum(['small-change', 'needs-human-design', 'decline']),
  testCommands: z.array(commandSchema).min(1).max(10),
})
export const reportSchema = z.object({
  content: z.string().min(50).max(15000),
  implementationSha: z.string().regex(/^[0-9a-f]{40}$/),
  repository: z.string().min(1),
  clean: z.literal(true),
  tests: z
    .array(
      commandSchema.extend({
        exitCode: z.number().int(),
        outputHash: z.string().regex(/^[0-9a-f]{64}$/),
      })
    )
    .min(1)
    .max(10),
})
export const deploymentSchema = z.object({
  eventId: z.string().min(1).max(200),
  repository: z.string().min(1),
  environment: z.string().min(1),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  artifact: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  planHash: z.string().regex(/^[0-9a-f]{64}$/),
  reportHash: z.string().regex(/^[0-9a-f]{64}$/),
  smoke: z.object({
    passed: z.literal(true),
    url: z.string().url(),
    observedSha: z.string().regex(/^[0-9a-f]{40}$/),
    checkedAt: z.string().datetime(),
  }),
})
export function requireRevision(actual: number, expected: number) {
  if (actual !== expected)
    throw new ConflictError('REVISION_MISMATCH', 'Work changed; read it again before updating')
}
export function requirePhase(phase: string, allowed: string[]) {
  if (!allowed.includes(phase))
    throw new ConflictError(
      'INVALID_PHASE',
      `Operation requires ${allowed.join(' or ')}; current phase is ${phase}`
    )
}
export function verifyTests(
  approved: z.infer<typeof commandSchema>[],
  tests: z.infer<typeof reportSchema>['tests']
) {
  if (digest(approved) !== digest(tests.map(({ command, args }) => ({ command, args }))))
    throw new ConflictError(
      'TEST_PLAN_MISMATCH',
      'Report must run the exact approved commands in order'
    )
  return tests.every((t) => t.exitCode === 0)
}
export function verifyDeployment(
  p: { repository: string; environment: string; appUrl: string },
  d: z.infer<typeof deploymentSchema>,
  state: { implementationSha?: string; acceptedHash?: string; reportHash?: string },
  now = Date.now()
) {
  if (
    d.repository !== p.repository ||
    d.environment !== p.environment ||
    d.sha !== state.implementationSha ||
    d.smoke.observedSha !== d.sha ||
    d.planHash !== state.acceptedHash ||
    d.reportHash !== state.reportHash ||
    new URL(d.smoke.url).origin !== new URL(p.appUrl).origin ||
    Math.abs(now - Date.parse(d.smoke.checkedAt)) > 300000
  )
    throw new ForbiddenError(
      'DEPLOYMENT_MISMATCH',
      'Deployment must match the product, approved plan, tested commit, environment and a recent successful smoke'
    )
}

export const productClaims = z.object({
  sub: z.string().min(1).max(200),
  email: z.string().email(),
  email_verified: z.literal(true),
  name: z.string().min(1).max(200),
  iss: z.string(),
  aud: z.string(),
  iat: z.number().int(),
  exp: z.number().int(),
  app_origin: z.string().url(),
})
export function validateProductClaims(
  claims: unknown,
  key: string,
  audience: string,
  parentOrigin: string,
  origins: string[],
  now = Math.floor(Date.now() / 1000)
) {
  const c = productClaims.parse(claims)
  if (
    c.iss !== key ||
    c.aud !== audience ||
    c.iat > now + 30 ||
    c.iat < now - 330 ||
    c.exp <= now ||
    c.exp <= c.iat ||
    c.exp - c.iat > 300 ||
    c.app_origin !== parentOrigin ||
    !origins.includes(parentOrigin)
  )
    throw new ForbiddenError('TOKEN_INVALID', 'Product, origin or token lifetime mismatch')
  return c
}
