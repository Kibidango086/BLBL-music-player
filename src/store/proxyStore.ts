import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProxyStore {
  proxyRules: string
  proxyUsername: string
  proxyPassword: string
  setProxyRules: (rules: string) => void
  setProxyCredentials: (username: string, password: string) => void
  applyProxy: () => Promise<void>
}

export const useProxyStore = create<ProxyStore>()(
  persist(
    (set, get) => ({
      proxyRules: '',
      proxyUsername: '',
      proxyPassword: '',
      setProxyRules: (rules) => {
        set({ proxyRules: rules })
        get().applyProxy()
      },
      setProxyCredentials: (username, password) => {
        set({ proxyUsername: username, proxyPassword: password })
        get().applyProxy()
      },
      applyProxy: async () => {
        try {
          const { proxyRules, proxyUsername, proxyPassword } = get()
          await window.electronAPI.setProxy({
            rules: proxyRules,
            username: proxyUsername || undefined,
            password: proxyPassword || undefined
          })
        } catch (err) {
          console.error('Failed to apply proxy:', err)
        }
      }
    }),
    { name: 'blbl-proxy-storage' }
  )
)
