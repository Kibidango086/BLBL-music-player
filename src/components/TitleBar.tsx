import { useState, useEffect } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useI18nStore } from '@/i18n'

export function TitleBar() {
  const { t } = useI18nStore()
  const [platform, setPlatform] = useState<string>('win32')

  useEffect(() => {
    setPlatform(window.electronAPI.platform)
  }, [])

  const isMac = platform === 'darwin'

  return (
    <div
      className="h-9 flex items-center justify-between flex-shrink-0 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur border-b border-vercel-gray-100 dark:border-[#1f1f1f] z-50 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {isMac ? (
        <>
          <div className="w-[80px] flex-shrink-0" />
          <span className="text-[13px] font-medium text-vercel-gray-600 dark:text-[#808080]">
            {t('app.name')}
          </span>
          <div className="w-[80px] flex-shrink-0" />
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 px-4">
            <span className="text-[13px] font-medium text-vercel-gray-900 dark:text-[#ededed]">
              {t('app.name')}
            </span>
          </div>
          <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={() => window.electronAPI.minimize()}
              className="h-full px-4 flex items-center justify-center text-vercel-gray-500 dark:text-[#808080] hover:bg-vercel-gray-100 dark:hover:bg-[#1f1f1f] transition-colors"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => window.electronAPI.maximize()}
              className="h-full px-4 flex items-center justify-center text-vercel-gray-500 dark:text-[#808080] hover:bg-vercel-gray-100 dark:hover:bg-[#1f1f1f] transition-colors"
              title="Maximize"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={() => window.electronAPI.close()}
              className="h-full px-4 flex items-center justify-center text-vercel-gray-500 dark:text-[#808080] hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
