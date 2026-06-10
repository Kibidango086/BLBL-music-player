import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { useThemeStore } from '@/store/themeStore'

function Root() {
  const { isDark, accentHue } = useThemeStore()

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [isDark])

  // Inject accent CSS on mount and when accent hue changes
  useEffect(() => {
    let el = document.getElementById('accent-css') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'accent-css'
      document.head.appendChild(el)
    }
    el.textContent = `
:root {
  --hue: ${accentHue};
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
  }, [accentHue])

  useEffect(() => {
    // Mount animation complete — body is already visible via CSS defaults
  }, [])

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
