export type BrowserTab = {
  id: number
  windowId: number
  url: string
  title: string
  domain: string
  favIconUrl?: string
  active: boolean
  pinned: boolean
  status: 'creating' | 'loading' | 'ready' | 'closing' | 'closed' | 'error'
}

type ChromeTab = { id?: number; windowId?: number; url?: string; title?: string; favIconUrl?: string; active?: boolean; pinned?: boolean; status?: string }
type ChromeApi = { tabs?: { query: (query: object) => Promise<ChromeTab[]>; create: (options: object) => Promise<ChromeTab>; update: (id: number, options: object) => Promise<ChromeTab>; remove: (id: number) => Promise<void>; onActivated?: { addListener: (listener: (info: { tabId: number; windowId: number }) => void) => void }; onUpdated?: { addListener: (listener: (id: number, change: object, tab: ChromeTab) => void) => void }; onRemoved?: { addListener: (listener: (id: number) => void) => void } }; windows?: { update: (id: number, options: object) => Promise<unknown> } }

const chromeApi = () => (typeof window !== 'undefined' ? (window as unknown as { chrome?: ChromeApi }).chrome : undefined)
const toTab = (tab: ChromeTab): BrowserTab | null => {
  if (typeof tab.id !== 'number') return null
  let domain = 'New tab'
  try { domain = tab.url ? new URL(tab.url).hostname.replace(/^www\./, '') : domain } catch {}
  return { id: tab.id, windowId: tab.windowId ?? 0, url: tab.url ?? '', title: tab.title || domain, domain, favIconUrl: tab.favIconUrl, active: Boolean(tab.active), pinned: Boolean(tab.pinned), status: tab.status === 'loading' ? 'loading' : 'ready' }
}

export class BrowserTabManager {
  private listeners = new Set<(tabs: BrowserTab[]) => void>()
  private tabs: BrowserTab[] = []
  private bound = false
  subscribe(listener: (tabs: BrowserTab[]) => void) { this.listeners.add(listener); listener(this.tabs); this.bind(); return () => { this.listeners.delete(listener) } }
  private emit() { this.listeners.forEach(listener => listener(this.tabs)) }
  private bind() {
    if (this.bound) return
    const api = chromeApi(); if (!api?.tabs) return
    this.bound = true
    api.tabs.onActivated?.addListener(({ tabId }) => { this.tabs = this.tabs.map(tab => ({ ...tab, active: tab.id === tabId })); this.emit(); this.sync() })
    api.tabs.onUpdated?.addListener((id, _change, tab) => { const next = toTab({ ...tab, id }); if (!next) return; this.tabs = this.tabs.some(item => item.id === id) ? this.tabs.map(item => item.id === id ? next : item) : [...this.tabs, next]; this.emit() })
    api.tabs.onRemoved?.addListener(id => { this.tabs = this.tabs.filter(tab => tab.id !== id); this.emit() })
    this.sync()
  }
  async sync() { const api = chromeApi(); if (!api?.tabs) return this.tabs; const actual = (await api.tabs.query({})).map(toTab).filter(Boolean) as BrowserTab[]; this.tabs = actual; this.emit(); return actual }
  async create(url = 'https://www.google.com') { const api = chromeApi(); if (!api?.tabs) { window.open(url, '_blank', 'noopener,noreferrer'); return null } const created = await api.tabs.create({ url, active: true }); const tab = toTab({ ...created, status: 'loading' }); if (tab) { this.tabs = [...this.tabs.filter(item => item.id !== tab.id), tab]; this.emit() } return tab }
  async activate(id: number) { const api = chromeApi(); const tab = this.tabs.find(item => item.id === id); if (!api?.tabs || !tab) return; await api.tabs.update(id, { active: true }); if (api.windows) await api.windows.update(tab.windowId, { focused: true }) }
  async close(id: number) { const api = chromeApi(); if (!api?.tabs) return; this.tabs = this.tabs.map(tab => tab.id === id ? { ...tab, status: 'closing' } : tab); this.emit(); await api.tabs.remove(id) }
}

export const browserTabManager = new BrowserTabManager()
