import { describe, expect, it } from 'vitest'
import { isCanonicalIdentityHost } from '@/lib/server/functions/origin-transfer'

describe('origin transfer host binding', () => {
  it('accepts only the projected canonical hostname', () => {
    expect(isCanonicalIdentityHost('new.zenith.co.uk', 'https://new.zenith.co.uk')).toBe(true)
    expect(isCanonicalIdentityHost('new.zenith.co.uk:443', 'https://new.zenith.co.uk')).toBe(
      true
    )
    expect(isCanonicalIdentityHost('old.zenith.co.uk', 'https://new.zenith.co.uk')).toBe(
      false
    )
    expect(isCanonicalIdentityHost(null, 'https://new.zenith.co.uk')).toBe(false)
  })
})
