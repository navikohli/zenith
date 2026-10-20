// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { CloudZenithWidget } from '../cloud-zenith-widget'

afterEach(cleanup)

it('does not install a hosted support widget on the local fork', () => {
  const scripts = document.querySelectorAll('script').length
  render(<CloudZenithWidget />)
  expect(document.querySelectorAll('script')).toHaveLength(scripts)
  expect(window.Zenith).toBeUndefined()
})
