import { useState, useEffect } from 'react'
import { Icon } from '@/components/ui/icon'
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
      className="h-9 flex items-center justify-between flex-shrink-0 bg-card backdrop-blur-[12px] border-b border-border z-50 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {isMac ? (
        <>
          <div className="w-[80px] flex-shrink-0" />
          <span className="text-[13px] font-medium text-muted-foreground">
            {t('app.name')}
          </span>
          <div className="w-[80px] flex-shrink-0" />
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 px-4">
            {/* Theme-adaptive app icon — simplified icon.svg */}
            <svg width="18" height="18" viewBox="0 0 1024 1024" fill="var(--primary)" opacity="0.85">
              <rect x="60" y="60" width="904" height="904" rx="196" fill="var(--primary)" opacity="0.25"/>
              <path d="M 296,348 C 266,348 248,370 248,402 L 248,612 C 248,642 270,656 296,656 L 728,656 C 754,656 776,642 776,612 L 776,402 C 776,370 758,348 728,348 Z M 296,350 L 240,176 L 388,332 Z M 728,350 L 784,176 L 636,332 Z"/>
            </svg>
            <span className="text-[13px] font-medium text-foreground">
              {t('app.name')}
            </span>
          </div>
          <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={() => window.electronAPI.minimize()}
              className="h-full px-4 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Minimize"
            >
              <Icon name="horizontal_rule" size={14} />
            </button>
            <button
              onClick={() => window.electronAPI.maximize()}
              className="h-full px-4 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Maximize"
            >
              <Icon name="check_box_outline_blank" size={12} />
            </button>
            <button
              onClick={() => window.electronAPI.close()}
              className="h-full px-4 flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-fg transition-colors"
              title="Close"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
