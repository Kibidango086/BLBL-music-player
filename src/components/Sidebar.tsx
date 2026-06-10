import { useState, useEffect } from 'react'
import { cn, getHighResPic } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Icon } from '@/components/ui/icon'
import { useUserStore } from '@/store/userStore'
import { useThemeStore } from '@/store/themeStore'
import { useI18nStore } from '@/i18n'

type View = 'search' | 'playlist' | 'settings' | 'favorites'

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  activeFavId: number | null
  onFavSelect: (id: number, name: string) => void
}

const topNavViews: View[] = ['search', 'playlist']

const viewIcon: Record<View, string> = {
  search: 'search',
  playlist: 'queue_music',
  settings: 'settings',
  favorites: 'folder_special'
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-[14px] font-medium transition-colors active:scale-[0.98]',
        active
          ? 'bg-accent text-foreground font-semibold'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon name={icon} size={18} />
      {label}
    </button>
  )
}

export function Sidebar({ currentView, onViewChange, activeFavId, onFavSelect }: SidebarProps) {
  const { loginStatus, favFolders, setLoginStatus, setFavFolders, logout, isLoadingLogin } = useUserStore()
  const { isDark, toggleDark } = useThemeStore()
  const { t } = useI18nStore()
  const [favExpanded, setFavExpanded] = useState(true)

  useEffect(() => {
    checkLogin()
  }, [])

  const checkLogin = async () => {
    try {
      const status = await window.electronAPI.biliLoginStatus()
      setLoginStatus(status)
      if (status.isLogin && status.mid) {
        const folders = await window.electronAPI.biliFavFolders(status.mid)
        setFavFolders(folders)
      }
    } catch (err) {
      console.error('Login check failed:', err)
    }
  }

  const handleLogin = () => onViewChange('settings')

  const handleLogout = () => {
    logout()
    window.location.reload()
  }

  const navLabel: Record<string, string> = {
    search: t('nav.search'),
    playlist: t('nav.playlist'),
    settings: t('nav.settings')
  }

  return (
    <aside className="w-60 flex flex-col gap-2.5 p-3 h-full flex-shrink-0 overflow-hidden">
      {/* Card 1 — Branding */}
      <div className="bg-card border border-border rounded-[14px] p-4 backdrop-blur-sm shadow flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          {/* Theme-adaptive app icon — simplified icon.svg */}
          <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: `oklch(0.68 0.16 var(--hue) / 0.12)` }}>
            <svg width="18" height="18" viewBox="0 0 1024 1024" fill="var(--primary)">
              <rect x="60" y="60" width="904" height="904" rx="196" fill="var(--primary)" opacity="0.3"/>
              <path d="M 512,348 L 296,348 C 266,348 248,370 248,402 L 248,612 C 248,642 270,656 296,656 L 728,656 C 754,656 776,642 776,612 L 776,402 C 776,370 758,348 728,348 Z" fill="var(--primary)" opacity="0.85"/>
              {/* Cat ears */}
              <path d="M 296,350 L 240,176 L 388,332 Z" fill="var(--primary)" opacity="0.85"/>
              <path d="M 728,350 L 784,176 L 636,332 Z" fill="var(--primary)" opacity="0.85"/>
              {/* Wave */}
              <rect x="444" y="460" width="16" height="24" rx="3" fill="var(--primary)" opacity="0.5"/>
              <rect x="468" y="444" width="16" height="56" rx="3" fill="var(--primary)" opacity="0.5"/>
              <rect x="492" y="428" width="16" height="88" rx="3" fill="var(--primary)" opacity="0.5"/>
              <rect x="516" y="444" width="16" height="56" rx="3" fill="var(--primary)" opacity="0.5"/>
              <rect x="540" y="460" width="16" height="24" rx="3" fill="var(--primary)" opacity="0.5"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-foreground leading-tight truncate">
              {t('app.name')}
            </h1>
          </div>
        </div>
        <div className="bg-primary h-[3px] w-7 rounded-full mb-2" />
        <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wide">
          {t('app.subtitle')}
        </p>
      </div>

      {/* Card 2 — Navigation (fills space) */}
      <div className="bg-card border border-border rounded-[14px] p-3 backdrop-blur-sm shadow flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0">
        {topNavViews.map((view) => (
          <NavItem
            key={view}
            active={currentView === view}
            icon={viewIcon[view]}
            label={navLabel[view]}
            onClick={() => onViewChange(view)}
          />
        ))}

        {/* Favorites */}
        {loginStatus?.isLogin && favFolders.length > 0 && (
          <div className="mt-1">
            <button
              onClick={() => setFavExpanded(!favExpanded)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide"
            >
              <span className="flex items-center gap-2">
                <Icon name="folder_special" size={14} />
                {t('nav.favorites')}
              </span>
              <span
                className="material-symbols-rounded text-[18px] transition-transform duration-300"
                style={{ transform: favExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                expand_more
              </span>
            </button>
            <div
              className="overflow-hidden transition-[max-height] duration-300 ease-out"
              style={{ maxHeight: favExpanded ? `${favFolders.length * 32 + 8}px` : '0px' }}
            >
              <div className="flex flex-col gap-0.5">
                {favFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => onFavSelect(folder.id, folder.title)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1 rounded-[8px] text-[13px] transition-colors active:scale-[0.98] min-w-0',
                      activeFavId === folder.id && currentView === 'favorites'
                        ? 'bg-accent text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <span className="truncate flex-1 min-w-0 text-left">{folder.title}</span>
                    <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                      {folder.media_count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card 3 — User & Settings */}
      <div className="bg-card border border-border rounded-[14px] p-3 backdrop-blur-sm shadow flex flex-col gap-0.5">
        <NavItem
          active={currentView === 'settings'}
          icon="settings"
          label={t('nav.settings')}
          onClick={() => onViewChange('settings')}
        />

        {/* Theme toggle */}
        <button
          onClick={(e) => toggleDark(e)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-[14px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors active:scale-[0.98]"
        >
          <Icon name={isDark ? 'light_mode' : 'dark_mode'} size={18} />
          {isDark ? t('nav.lightMode') : t('nav.darkMode')}
        </button>

        <Separator />

        {/* User section */}
        {loginStatus?.isLogin ? (
          <div className="flex items-center gap-2 px-2 py-1.5">
            {loginStatus.face ? (
              <img src={getHighResPic(loginStatus.face)} alt="avatar" className="w-7 h-7 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-accent flex-shrink-0" />
            )}
            <span className="text-[13px] text-foreground truncate flex-1">{loginStatus.uname}</span>
            <button
              onClick={handleLogout}
              className="p-1 rounded-[8px] hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title={t('nav.logout')}
            >
              <Icon name="logout" size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={isLoadingLogin}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-[14px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors active:scale-[0.98]"
          >
            <Icon name="login" size={18} />
            {isLoadingLogin ? '...' : t('nav.login')}
          </button>
        )}
      </div>
    </aside>
  )
}
