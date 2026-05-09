import { useState, useEffect, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualizerOptions } from '@tanstack/react-virtual'
import { ArrowLeft, ListPlus, ListRestart, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { VideoCard } from '@/components/ui/video-card'
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

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: videos.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 100,
    overscan: 5,
    gap: 8
  })

  useEffect(() => {
    virtualizer.setOptions({ count: videos.length } as any)
  }, [videos.length])

  const loadContent = useCallback(async (pn: number) => {
    setLoading(true)
    setError(null)
    try {
      const results = await window.electronAPI.biliFavContent(mediaId, pn, 20)
      const newCount = pn === 1 ? results.length : videos.length + results.length
      if (pn === 1) {
        setVideos(results)
      } else {
        setVideos((prev) => [...prev, ...results])
      }
      virtualizer.setOptions({ count: newCount } as VirtualizerOptions<HTMLDivElement, Element>)
      setHasMore(results.length === 20)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || t('search.error'))
    } finally {
      setLoading(false)
    }
  }, [mediaId, t, videos.length])

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
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 dark:text-[#ededed] dark:hover:bg-[#141414] flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[32px] font-semibold tracking-[-1.28px] text-vercel-black dark:text-[#ededed] truncate">
            {folderName}
          </h2>
          <p className="text-[13px] text-vercel-gray-500 dark:text-[#808080] mt-1">{t('fav.videosCount', { count: videos.length })}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={handleOpenFolderInBrowser} className="h-8 w-8 dark:text-[#ededed] dark:hover:bg-[#141414]" title={t('fav.openBrowser')}>
            <ExternalLink className="w-4 h-4" />
          </Button>
          {videos.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleAddAll}>
                <ListPlus className="w-3.5 h-3.5 mr-2" />
                {t('fav.addAll')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleReplacePlaylist}>
                <ListRestart className="w-3.5 h-3.5 mr-2" />
                {t('fav.replaceList')}
              </Button>
            </>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 px-8 pb-8" viewportRef={scrollRef}>
        {error && (
          <div className="py-4 text-[14px] text-red-500">
            {t('search.error')}: {error}
          </div>
        )}

        {videos.length > 0 && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const video = videos[virtualItem.index]
              return (
                <div
                  key={video.id || virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`
                  }}
                >
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
              )
            })}
          </div>
        )}

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
              {loading ? t('fav.loading') : t('fav.loadMore')}
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
