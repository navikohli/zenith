import { createServerFn } from '@tanstack/react-start'

export function isNewerVersion(current: string, latest: string): boolean {
  const [cMajor, cMinor, cPatch] = current.split('.').map(Number)
  const [lMajor, lMinor, lPatch] = latest.split('.').map(Number)
  if (lMajor !== cMajor) return lMajor > cMajor
  if (lMinor !== cMinor) return lMinor > cMinor
  return lPatch > cPatch
}

export interface LatestVersionResult {
  version: string
  releaseUrl: string
}

// Zenith has no published release feed yet. Do not offer upstream updates to this fork.
export const getLatestVersion = createServerFn({ method: 'GET' }).handler(
  async (): Promise<LatestVersionResult | null> => null
)
