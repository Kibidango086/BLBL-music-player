import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { useThemeStore } from '@/store/themeStore'

function Root() {
  const { isDark } = useThemeStore()

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [isDark])

  useEffect(() => {
    requestAnimationFrame(() => {
      document.documentElement.style.opacity = '1'
    })
  }, [])

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
