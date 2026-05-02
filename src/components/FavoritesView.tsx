import { useState, useEffect, useCallback } from 'react'
import { Play, Plus, ArrowLeft, ListPlus, ListRestart, ExternalLink, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDuration, formatNumber } from '@/lib/bilibili-api'
import { stripHtml, getHighResPic } from '@/lib/utils'
import { usePlayerStore } from '@/store/playerStore'
import { useUserStore } from '@/store/userStore'
import { useToastStore } from '@/store/toastStore'
import { useI18nStore } from '@/i18n'
import type { PlaylistItem } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'

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

      <ScrollArea className="flex-1 px-8 pb-8">
        {error && (
          <div className="py-4 text-[14px] text-red-500">
            {t('search.error')}: {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence>
            {videos.map((video, i) => (
              <motion.div
                key={video.id || `fav-${i}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                className="group flex items-center gap-4 p-3 rounded-lg bg-white dark:bg-[#0a0a0a] shadow-border hover:shadow-card transition-shadow"
              >
                <div className="relative w-32 h-20 flex-shrink-0 rounded-md overflow-hidden bg-vercel-gray-50 dark:bg-[#141414]">
                  {video.cover ? (
                    <img src={getHighResPic(video.cover)} alt={stripHtml(video.title)} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-vercel-gray-100 dark:bg-[#1f1f1f]" />
                  )}
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[11px] text-white font-mono">
                    {formatDuration(video.duration || 0)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-medium text-vercel-black dark:text-[#ededed] truncate leading-tight select-text">
                    {stripHtml(video.title)}
                  </h3>
                  <div className="flex items-center gap-4 mt-1.5 text-[12px] text-vercel-gray-500 dark:text-[#808080]">
                    <span className="select-text">{video.upper?.name || t('common.unknown')}</span>
                    <span className="select-text">{t('fav.plays', { count: formatNumber(video.cnt_info?.play || 0) })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-vercel-gray-400 dark:text-[#808080] hover:text-vercel-black dark:hover:text-[#ededed]" onClick={async () => {
                    if (video.bvid) await window.electronAPI.openExternal(`https://www.bilibili.com/video/${video.bvid}`)
                  }}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-vercel-gray-400 dark:text-[#808080] hover:text-vercel-black dark:hover:text-[#ededed]" onClick={async () => {
                    if (video.bvid) {
                      await navigator.clipboard.writeText(video.bvid)
                      showToast(`${video.bvid} 已复制`, 'success')
                    }
                  }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 dark:text-[#ededed] dark:hover:bg-[#141414]" onClick={() => onPlay(toPlaylistItem(video))}>
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 dark:text-[#ededed] dark:hover:bg-[#141414]" onClick={() => onAddToPlaylist(toPlaylistItem(video))}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

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
