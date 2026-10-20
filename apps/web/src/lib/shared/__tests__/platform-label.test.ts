import { describe, expect, it } from 'vitest'
import {
  friendlyPlatformLabel,
  hostnameRegistrableSuffix,
  isGeneratedSystemLabel,
  platformLabelFromHostname,
  platformUrlSuffix,
} from '../platform-label'

describe('platform-label', () => {
  it('takes the first hostname label', () => {
    expect(platformLabelFromHostname('awesome.zenith.co.uk')).toBe('awesome')
  })

  it('recognizes provisioned system labels and full hosts', () => {
    expect(isGeneratedSystemLabel('ws-4a048e07941c5e7840e986c0')).toBe(true)
    expect(isGeneratedSystemLabel('ws-4a048e07941c5e7840e986c0.zenith.co.uk')).toBe(true)
    expect(isGeneratedSystemLabel('awesome')).toBe(false)
    expect(isGeneratedSystemLabel('ws-team')).toBe(false)
  })

  it('does not treat a generated system host as a friendly URL', () => {
    expect(friendlyPlatformLabel('ws-4a048e07941c5e7840e986c0.zenith.co.uk')).toBe('')
    expect(friendlyPlatformLabel('awesome.zenith.co.uk')).toBe('awesome')
    expect(friendlyPlatformLabel(null)).toBe('')
  })

  it('strips the first label for the registrable suffix', () => {
    expect(hostnameRegistrableSuffix('awesome.zenith.co.uk')).toBe('zenith.co.uk')
    expect(hostnameRegistrableSuffix('acme.zenith.io')).toBe('zenith.io')
  })

  it('takes the URL-field suffix from the platform host, not a custom-primary origin', () => {
    expect(
      platformUrlSuffix({
        platformHostname: 'acme.zenith.co.uk',
        canonicalOrigin: 'https://feedback.example.com',
      })
    ).toBe('zenith.co.uk')
  })

  it('falls back to the canonical host when no platform hostname is chosen yet', () => {
    expect(
      platformUrlSuffix({
        platformHostname: null,
        canonicalOrigin: 'https://ws-4a048e07941c5e7840e986c0.zenith.co.uk',
      })
    ).toBe('zenith.co.uk')
  })
})
