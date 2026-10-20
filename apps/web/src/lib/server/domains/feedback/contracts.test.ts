import { describe, expect, it } from 'vitest'
import {
  digest,
  requireRevision,
  requirePhase,
  verifyTests,
  verifyDeployment,
  deploymentSchema,
  planSchema,
  validateProductClaims,
} from './contracts'

describe('feedback approval and deployment contracts', () => {
  const command = { command: 'node', args: ['--test', 'tests/tasks.test.mjs'] }
  const sha = 'a'.repeat(40),
    planHash = 'b'.repeat(64),
    reportHash = 'c'.repeat(64)
  const product = {
    repository: 'local:orbit-tasks',
    environment: 'local',
    appUrl: 'http://127.0.0.1:3200',
  }
  const state = { implementationSha: sha, acceptedHash: planHash, reportHash }
  const receipt = () => ({
    eventId: 'test-run',
    repository: product.repository,
    environment: 'local',
    sha,
    artifact: 'sha256:' + 'd'.repeat(64),
    planHash,
    reportHash,
    smoke: {
      passed: true as const,
      url: product.appUrl + '/api/health',
      observedSha: sha,
      checkedAt: new Date().toISOString(),
    },
  })
  it('hashes evidence independent of object key ordering but preserves command order', () => {
    expect(digest({ b: 2, a: { c: 3, b: 4 } })).toBe(digest({ a: { b: 4, c: 3 }, b: 2 }))
    expect(digest([1, 2])).not.toBe(digest([2, 1]))
  })
  it('rejects stale writes and implementation before approval', () => {
    expect(() => requireRevision(2, 1)).toThrow('Work changed')
    expect(() => requirePhase('planned', ['approved'])).toThrow('current phase')
  })
  it('requires meaningful plans and tests', () => {
    expect(
      planSchema.safeParse({ content: 'just fix it', decision: 'small-change', testCommands: [] })
        .success
    ).toBe(false)
  })
  it('validates product, audience, parent origin and explicit verified email', () => {
    const now = 10000,
      origin = 'http://127.0.0.1:3200'
    const claims = {
      sub: 'maya',
      email: 'maya@orbit.example',
      email_verified: true,
      name: 'Maya',
      iss: 'orbit-tasks',
      aud: 'http://localhost:3100',
      app_origin: origin,
      iat: now,
      exp: now + 300,
    }
    const check = (patch: object, parent = origin) =>
      validateProductClaims(
        { ...claims, ...patch },
        'orbit-tasks',
        'http://localhost:3100',
        parent,
        [origin],
        now
      )
    expect(() => check({})).not.toThrow()
    for (const patch of [
      { iss: 'other' },
      { aud: 'other' },
      { exp: now + 301 },
      { exp: now - 1 },
      { iat: now + 31 },
      { iat: '10000' },
      { email_verified: false },
      { app_origin: 'https://evil.example' },
    ])
      expect(() => check(patch)).toThrow()
    expect(() => check({}, 'https://evil.example')).toThrow()
  })
  it('accepts exact passing tests, keeps failed tests non-ready, refuses substitutions', () => {
    const run = { ...command, exitCode: 0, outputHash: '0'.repeat(64) }
    expect(verifyTests([command], [run])).toBe(true)
    expect(verifyTests([command], [{ ...run, exitCode: 1 }])).toBe(false)
    expect(() => verifyTests([command], [{ ...run, args: ['-e', 'console.log("pass")'] }])).toThrow(
      'exact approved'
    )
  })
  it('accepts a fresh matching immutable deployment', () => {
    expect(() => verifyDeployment(product, deploymentSchema.parse(receipt()), state)).not.toThrow()
  })
  for (const [name, patch] of Object.entries({
    environment: { environment: 'production' },
    repository: { repository: 'other' },
    commit: { sha: 'f'.repeat(40) },
    plan: { planHash: 'e'.repeat(64) },
    report: { reportHash: 'e'.repeat(64) },
  })) {
    it(`rejects mismatched ${name}`, () =>
      expect(() => verifyDeployment(product, { ...receipt(), ...patch }, state)).toThrow(
        'Deployment must match'
      ))
  }
  it('rejects a different observed build, old smoke and a different product URL', () => {
    for (const patch of [
      { observedSha: 'e'.repeat(40) },
      { checkedAt: '2020-01-01T00:00:00.000Z' },
      { url: 'http://another-product.test/health' },
    ])
      expect(() =>
        verifyDeployment(product, { ...receipt(), smoke: { ...receipt().smoke, ...patch } }, state)
      ).toThrow()
  })
  it('rejects failed smoke and mutable artifact tags at the boundary', () => {
    expect(
      deploymentSchema.safeParse({ ...receipt(), smoke: { ...receipt().smoke, passed: false } })
        .success
    ).toBe(false)
    expect(deploymentSchema.safeParse({ ...receipt(), artifact: 'latest' }).success).toBe(false)
  })
})
