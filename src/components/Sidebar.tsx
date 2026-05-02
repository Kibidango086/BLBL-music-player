import { useState, useEffect } from 'react'
import { Search, ListMusic, Settings, LogIn, LogOut, FolderHeart, ChevronDown, ChevronRight, Sun, Moon } from 'lucide-react'
import { cn, getHighResPic } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { useUserStore } from '@/store/userStore'
import { useThemeStore } from '@/store/themeStore'
import { useI18nStore } from '@/i18n'
import { motion, AnimatePresence } from 'framer-motion'

type View = 'search' | 'playlist' | 'settings' | 'favorites'

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  activeFavId: number | null
  onFavSelect: (id: number, name: string) => void
}

const topNavViews: View[] = ['search', 'playlist']

const viewIcon: Record<View, React.ElementType> = {
  search: Search,
  playlist: ListMusic,
  settings: Settings,
  favorites: FolderHeart
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

  const handleLogin = () => {
    onViewChange('settings')
  }

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
    <aside className="w-60 flex flex-col bg-white dark:bg-[#0a0a0a] border-r border-vercel-gray-100 dark:border-[#1f1f1f] flex-shrink-0">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-[20px] font-semibold tracking-[-0.96px] text-vercel-black dark:text-[#ededed]">
          {t('app.name')}
        </h1>
        <p className="text-[12px] text-vercel-gray-500 dark:text-[#666666] mt-1 font-mono uppercase tracking-normal">
          {t('app.subtitle')}
        </p>
      </div>

      <Separator className="dark:bg-[#1f1f1f]" />

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {topNavViews.map((view) => {
          const isActive = currentView === view
          const Icon = viewIcon[view]
          return (
            <motion.button
              key={view}
              onClick={() => onViewChange(view)}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-[14px] font-medium transition-colors',
                isActive
                  ? 'bg-vercel-gray-50 dark:bg-[#141414] text-vercel-black dark:text-[#ededed] font-semibold'
                  : 'text-vercel-gray-600 dark:text-[#808080] hover:bg-vercel-gray-50 dark:hover:bg-[#141414] hover:text-vercel-black dark:hover:text-[#ededed]'
              )}
            >
              <Icon className="w-4 h-4" />
              {navLabel[view]}
            </motion.button>
          )
        })}

        {loginStatus?.isLogin && favFolders.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setFavExpanded(!favExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-semibold text-vercel-gray-500 dark:text-[#666666] uppercase tracking-wide"
            >
              <span className="flex items-center gap-2">
                <FolderHeart className="w-3.5 h-3.5" />
                {t('nav.favorites')}
              </span>
              {favExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            <AnimatePresence>
              {favExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {favFolders.map((folder) => (
                    <motion.button
                      key={folder.id}
                      onClick={() => onFavSelect(folder.id, folder.title)}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors min-w-0',
                        activeFavId === folder.id && currentView === 'favorites'
                          ? 'bg-vercel-gray-50 dark:bg-[#141414] text-vercel-black dark:text-[#ededed] font-medium'
                          : 'text-vercel-gray-500 dark:text-[#666666] hover:bg-vercel-gray-50 dark:hover:bg-[#141414] hover:text-vercel-black dark:hover:text-[#ededed]'
                      )}
                    >
                      <span className="truncate flex-1 min-w-0 text-left">{folder.title}</span>
                      <span className="text-[10px] text-vercel-gray-400 dark:text-[#555555] flex-shrink-0">
                        {folder.media_count}
                      </span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>

      <Separator className="dark:bg-[#1f1f1f]" />

      <div className="px-5 py-4 space-y-2">
        {loginStatus?.isLogin ? (
          <div className="flex items-center gap-2 px-3 py-2">
            {loginStatus.face ? (
              <img src={getHighResPic(loginStatus.face)} alt="avatar" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-vercel-gray-100 dark:bg-[#1f1f1f]" />
            )}
            <span className="text-[13px] text-vercel-black dark:text-[#ededed] truncate flex-1">{loginStatus.uname}</span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md hover:bg-vercel-gray-50 dark:hover:bg-[#141414] text-vercel-gray-400 dark:text-[#666666] hover:text-vercel-black dark:hover:text-[#ededed] transition-colors"
              title={t('nav.logout')}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin}
            disabled={isLoadingLogin}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[14px] font-medium text-vercel-gray-600 dark:text-[#808080] hover:bg-vercel-gray-50 dark:hover:bg-[#141414] hover:text-vercel-black dark:hover:text-[#ededed] transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {isLoadingLogin ? '...' : t('nav.login')}
          </motion.button>
        )}

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onViewChange('settings')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-[14px] font-medium transition-colors',
            currentView === 'settings'
              ? 'bg-vercel-gray-50 dark:bg-[#141414] text-vercel-black dark:text-[#ededed] font-semibold'
              : 'text-vercel-gray-600 dark:text-[#808080] hover:bg-vercel-gray-50 dark:hover:bg-[#141414] hover:text-vercel-black dark:hover:text-[#ededed]'
          )}
        >
          <Settings className="w-4 h-4" />
          {t('nav.settings')}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={(e) => toggleDark(e)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[14px] font-medium text-vercel-gray-600 dark:text-[#808080] hover:bg-vercel-gray-50 dark:hover:bg-[#141414] hover:text-vercel-black dark:hover:text-[#ededed] transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? t('nav.lightMode') : t('nav.darkMode')}
        </motion.button>
      </div>
    </aside>
  )
}
