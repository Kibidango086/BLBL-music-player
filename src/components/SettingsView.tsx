import { useState } from 'react'
import { useUserStore } from '@/store/userStore'
import { useThemeStore } from '@/store/themeStore'
import { useProxyStore } from '@/store/proxyStore'
import { useToastStore } from '@/store/toastStore'
import { useI18nStore } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icon } from '@/components/ui/icon'
import { getHighResPic } from '@/lib/utils'

export function SettingsView() {
  const { loginStatus, setLoginStatus, setFavFolders, logout, isLoadingLogin, setLoadingLogin } = useUserStore()
  const { isDark, toggleDark, accentHue, setAccentHue } = useThemeStore()
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
      <div className="px-8 pt-8 pb-6" style={{ animation: 'fadeInDown 0.35s ease-out' }}>
        <h2 className="text-[32px] font-bold tracking-[-0.02em] text-foreground">
          {t('settings.title')}
        </h2>
      </div>

      <div className="px-8 pb-8 space-y-6 max-w-xl">
        {/* Appearance */}
        <div className="p-5 rounded-xl bg-card border border-border shadow">
          <h3 className="text-[16px] font-bold text-foreground tracking-[-0.02em]">
            {t('settings.appearance')}
          </h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-muted-foreground">
                {t('settings.themeLabel', { mode: themeLabel })}
              </span>
              <Button variant="outline" size="sm" onClick={(e) => toggleDark(e)}>
                <Icon name={isDark ? 'light_mode' : 'dark_mode'} size={16} />
                <span className="ml-2">{t('settings.themeSwitch')}</span>
              </Button>
            </div>

            {/* Accent Hue Selector */}
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-muted-foreground">主题色</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={accentHue}
                  onChange={(e) => setAccentHue(Number(e.target.value))}
                  className="w-28 h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, 
                      hsl(0, 80%, 60%), hsl(60, 80%, 60%), hsl(120, 80%, 60%), 
                      hsl(180, 80%, 60%), hsl(240, 80%, 60%), hsl(300, 80%, 60%), 
                      hsl(360, 80%, 60%))`
                  }}
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="360"
                    value={accentHue}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (!isNaN(v) && v >= 0 && v <= 360) setAccentHue(v)
                    }}
                    className="w-14 h-7 text-center text-[13px] rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-[13px] text-muted-foreground">°</span>
                </div>
                <div
                  className="w-6 h-6 rounded-full border-2 border-border flex-shrink-0"
                  style={{ backgroundColor: `oklch(0.68 0.16 ${accentHue})` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="p-5 rounded-xl bg-card border border-border shadow">
          <h3 className="text-[16px] font-bold text-foreground tracking-[-0.02em]">
            {t('settings.language')}
          </h3>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setLocale('zh-CN')}
              className={`px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                locale === 'zh-CN'
                  ? 'bg-secondary text-foreground font-medium border border-border'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {t('settings.langZhCN')}
            </button>
            <button
              onClick={() => setLocale('zh-TW')}
              className={`px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                locale === 'zh-TW'
                  ? 'bg-secondary text-foreground font-medium border border-border'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {t('settings.langZhTW')}
            </button>
          </div>
        </div>

        {/* Account */}
        <div className="p-5 rounded-xl bg-card border border-border shadow">
          <h3 className="text-[16px] font-bold text-foreground tracking-[-0.02em]">
            {t('settings.account')}
          </h3>
          {loginStatus?.isLogin ? (
            <div className="mt-4 flex items-center gap-3">
              {loginStatus.face ? (
                <img src={getHighResPic(loginStatus.face)} alt="avatar" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                  <Icon name="person" size={20} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-[14px] font-medium text-foreground">{loginStatus.uname}</p>
                <p className="text-[12px] text-muted-foreground">UID: {loginStatus.mid}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <Icon name="logout" size={14} />
                <span className="ml-2">{t('nav.logout')}</span>
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {!cookieMode ? (
                <div className="space-y-3">
                  <p className="text-[13px] text-muted-foreground">{t('settings.loginHint')}</p>
                  <div className="flex gap-3">
                    <Button onClick={handleLoginWindow} disabled={isLoadingLogin}>
                      <Icon name="language" size={16} />
                      <span className="ml-2">{isLoadingLogin ? '...' : t('settings.windowLogin')}</span>
                    </Button>
                    <Button variant="outline" onClick={() => setCookieMode(true)}>
                      <Icon name="cookie" size={16} />
                      <span className="ml-2">{t('settings.cookieLogin')}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3" style={{ animation: 'fadeInDown 0.2s ease-out' }}>
                  <div className="space-y-2">
                    <p className="text-[13px] text-muted-foreground">{t('settings.cookieGuide')}</p>
                    <div className="space-y-2">
                      <Input placeholder={t('settings.sessdata')} value={sessdata} onChange={(e) => setSessdata(e.target.value)} className="text-[13px]" />
                      <Input placeholder={t('settings.biliJct')} value={biliJct} onChange={(e) => setBiliJct(e.target.value)} className="text-[13px]" />
                    </div>
                  </div>
                  {cookieResult && (
                    <div className={`flex items-center gap-2 text-[13px] ${cookieResult.success ? 'text-green-600' : 'text-red-500'}`}>
                      <Icon name={cookieResult.success ? 'check_circle' : 'error'} size={16} />
                      {cookieResult.message}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button onClick={handleCookieLogin} disabled={isLoadingLogin || !sessdata.trim()}>
                      <Icon name="login" size={16} />
                      <span className="ml-2">{isLoadingLogin ? t('settings.verifying') : t('settings.confirmLogin')}</span>
                    </Button>
                    <Button variant="ghost" onClick={() => { setCookieMode(false); setCookieResult(null); setSessdata(''); setBiliJct('') }}>
                      {t('settings.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Proxy */}
        <div className="p-5 rounded-xl bg-card border border-border shadow">
          <h3 className="text-[16px] font-bold text-foreground tracking-[-0.02em]">
            {t('settings.proxy')}
          </h3>
          <p className="text-[13px] text-muted-foreground mt-1">{t('settings.proxyDesc')}</p>
          <div className="mt-4 space-y-2">
            <Input
              placeholder={t('settings.proxyPlaceholder')}
              value={proxyRules}
              onChange={(e) => setProxyRules(e.target.value)}
              className="text-[13px]"
            />
            <div className="flex gap-2">
              <Input
                placeholder={t('settings.proxyUser')}
                value={proxyUsername}
                onChange={(e) => setProxyCredentials(e.target.value, proxyPassword)}
                className="flex-1 text-[13px]"
              />
              <Input
                type="password"
                placeholder={t('settings.proxyPass')}
                value={proxyPassword}
                onChange={(e) => setProxyCredentials(proxyUsername, e.target.value)}
                className="flex-1 text-[13px]"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setProxyRules(''); setProxyCredentials('', '') }} disabled={!proxyRules && !proxyUsername}>
              {t('settings.proxyClear')}
            </Button>
          </div>
        </div>

        {/* Data Management */}
        <div className="p-5 rounded-xl bg-card border border-border shadow">
          <h3 className="text-[16px] font-bold text-foreground tracking-[-0.02em]">
            {t('settings.dataManagement')}
          </h3>
          <p className="text-[13px] text-muted-foreground mt-1">{t('settings.clearDesc')}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => {
            logout()
            // Clear after state flush so zustand persist doesn't re-write
            setTimeout(() => {
              ['blbl-player-storage', 'blbl-proxy-storage', 'blbl-theme-storage', 'blbl-locale-storage', 'blbl-user-storage']
                .forEach(key => localStorage.removeItem(key))
              window.location.reload()
            }, 50)
          }}>
            <Icon name="delete" size={14} />
            <span className="ml-2">{t('settings.clearAll')}</span>
          </Button>
        </div>

        {/* About */}
        <div className="p-5 rounded-xl bg-card border border-border shadow">
          <h3 className="text-[16px] font-bold text-foreground tracking-[-0.02em]">
            {t('settings.about')}
          </h3>
          <p className="text-[13px] text-muted-foreground mt-1">{t('settings.version')}</p>
          <p className="text-[12px] text-muted-foreground mt-2">{t('settings.techStack')}</p>
        </div>

        {/* Disclaimer */}
        <div className="p-5 rounded-xl bg-card border border-border shadow">
          <h3 className="text-[16px] font-bold text-foreground tracking-[-0.02em]">
            声明
          </h3>
          <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
            @Kibidango086<br />
            使用本软件与作者无关。<br />
            平台内容归属 Bilibili 公司所有。
          </p>
        </div>
      </div>
    </div>
  )
}
