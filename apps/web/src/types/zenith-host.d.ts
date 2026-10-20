export {}

type ZenithHostFn = ((...args: unknown[]) => void) & { q?: unknown[] }

declare global {
  interface Window {
    /** Host stub + SDK after the Cloud dogfood snippet loads. */
    Zenith?: ZenithHostFn
  }
}
