import Zenith from '../index'

/**
 * Returns the Zenith singleton. Equivalent to importing it directly —
 * exists for React-idiomatic usage.
 */
export function useZenith(): typeof Zenith {
  return Zenith
}
