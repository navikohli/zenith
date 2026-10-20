import { useEffect } from 'react'
import Zenith from '../index'
import type { EventName, EventHandler } from '../types'

/**
 * Subscribe to a widget event for the component's lifetime. The handler
 * fires synchronously when the event is emitted.
 */
export function useZenithEvent<T extends EventName>(name: T, handler: EventHandler<T>): void {
  useEffect(() => {
    const unsub = Zenith.on(name, handler)
    return unsub
  }, [name, handler])
}
