import type { IntegrationCatalogEntry } from '@/lib/server/integrations/types'

export const zapierCatalog: IntegrationCatalogEntry = {
  id: 'zapier',
  name: 'Zapier',
  description: 'Connect Zenith to 6,000+ apps with Zapier automations.',
  category: 'automation',
  iconBg: 'bg-[#FF4A00]',
  settingsPath: '/admin/settings/integrations/zapier',
  available: true,
  configurable: false,
  docsUrl: '/source.html',
}
