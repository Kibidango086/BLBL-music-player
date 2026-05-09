import { useI18nStore } from '@/i18n'
import { LazyImage } from './lazy-image'
import { formatDuration, formatNumber } from '@/lib/bilibili-api'
import { stripHtml } from '@/lib/utils'
import { Button } from './button'
import { Play, Plus, ExternalLink, Copy, Trash2 } from 'lucide-react'

export interface VideoCardProps {
  bvid: string
  title: string
  pic?: string
  cover?: string
  duration?: number
  owner?: { name?: string; mid?: number; face?: string }
  upper?: { name?: string; mid?: number; face?: string }
  stat?: { view?: number; like?: number; coin?: number; favorite?: number }
  cnt_info?: { play?: number; like?: number; coin?: number; collect?: number }

  size?: 'large' | 'small'
  index?: number
  isCurrent?: boolean
  showIndex?: boolean

  onPlay?: () => void
  onAddToPlaylist?: () => void
  onRemove?: () => void
  onOpenExternal?: () => void
  onCopyBvid?: () => void
}

export function VideoCard({
  title,
  pic,
  cover,
  duration = 0,
  owner,
  upper,
  stat,
  cnt_info,
  size = 'large',
  index,
  isCurrent,
  showIndex,
  onPlay,
  onAddToPlaylist,
  onRemove,
  onOpenExternal,
  onCopyBvid
}: VideoCardProps) {
  const { t } = useI18nStore()
  const imageUrl = pic || cover
  const authorName = owner?.name || upper?.name || t('common.unknown')
  const views = stat?.view || cnt_info?.play || 0
  const likes = stat?.like || cnt_info?.like || 0
  const coins = stat?.coin || cnt_info?.coin || 0
  const favorites = stat?.favorite || cnt_info?.collect || 0

  const isLarge = size === 'large'

  const imageWrapperClass = isLarge
    ? 'w-32 h-20 rounded-md'
    : 'w-12 h-12 rounded overflow-hidden'
  const gapClass = isLarge ? 'gap-4' : 'gap-3'
  const paddingClass = 'px-3 py-2'
  const titleSize = isLarge ? 'text-[14px]' : 'text-[13px]'
  const metaSize = isLarge ? 'text-[12px]' : 'text-[11px]'

  return (
    <div
      className={`group flex items-center ${gapClass} ${paddingClass} rounded-lg bg-white dark:bg-[#0a0a0a] shadow-border hover:shadow-card transition-shadow mx-1 ${
        isCurrent ? 'bg-vercel-gray-50 dark:bg-[#141414]' : ''
      }`}
    >
      {showIndex && (
        <span
          className={`text-[12px] w-6 text-center font-mono ${
            isCurrent ? 'text-vercel-link' : 'text-vercel-gray-400 dark:text-[#666666]'
          }`}
        >
          {(index ?? 0) + 1}
        </span>
      )}

      <div className={`relative flex-shrink-0 ${imageWrapperClass} bg-vercel-gray-50 dark:bg-[#141414] flex items-center justify-center`}>
        {imageUrl ? (
          <LazyImage
            src={imageUrl}
            alt={stripHtml(title)}
            className={`w-full h-full ${isLarge ? 'object-cover' : 'object-contain'}`}
          />
        ) : (
          <div className="w-full h-full bg-vercel-gray-100 dark:bg-[#1f1f1f]" />
        )}
        {isLarge && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[11px] text-white font-mono">
            {formatDuration(duration)}
          </div>
        )}
        {isCurrent && !isLarge && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-white rounded-full animate-pulse"
                  style={{ height: '4px', animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3
          className={`${titleSize} font-medium truncate leading-tight select-text ${
            isCurrent ? 'text-vercel-link' : 'text-vercel-black dark:text-[#ededed]'
          }`}
        >
          {stripHtml(title)}
        </h3>
        <div className={`flex items-center gap-3 mt-1.5 ${metaSize} text-vercel-gray-500 dark:text-[#808080]`}>
          {isLarge ? (
            <>
              <span className="truncate">{authorName}</span>
              <span>{formatNumber(views)}播放</span>
              {likes > 0 && <span>{formatNumber(likes)}赞</span>}
              {coins > 0 && <span>{formatNumber(coins)}币</span>}
              {favorites > 0 && <span>{formatNumber(favorites)}收藏</span>}
            </>
          ) : (
            <span className="truncate select-text">
              {authorName} · {formatDuration(duration)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {onOpenExternal && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-vercel-gray-400 dark:text-[#808080] hover:text-vercel-black dark:hover:text-[#ededed]"
            onClick={onOpenExternal}
          >
            <ExternalLink className={isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          </Button>
        )}
        {onCopyBvid && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-vercel-gray-400 dark:text-[#808080] hover:text-vercel-black dark:hover:text-[#ededed]"
            onClick={onCopyBvid}
          >
            <Copy className={isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          </Button>
        )}
        {onPlay && (
          <Button
            size="icon"
            variant="ghost"
            className={`h-8 w-8 dark:text-[#ededed] dark:hover:bg-[#141414] ${!isLarge ? 'h-7 w-7' : ''}`}
            onClick={onPlay}
          >
            <Play className={isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          </Button>
        )}
        {onAddToPlaylist && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 dark:text-[#ededed] dark:hover:bg-[#141414]"
            onClick={onAddToPlaylist}
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
        {onRemove && (
          <Button
            size="icon"
            variant="ghost"
            className={`h-8 w-8 text-vercel-gray-400 dark:text-[#666666] hover:text-red-500 ${!isLarge ? 'h-7 w-7' : ''}`}
            onClick={onRemove}
          >
            <Trash2 className={isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          </Button>
        )}
      </div>
    </div>
  )
}