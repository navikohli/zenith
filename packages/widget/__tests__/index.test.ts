import { describe, it, expect } from 'vitest'
import Zenith, { type InitOptions } from '../src'

describe('public API', () => {
  it('exports the expected surface', () => {
    expect(typeof Zenith.init).toBe('function')
    expect(typeof Zenith.identify).toBe('function')
    expect(typeof Zenith.logout).toBe('function')
    expect(typeof Zenith.open).toBe('function')
    expect(typeof Zenith.close).toBe('function')
    expect(typeof Zenith.showLauncher).toBe('function')
    expect(typeof Zenith.hideLauncher).toBe('function')
    expect(typeof Zenith.isOpen).toBe('function')
    expect(typeof Zenith.getUser).toBe('function')
    expect(typeof Zenith.isIdentified).toBe('function')
    expect(typeof Zenith.on).toBe('function')
    expect(typeof Zenith.off).toBe('function')
    expect(typeof Zenith.metadata).toBe('function')
    expect(typeof Zenith.destroy).toBe('function')
    expect(typeof Zenith.version).toBe('string')
  })

  it('init throws when instanceUrl is missing', () => {
    expect(() => Zenith.init({} as InitOptions)).toThrow(/instanceUrl/)
  })
})
