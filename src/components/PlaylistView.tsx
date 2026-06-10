import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { VideoCard } from '@/components/ui/video-card'
import { Icon } from '@/components/ui/icon'
import { usePlayerStore } from '@/store/playerStore'
import { useUserStore } from '@/store/userStore'
import { useToastStore } from '@/store/toastStore'
import { useI18nStore } from '@/i18n'
import { getHighResPic } from '@/lib/utils'
import type { PlaylistItem } from '@/types'

interface PlaylistViewProps {
  onPlay: (video: PlaylistItem) => void
}

export function PlaylistView({ onPlay }: PlaylistViewProps) {
  const { playlist, currentTrack, removeFromPlaylist, clearPlaylist } = usePlayerStore()
  const { loginStatus, setFavFolders } = useUserStore()
  const { showToast } = useToastStore()
  const { t } = useI18nStore()
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [savePrivacy, setSavePrivacy] = useState(0)
  const [saveLoading, setSaveLoading] = useState(false)
const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSaveToFav = async () => {
    if (!saveTitle.trim() || playlist.length === 0) return
    setSaveLoading(true)
    setSaveResult(null)
    try {
      const folderData = await window.electronAPI.biliCreateFav(saveTitle.trim(), '', savePrivacy)
      const mediaId = folderData?.id
      if (!mediaId) throw new Error('创建收藏夹失败')

      await window.electronAPI.biliAddToFav(playlist.map((v) => v.aid).filter((a): a is number => !!a), mediaId)

      setSaveResult({ success: true, message: t('playlist.saveSuccess') })
      showToast(t('playlist.saveSuccess'), 'success')

      // Refresh sidebar fav folders
      if (loginStatus?.mid) {
        try {
          const folders = await window.electronAPI.biliFavFolders(loginStatus.mid)
          setFavFolders(folders)
        } catch (e) {
          console.error('Failed to refresh fav folders:', e)
        }
      }

      setTimeout(() => {
        setShowSaveDialog(false)
        setSaveTitle('')
        setSaveResult(null)
      }, 1500)
    } catch (err: any) {
      const msg = err?.message || t('search.error')
      setSaveResult({ success: false, message: msg })
      showToast(msg, 'error')
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-8 pt-8 pb-6 flex items-center justify-between min-w-0 gap-4"
        style={{ animation: 'fadeInDown 0.35s ease-out' }}
      >
        <h2 className="text-[32px] font-bold tracking-[-0.02em] text-foreground truncate">
          {t('playlist.title')}
        </h2>
        {playlist.length > 0 && (
          <div className="flex items-center gap-2">
            {loginStatus?.isLogin && (
              <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
                <Icon name="save" size={14} />
                <span className="ml-2">{t('playlist.saveFav')}</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { clearPlaylist(); showToast('播放列表已清空', 'info') }}>
              <Icon name="delete" size={14} />
              <span className="ml-2">{t('playlist.clear')}</span>
            </Button>
          </div>
        )}
      </div>

      {showSaveDialog && (
        <div className="px-8 pt-1 pb-4 overflow-hidden"
          style={{ animation: 'fadeInDown 0.2s ease-out' }}>
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <h3 className="text-[14px] font-medium text-foreground">{t('playlist.saveDialogTitle')}</h3>
            <Input
              placeholder={t('playlist.saveNamePlaceholder')}
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              className="text-[13px]"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSavePrivacy(0)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                  savePrivacy === 0
                    ? 'bg-secondary text-foreground font-medium border border-border'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                <Icon name="language" size={12} />
                {t('playlist.public')}
              </button>
              <button
                onClick={() => setSavePrivacy(1)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                  savePrivacy === 1
                    ? 'bg-secondary text-foreground font-medium border border-border'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                <Icon name="lock" size={12} />
                {t('playlist.private')}
              </button>
            </div>
            {saveResult && (
              <p className={`text-[12px] ${saveResult.success ? 'text-green-600' : 'text-red-500'}`}>
                {saveResult.message}
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveToFav} disabled={saveLoading || !saveTitle.trim()}>
                {saveLoading ? t('playlist.saving') : t('playlist.saveConfirm')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowSaveDialog(false); setSaveResult(null) }}>
                {t('settings.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

<ScrollArea className="flex-1 px-8 pb-8">
        {playlist.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-muted-foreground"
            style={{ animation: 'fadeInScale 0.3s ease-out' }}
          >
            <Icon name="music_note" size={48} className="mb-4 text-border" />
            <p className="text-[14px]">{t('playlist.empty')}</p>
            <p className="text-[12px] mt-1">{t('playlist.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {playlist.map((video, index) => {
              const isCurrent = currentTrack?.bvid === video.bvid
              return (
                <div key={video.bvid || index}>
                  <VideoCard
                    bvid={video.bvid}
                    title={video.title}
                    pic={getHighResPic(video.pic)}
                    duration={video.duration}
                    owner={video.owner}
                    size="small"
                    index={index}
                    isCurrent={isCurrent}
                    showIndex
                    onPlay={() => onPlay(video)}
                    onRemove={() => removeFromPlaylist(video.bvid)}
                    onOpenExternal={video.bvid ? () => window.electronAPI.openExternal(`https://www.bilibili.com/video/${video.bvid}`) : undefined}
                    onCopyBvid={video.bvid ? () => {
                      navigator.clipboard.writeText(video.bvid)
                      showToast(`${video.bvid} 已复制`, 'success')
                    } : undefined}
                  />
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
