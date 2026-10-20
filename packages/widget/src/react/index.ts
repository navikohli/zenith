export { useZenithInit } from './use-init'
export type { UseZenithInitOptions } from './use-init'
export { useZenith } from './use-zenith'
export { useZenithEvent } from './use-event'

// Re-export the singleton + types so users can import everything from one subpath.
export { default as Zenith } from '../index'
export type {
  InitOptions,
  Identity,
  OpenOptions,
  WidgetUser,
  EventName,
  EventMap,
  EventHandler,
  Unsubscribe,
} from '../types'
