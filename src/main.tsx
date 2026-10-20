import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { useThemeStore } from '@/store/themeStore'
import { initMediaProxy, installElectronAPI, initRendering } from '@/lib/mygo-bridge'

// The desktop API the components call, on top of the MyGo runtime and the Go
// services: installed before the first render, as the preload script was.
installElectronAPI()
// The pictures come from Go, which fetches them with bilibili's Referer, and
// whether the webview draws on the GPU decides how much the page may animate.
await initMediaProxy()
await initRendering()

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
