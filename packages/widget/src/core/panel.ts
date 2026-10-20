import { ensureStyles } from './style'

export interface PanelOptions {
  /** Widget URL — e.g. "https://feedback.acme.com/widget". */
  widgetUrl: string
  placement: 'left' | 'right'
  defaultBoard?: string
  showCloseButton?: boolean
  locale?: string
  onBackdropClick: () => void
}

export interface PanelHandle {
  iframe: HTMLIFrameElement
  show(): void
  hide(): void
  /** Grow/shrink the panel for long-form content (transitioned via CSS). */
  setExpanded(expanded: boolean): void
  /** Move the panel between bottom corners (rewrites the side-specific CSS). */
  setPlacement(side: 'left' | 'right'): void
  destroy(): void
}

/** The frame's accessible name, in the visitor's language where known. */
const FRAME_TITLE: Record<string, string> = {
  ar: 'مساعدة',
  de: 'Hilfe',
  es: 'Ayuda',
  fr: 'Aide',
  pl: 'Pomoc',
  pt: 'Ajuda',
  ru: 'Помощь',
  uk: 'Допомога',
  zh: '帮助',
  'zh-tw': '說明',
}

function frameTitle(locale: string | undefined): string {
  const tag = (locale ?? '').toLowerCase()
  return FRAME_TITLE[tag] ?? FRAME_TITLE[tag.split('-')[0]!] ?? 'Help'
}

export function createPanel(opts: PanelOptions): PanelHandle {
  ensureStyles(opts.placement)

  const params: string[] = []
  if (opts.defaultBoard) params.push(`board=${encodeURIComponent(opts.defaultBoard)}`)
  if (opts.showCloseButton) params.push('showClose=1')
  if (opts.locale) params.push(`locale=${encodeURIComponent(opts.locale)}`)
  const url = opts.widgetUrl + (params.length ? '?' + params.join('&') : '')

  const backdrop = document.createElement('div')
  backdrop.className = 'zenith-backdrop'
  backdrop.addEventListener('click', opts.onBackdropClick)
  document.body.appendChild(backdrop)

  const panel = document.createElement('div')
  panel.className = 'zenith-panel zenith-widget-iframe-wrapper'
  // Closed, the panel is only transparent: inert keeps its frame out of the
  // host page's tab order and the accessibility tree until it opens.
  panel.inert = true
  document.body.appendChild(panel)

  const iframe = document.createElement('iframe')
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
    colorScheme: 'normal',
  })
  iframe.setAttribute('src', url)
  iframe.setAttribute('title', frameTitle(opts.locale))
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-forms allow-same-origin allow-popups allow-downloads'
  )
  iframe.setAttribute('allow', 'clipboard-write')
  iframe.className = 'zenith-widget-iframe'
  panel.appendChild(iframe)

  let open = false

  return {
    iframe,
    show() {
      if (open) return
      open = true
      panel.inert = false
      panel.classList.remove('zenith-closing')
      backdrop.classList.remove('zenith-closing')
      void panel.offsetHeight // force reflow
      panel.classList.add('zenith-open')
      backdrop.classList.add('zenith-open')
    },
    hide() {
      if (!open) return
      open = false
      panel.inert = true
      panel.classList.remove('zenith-open')
      panel.classList.add('zenith-closing')
      backdrop.classList.remove('zenith-open')
      backdrop.classList.add('zenith-closing')
      setTimeout(() => {
        panel.classList.remove('zenith-closing')
        backdrop.classList.remove('zenith-closing')
      }, 300)
    },
    setExpanded(expanded) {
      panel.classList.toggle('zenith-expanded', expanded)
    },
    setPlacement(side) {
      ensureStyles(side)
    },
    destroy() {
      panel.remove()
      backdrop.remove()
    },
  }
}
