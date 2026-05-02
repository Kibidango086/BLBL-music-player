import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const saved = localStorage.getItem('blbl-theme-storage')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (typeof parsed.state?.isDark === 'boolean') return parsed.state.isDark
    }
  } catch {}
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
}

interface ThemeStore {
  isDark: boolean
  toggleDark: (e?: React.MouseEvent) => void
  setDark: (dark: boolean, origin?: { x: number; y: number }) => void
}

function syncDOM(dark: boolean) {
  if (dark) document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
}

function setVTCursor(x: number, y: number) {
  const root = document.documentElement
  root.style.setProperty('--vt-origin-x', `${x}px`)
  root.style.setProperty('--vt-origin-y', `${y}px`)
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      isDark: getInitialDark(),
      toggleDark: (e) => {
        const origin = e ? { x: e.clientX, y: e.clientY } : undefined
        get().setDark(!get().isDark, origin)
      },
      setDark: (dark, origin) => {
        if (get().isDark === dark) return
        const update = () => {
          set({ isDark: dark })
          syncDOM(dark)
        }
        if (typeof document !== 'undefined' && 'startViewTransition' in document) {
          const doc = document as any
          if (origin) setVTCursor(origin.x, origin.y)
          doc.startViewTransition(() => {
            update()
          })
        } else {
          update()
        }
      }
    }),
    { name: 'blbl-theme-storage' }
  )
)
