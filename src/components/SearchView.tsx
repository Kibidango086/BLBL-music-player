import { useState, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { VideoCard } from '@/components/ui/video-card'
import { searchBilibili } from '@/lib/bilibili-api'
import { getHighResPic } from '@/lib/utils'
import { useI18nStore } from '@/i18n'
import { useToastStore } from '@/store/toastStore'
import type { BilibiliVideo, PlaylistItem } from '@/types'
import { motion } from 'framer-motion'

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

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: videos.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 108,
    overscan: 5,
    gap: 8
  })

  useEffect(() => {
    virtualizer.setOptions({ count: videos.length } as any)
  }, [videos.length])

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

      <ScrollArea className="flex-1 px-8 pb-8" viewportRef={scrollRef}>
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
                  key={video.bvid || virtualItem.index}
                  className="mb-2"
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
                    pic={getHighResPic(video.pic)}
                    duration={video.duration}
                    owner={video.owner}
                    stat={video.stat}
                    size="large"
                    onPlay={() => onPlay(toPlaylistItem(video))}
                    onAddToPlaylist={() => {
                      onAddToPlaylist(toPlaylistItem(video))
                      showToast('已添加到播放列表', 'success')
                    }}
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
