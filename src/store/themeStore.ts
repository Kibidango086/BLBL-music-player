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

function getInitialAccentHue(): number {
  if (typeof window === 'undefined') return 345
  try {
    const saved = localStorage.getItem('blbl-theme-storage')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (typeof parsed.state?.accentHue === 'number') return parsed.state.accentHue
    }
  } catch {}
  return 345
}

interface ThemeStore {
  isDark: boolean
  accentHue: number
  toggleDark: (e?: React.MouseEvent) => void
  setDark: (dark: boolean, origin?: { x: number; y: number }) => void
  setAccentHue: (hue: number) => void
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

function injectAccentCSS(hue: number) {
  let el = document.getElementById('accent-css') as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = 'accent-css'
    document.head.appendChild(el)
  }
  el.textContent = `
:root {
  --hue: ${hue};
  --primary:    oklch(0.68 0.16 var(--hue));
  --primary-fg: oklch(0.99 0 0);
  --ring:       oklch(0.6 0.16 var(--hue));
  --blob:       oklch(0.65 0.16 var(--hue) / 0.3);
}
.dark {
  --primary:    oklch(0.72 0.14 var(--hue));
  --ring:       oklch(0.65 0.14 var(--hue));
  --blob:       oklch(0.6 0.14 var(--hue) / 0.25);
}
`
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      isDark: getInitialDark(),
      accentHue: getInitialAccentHue(),
      toggleDark: (e) => {
        const origin = e ? { x: e.clientX, y: e.clientY } : undefined
        get().setDark(!get().isDark, origin)
      },
      setDark: (dark, origin) => {
        if (get().isDark === dark) return
        const update = () => {
          set({ isDark: dark })
          syncDOM(dark)
          // Re-inject accent CSS to ensure correct vars for new theme
          injectAccentCSS(get().accentHue)
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
      },
      setAccentHue: (hue) => {
        set({ accentHue: hue })
        injectAccentCSS(hue)
      }
    }),
    { name: 'blbl-theme-storage' }
  )
)
