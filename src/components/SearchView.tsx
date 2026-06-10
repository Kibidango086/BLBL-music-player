import { useState, useCallback } from 'react'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { VideoCard } from '@/components/ui/video-card'
import { searchBilibili } from '@/lib/bilibili-api'
import { getHighResPic } from '@/lib/utils'
import { useI18nStore } from '@/i18n'
import { useToastStore } from '@/store/toastStore'
import type { BilibiliVideo, PlaylistItem } from '@/types'

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
      <div
        className="px-8 pt-8 pb-6 min-w-0"
        style={{ animation: 'fadeInDown 0.35s ease-out' }}
      >
        <h2 className="text-[32px] font-bold tracking-[-0.02em] text-foreground mb-6 truncate">
          {t('search.title')}
        </h2>
        <div className="flex gap-3 max-w-xl">
          <Input
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-10 text-[14px]"
          />
          <Button onClick={performSearch} disabled={loading} className="h-10 px-5">
            <Icon name="search" size={16} />
            <span className="ml-2">{t('search.btn')}</span>
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-8 pb-8">
        {loading && (
          <div className="flex items-center gap-2 text-[14px] text-muted-foreground py-4">
            <Icon name="progress_activity" size={16} className="animate-spin text-primary" />
            {t('search.loading')}
          </div>
        )}

        {error && (
          <div className="py-4 text-[14px] text-red-500">
            {t('search.error')}: {error}
          </div>
        )}

        {videos.length > 0 && (
          <div className="space-y-2">
            {videos.map((video, index) => (
                <div key={video.bvid || index}>
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
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
