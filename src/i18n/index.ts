import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import zhCN from './zh-CN'
import zhTW from './zh-TW'

const dicts: Record<string, Record<string, string>> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW
}

function detectLocale(): 'zh-CN' | 'zh-TW' {
  const saved = localStorage.getItem('blbl-locale-storage')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.state?.locale) return parsed.state.locale
    } catch {}
  }
  const lang = navigator.language || (navigator as any).userLanguage || 'zh-CN'
  if (lang.startsWith('zh-HK') || lang.startsWith('zh-MO') || lang.startsWith('zh-TW')) return 'zh-TW'
  if (lang.startsWith('zh')) return 'zh-CN'
  return 'zh-CN'
}

interface I18nStore {
  locale: 'zh-CN' | 'zh-TW'
  setLocale: (locale: 'zh-CN' | 'zh-TW') => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set, get) => ({
      locale: detectLocale(),
      setLocale: (locale) => set({ locale }),
      t: (key: string, vars?: Record<string, string | number>) => {
        const dict = dicts[get().locale] || zhCN
        let text = dict[key] || key
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
          }
        }
        return text
      }
    }),
    { name: 'blbl-locale-storage' }
  )
)
