import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { VideoCard } from '@/components/ui/video-card'
import { Icon } from '@/components/ui/icon'
import { getHighResPic } from '@/lib/utils'
import { usePlayerStore } from '@/store/playerStore'
import { useUserStore } from '@/store/userStore'
import { useToastStore } from '@/store/toastStore'
import { useI18nStore } from '@/i18n'
import type { PlaylistItem } from '@/types'

interface FavoritesViewProps {
  mediaId: number
  folderName: string
  onBack: () => void
  onPlay: (video: PlaylistItem) => void
  onAddToPlaylist: (video: PlaylistItem) => void
}

export function FavoritesView({ mediaId, folderName, onBack, onPlay, onAddToPlaylist }: FavoritesViewProps) {
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { setPlaylist, setCurrentTrack } = usePlayerStore()
  const { loginStatus } = useUserStore()
  const { showToast } = useToastStore()
  const { t } = useI18nStore()

  const loadContent = useCallback(async (pn: number) => {
    setLoading(true)
    setError(null)
    try {
      const results = await window.electronAPI.biliFavContent(mediaId, pn, 20)
      if (pn === 1) {
        setVideos(results)
      } else {
        setVideos((prev) => [...prev, ...results])
      }
      setHasMore(results.length === 20)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || t('search.error'))
    } finally {
      setLoading(false)
    }
  }, [mediaId, t])

  useEffect(() => {
    loadContent(1)
  }, [loadContent])

  const handleLoadMore = () => {
    const next = page + 1
    setPage(next)
    loadContent(next)
  }

  const toPlaylistItem = (item: any): PlaylistItem => ({
    bvid: item.bvid || '',
    aid: item.id || 0,
    title: item.title || t('common.noTitle'),
    description: item.intro || '',
    pic: item.cover || '',
    duration: typeof item.duration === 'number' ? item.duration : 0,
    owner: {
      mid: item.upper?.mid || 0,
      name: item.upper?.name || t('common.unknown'),
      face: item.upper?.face || ''
    },
    stat: {
      view: item.cnt_info?.play || 0,
      like: item.cnt_info?.like || 0,
      coin: item.cnt_info?.coin || 0,
      favorite: item.cnt_info?.collect || 0
    },
    pubdate: item.pubtime || Date.now() / 1000,
    addedAt: Date.now()
  })

  const handleAddAll = () => {
    const items = videos.map(toPlaylistItem)
    for (const item of items) {
      onAddToPlaylist(item)
    }
  }

  const handleReplacePlaylist = () => {
    const items = videos.map(toPlaylistItem)
    setPlaylist(items)
    if (items.length > 0) {
      setCurrentTrack(items[0])
    }
  }

  const handleOpenFolderInBrowser = async () => {
    const uid = loginStatus?.mid
    if (uid) {
      await window.electronAPI.openExternal(`https://space.bilibili.com/${uid}/favlist?fid=${mediaId}`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-8 pb-6 flex items-center gap-4 min-w-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 flex-shrink-0">
          <Icon name="arrow_back" size={16} />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[32px] font-bold tracking-[-0.02em] text-foreground truncate">
            {folderName}
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1">{t('fav.videosCount', { count: videos.length })}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={handleOpenFolderInBrowser} className="h-8 w-8" title={t('fav.openBrowser')}>
            <Icon name="open_in_new" size={16} />
          </Button>
          {videos.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleAddAll}>
                <Icon name="playlist_add" size={14} />
                <span className="ml-2">{t('fav.addAll')}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleReplacePlaylist}>
                <Icon name="replay" size={14} />
                <span className="ml-2">{t('fav.replaceList')}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 px-8 pb-8">
        {error && (
          <div className="py-4 text-[14px] text-red-500">
            {t('search.error')}: {error}
          </div>
        )}

        {videos.length > 0 && (
          <div className="space-y-2">
            {videos.map((video, index) => (
                <div key={video.id || index}>
                  <VideoCard
                    bvid={video.bvid}
                    title={video.title}
                    cover={getHighResPic(video.cover)}
                    duration={video.duration}
                    upper={video.upper}
                    cnt_info={video.cnt_info}
                    size="large"
                    onPlay={() => onPlay(toPlaylistItem(video))}
                    onAddToPlaylist={() => onAddToPlaylist(toPlaylistItem(video))}
                    onOpenExternal={video.bvid ? () => window.electronAPI.openExternal(`https://www.bilibili.com/video/${video.bvid}`) : undefined}
                    onCopyBvid={video.bvid ? () => {
                      navigator.clipboard.writeText(video.bvid)
                      showToast(`${video.bvid} 已复制`, 'success')
                    } : undefined}
                  />
                </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-4">
            <Icon name="progress_activity" size={16} className="animate-spin text-primary" />
            {t('fav.loading')}
          </div>
        )}

        {hasMore && !loading && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={handleLoadMore}>
              {t('fav.loadMore')}
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
