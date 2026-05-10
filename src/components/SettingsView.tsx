import { useState } from 'react'
import { useUserStore } from '@/store/userStore'
import { useThemeStore } from '@/store/themeStore'
import { useProxyStore } from '@/store/proxyStore'
import { useToastStore } from '@/store/toastStore'
import { useI18nStore } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogIn, LogOut, User, Trash2, Cookie, Globe, AlertCircle, CheckCircle, Sun, Moon } from 'lucide-react'
import { getHighResPic } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export function SettingsView() {
  const { loginStatus, setLoginStatus, setFavFolders, logout, isLoadingLogin, setLoadingLogin } = useUserStore()
  const { isDark, toggleDark } = useThemeStore()
  const { proxyRules, setProxyRules, proxyUsername, setProxyCredentials, proxyPassword } = useProxyStore()
  const { showToast } = useToastStore()
  const { locale, setLocale, t } = useI18nStore()
  const [cookieMode, setCookieMode] = useState(false)
  const [sessdata, setSessdata] = useState('')
  const [biliJct, setBiliJct] = useState('')
  const [cookieResult, setCookieResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleLoginWindow = async () => {
    setLoadingLogin(true)
    try {
      const result = await window.electronAPI.biliOpenLogin()
      if (result.success) {
        const status = await window.electronAPI.biliLoginStatus()
        setLoginStatus(status)
        if (status.isLogin && status.mid) {
          const folders = await window.electronAPI.biliFavFolders(status.mid)
          setFavFolders(folders)
        }
      }
    } catch (err) {
      console.error('Login failed:', err)
    } finally {
      setLoadingLogin(false)
    }
  }

  const handleCookieLogin = async () => {
    if (!sessdata.trim()) return
    setLoadingLogin(true)
    setCookieResult(null)
    try {
      const cookies: { name: string; value: string }[] = [
        { name: 'SESSDATA', value: sessdata.trim() }
      ]
      if (biliJct.trim()) {
        cookies.push({ name: 'bili_jct', value: biliJct.trim() })
      }
      const result = await window.electronAPI.biliSetCookies(cookies)
      if (result.success && result.status) {
        setLoginStatus(result.status)
        setCookieResult({ success: true, message: `${t('settings.confirmLogin')} ${result.status.uname}` })
        showToast(`登录成功：${result.status.uname}`, 'success')
        if (result.status.mid) {
          const folders = await window.electronAPI.biliFavFolders(result.status.mid)
          setFavFolders(folders)
        }
      } else {
        const msg = result.error || 'Cookie 无效或已过期'
        setCookieResult({ success: false, message: msg })
        showToast(msg, 'error')
      }
    } catch (err: any) {
      setCookieResult({ success: false, message: err?.message || '设置失败' })
    } finally {
      setLoadingLogin(false)
    }
  }

  const handleLogout = () => {
    logout()
    window.location.reload()
  }

  const themeLabel = isDark ? t('nav.darkMode') : t('nav.lightMode')

  return (
    <div className="flex flex-col h-full">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="px-8 pt-8 pb-6">
        <h2 className="text-[32px] font-semibold tracking-[-1.28px] text-vercel-black dark:text-[#ededed]">
          {t('settings.title')}
        </h2>
      </motion.div>

      <div className="px-8 pb-8 space-y-6 max-w-xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }} className="p-5 rounded-lg bg-white dark:bg-[#0a0a0a] shadow-border">
          <h3 className="text-[16px] font-semibold text-vercel-black dark:text-[#ededed] tracking-[-0.32px]">
            {t('settings.appearance')}
          </h3>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[14px] text-vercel-gray-600 dark:text-[#808080]">
              {t('settings.themeLabel', { mode: themeLabel })}
            </span>
            <Button variant="outline" size="sm" onClick={(e) => toggleDark(e)}>
              {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
              {t('settings.themeSwitch')}
            </Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }} className="p-5 rounded-lg bg-white dark:bg-[#0a0a0a] shadow-border">
          <h3 className="text-[16px] font-semibold text-vercel-black dark:text-[#ededed] tracking-[-0.32px]">
            {t('settings.language')}
          </h3>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setLocale('zh-CN')}
              className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                locale === 'zh-CN'
                  ? 'bg-vercel-gray-50 dark:bg-[#141414] text-vercel-black dark:text-[#ededed] font-medium shadow-border'
                  : 'text-vercel-gray-500 dark:text-[#808080] hover:bg-vercel-gray-50 dark:hover:bg-[#141414]'
              }`}
            >
              {t('settings.langZhCN')}
            </button>
            <button
              onClick={() => setLocale('zh-TW')}
              className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                locale === 'zh-TW'
                  ? 'bg-vercel-gray-50 dark:bg-[#141414] text-vercel-black dark:text-[#ededed] font-medium shadow-border'
                  : 'text-vercel-gray-500 dark:text-[#808080] hover:bg-vercel-gray-50 dark:hover:bg-[#141414]'
              }`}
            >
              {t('settings.langZhTW')}
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }} className="p-5 rounded-lg bg-white dark:bg-[#0a0a0a] shadow-border">
          <h3 className="text-[16px] font-semibold text-vercel-black dark:text-[#ededed] tracking-[-0.32px]">
            {t('settings.account')}
          </h3>
          {loginStatus?.isLogin ? (
            <div className="mt-4 flex items-center gap-3">
              {loginStatus.face ? (
                <img src={getHighResPic(loginStatus.face)} alt="avatar" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-vercel-gray-100 dark:bg-[#1f1f1f] flex items-center justify-center">
                  <User className="w-5 h-5 text-vercel-gray-400 dark:text-[#666666]" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-[14px] font-medium text-vercel-black dark:text-[#ededed]">{loginStatus.uname}</p>
                <p className="text-[12px] text-vercel-gray-500 dark:text-[#808080]">UID: {loginStatus.mid}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-3.5 h-3.5 mr-2" />
                {t('nav.logout')}
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {!cookieMode ? (
                <div className="space-y-3">
                  <p className="text-[13px] text-vercel-gray-500 dark:text-[#808080]">{t('settings.loginHint')}</p>
                  <div className="flex gap-3">
                    <Button onClick={handleLoginWindow} disabled={isLoadingLogin}>
                      <Globe className="w-4 h-4 mr-2" />
                      {isLoadingLogin ? '...' : t('settings.windowLogin')}
                    </Button>
                    <Button variant="outline" onClick={() => setCookieMode(true)}>
                      <Cookie className="w-4 h-4 mr-2" />
                      {t('settings.cookieLogin')}
                    </Button>
                  </div>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-[13px] text-vercel-gray-500 dark:text-[#808080]">{t('settings.cookieGuide')}</p>
                    <div className="space-y-2">
                      <Input placeholder={t('settings.sessdata')} value={sessdata} onChange={(e) => setSessdata(e.target.value)} className="text-[13px] dark:bg-[#141414] dark:text-[#ededed]" />
                      <Input placeholder={t('settings.biliJct')} value={biliJct} onChange={(e) => setBiliJct(e.target.value)} className="text-[13px] dark:bg-[#141414] dark:text-[#ededed]" />
                    </div>
                  </div>
                  <AnimatePresence>
                    {cookieResult && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`flex items-center gap-2 text-[13px] ${cookieResult.success ? 'text-green-600' : 'text-red-500'}`}>
                        {cookieResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {cookieResult.message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex gap-3">
                    <Button onClick={handleCookieLogin} disabled={isLoadingLogin || !sessdata.trim()}>
                      <LogIn className="w-4 h-4 mr-2" />
                      {isLoadingLogin ? t('settings.verifying') : t('settings.confirmLogin')}
                    </Button>
                    <Button variant="ghost" onClick={() => { setCookieMode(false); setCookieResult(null); setSessdata(''); setBiliJct('') }}>
                      {t('settings.cancel')}
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }} className="p-5 rounded-lg bg-white dark:bg-[#0a0a0a] shadow-border">
          <h3 className="text-[16px] font-semibold text-vercel-black dark:text-[#ededed] tracking-[-0.32px]">
            {t('settings.proxy')}
          </h3>
          <p className="text-[13px] text-vercel-gray-500 dark:text-[#808080] mt-1">{t('settings.proxyDesc')}</p>
          <div className="mt-4 space-y-2">
            <Input
              placeholder={t('settings.proxyPlaceholder')}
              value={proxyRules}
              onChange={(e) => setProxyRules(e.target.value)}
              className="text-[13px] dark:bg-[#141414] dark:text-[#ededed]"
            />
            <div className="flex gap-2">
              <Input
                placeholder={t('settings.proxyUser')}
                value={proxyUsername}
                onChange={(e) => setProxyCredentials(e.target.value, proxyPassword)}
                className="flex-1 text-[13px] dark:bg-[#141414] dark:text-[#ededed]"
              />
              <Input
                type="password"
                placeholder={t('settings.proxyPass')}
                value={proxyPassword}
                onChange={(e) => setProxyCredentials(proxyUsername, e.target.value)}
                className="flex-1 text-[13px] dark:bg-[#141414] dark:text-[#ededed]"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setProxyRules(''); setProxyCredentials('', '') }} disabled={!proxyRules && !proxyUsername}>
              {t('settings.proxyClear')}
            </Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }} className="p-5 rounded-lg bg-white dark:bg-[#0a0a0a] shadow-border">
          <h3 className="text-[16px] font-semibold text-vercel-black dark:text-[#ededed] tracking-[-0.32px]">
            {t('settings.dataManagement')}
          </h3>
          <p className="text-[13px] text-vercel-gray-500 dark:text-[#808080] mt-1">{t('settings.clearDesc')}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => {
            const storageKeys = ['blbl-player-storage', 'blbl-proxy-storage', 'blbl-theme-storage', 'blbl-locale-storage', 'blbl-user-storage', 'blbl-user-storage']
            storageKeys.forEach(key => localStorage.removeItem(key))
            logout()
            showToast('所有数据已清除', 'info')
            setTimeout(() => window.location.reload(), 600)
          }}>
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            {t('settings.clearAll')}
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.3 }} className="p-5 rounded-lg bg-white dark:bg-[#0a0a0a] shadow-border">
          <h3 className="text-[16px] font-semibold text-vercel-black dark:text-[#ededed] tracking-[-0.32px]">
            {t('settings.about')}
          </h3>
          <p className="text-[13px] text-vercel-gray-500 dark:text-[#808080] mt-1">{t('settings.version')}</p>
          <p className="text-[12px] text-vercel-gray-400 dark:text-[#666666] mt-2">{t('settings.techStack')}</p>
          <p className="text-[12px] text-vercel-gray-400 dark:text-[#666666] mt-1">{t('settings.design')}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.35 }} className="p-5 rounded-lg bg-white dark:bg-[#0a0a0a] shadow-border">
          <h3 className="text-[16px] font-semibold text-vercel-black dark:text-[#ededed] tracking-[-0.32px]">
            声明
          </h3>
          <p className="text-[12px] text-vercel-gray-500 dark:text-[#808080] mt-2 leading-relaxed">
            @Kibidango086<br />
            使用本软件与作者无关。<br />
            平台内容归属 Bilibili 公司所有。
          </p>
        </motion.div>
      </div>
    </div>
  )
}
