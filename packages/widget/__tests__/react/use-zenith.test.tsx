import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useZenith } from '../../src/react/use-zenith'
import Zenith from '../../src'

describe('useZenith', () => {
  it('returns the Zenith singleton', () => {
    const { result } = renderHook(() => useZenith())
    expect(result.current).toBe(Zenith)
    expect(typeof result.current.open).toBe('function')
    expect(typeof result.current.identify).toBe('function')
  })
})
