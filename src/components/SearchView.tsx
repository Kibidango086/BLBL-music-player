import { useState, useCallback } from 'react'
import { Search, Play, Plus, Clock, Eye, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { searchBilibili, formatDuration, formatNumber } from '@/lib/bilibili-api'
import { stripHtml, getHighResPic } from '@/lib/utils'
import { useI18nStore } from '@/i18n'
import { useToastStore } from '@/store/toastStore'
import type { BilibiliVideo, PlaylistItem } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'

interface SearchViewProps {
  onPlay: (video: PlaylistItem) => void
  onAddToPlaylist: (video: PlaylistItem) => void
}

export function SearchView({ onPlay, onAddToPlaylist }: SearchViewProps) {
  const [query, setQuery] = useState('')
  const [videos, setVideos] = useState<BilibiliVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useI18nStore()
  const { showToast } = useToastStore()

  const performSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const results = await searchBilibili(query)
      setVideos(results)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || t('search.error'))
      setVideos([])
    } finally {
      setLoading(false)
    }
  }, [query, t])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') performSearch()
  }

  const toPlaylistItem = (video: BilibiliVideo): PlaylistItem => ({
    ...video,
    addedAt: Date.now()
  })

  return (
    <div className="flex flex-col h-full">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="px-8 pt-8 pb-6 min-w-0"
      >
        <h2 className="text-[32px] font-semibold tracking-[-1.28px] text-vercel-black dark:text-[#ededed] mb-6 truncate">
          {t('search.title')}
        </h2>
        <div className="flex gap-3 max-w-xl">
          <Input
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-10 text-[14px] dark:bg-[#141414] dark:text-[#ededed] dark:shadow-[rgba(255,255,255,0.08)_0px_0px_0px_1px]"
          />
          <Button onClick={performSearch} disabled={loading} className="h-10 px-5">
            <Search className="w-4 h-4 mr-2" />
            {t('search.btn')}
          </Button>
        </div>
      </motion.div>

      <ScrollArea className="flex-1 px-8 pb-8">
        {loading && (
          <div className="flex items-center gap-2 text-[14px] text-vercel-gray-500 dark:text-[#666666] py-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 border-vercel-gray-200 dark:border-[#333333] border-t-vercel-black dark:border-t-[#ededed] rounded-full"
            />
            {t('search.loading')}
          </div>
        )}

        {error && (
          <div className="py-4 text-[14px] text-red-500">
            {t('search.error')}: {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence>
            {videos.map((video, i) => (
              <motion.div
                key={video.bvid || `video-${i}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                className="group flex items-center gap-4 p-3 rounded-lg bg-white dark:bg-[#0a0a0a] shadow-border hover:shadow-card transition-shadow"
              >
                <div className="relative w-32 h-20 flex-shrink-0 rounded-md overflow-hidden bg-vercel-gray-50 dark:bg-[#141414]">
                  {video.pic ? (
                    <img
                      src={getHighResPic(video.pic)}
                      alt={stripHtml(video.title)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
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
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {video.owner?.name || t('common.unknown')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatNumber(video.stat?.view || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {video.pubdate ? new Date(video.pubdate * 1000).toLocaleDateString() : '-'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 dark:text-[#ededed] dark:hover:bg-[#141414]"
                    onClick={() => onPlay(toPlaylistItem(video))}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 dark:text-[#ededed] dark:hover:bg-[#141414]"
                    onClick={() => { onAddToPlaylist(toPlaylistItem(video)); showToast('已添加到播放列表', 'success') }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  )
}
