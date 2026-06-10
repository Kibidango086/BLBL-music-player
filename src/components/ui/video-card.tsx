import { useI18nStore } from '@/i18n'
import { LazyImage } from './lazy-image'
import { formatDuration, formatNumber } from '@/lib/bilibili-api'
import { stripHtml } from '@/lib/utils'
import { Button } from './button'
import { Icon } from './icon'

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
      className={`group flex items-center ${gapClass} ${paddingClass} rounded-xl bg-card border border-border hover:border-ring hover:-translate-y-px hover:shadow transition-all mx-1 ${
        isCurrent ? 'bg-secondary' : ''
      }`}
    >
      {showIndex && (
        <span
          className={`text-[12px] w-6 text-center font-mono ${
            isCurrent ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {(index ?? 0) + 1}
        </span>
      )}

      <div className={`relative flex-shrink-0 ${imageWrapperClass} bg-accent flex items-center justify-center`}>
        {imageUrl ? (
          <LazyImage
            src={imageUrl}
            alt={stripHtml(title)}
            className={`w-full h-full ${isLarge ? 'object-cover' : 'object-contain'}`}
          />
        ) : (
          <div className="w-full h-full bg-accent" />
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
                  className="w-1 bg-white rounded-full"
                  style={{ height: '4px', animation: `playingBar 0.5s ease-in-out infinite ${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3
          className={`${titleSize} font-medium truncate leading-tight select-text ${
            isCurrent ? 'text-primary' : 'text-foreground'
          }`}
        >
          {stripHtml(title)}
        </h3>
        <div className={`flex items-center gap-3 mt-1.5 ${metaSize} text-muted-foreground`}>
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
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onOpenExternal}
          >
            <Icon name="open_in_new" size={isLarge ? 16 : 14} />
          </Button>
        )}
        {onCopyBvid && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onCopyBvid}
          >
            <Icon name="content_copy" size={isLarge ? 16 : 14} />
          </Button>
        )}
        {onPlay && (
          <Button
            size="icon"
            variant="ghost"
            className={`h-8 w-8 hover:text-primary ${!isLarge ? 'h-7 w-7' : ''}`}
            onClick={onPlay}
          >
            <Icon name="play_arrow" size={isLarge ? 16 : 14} />
          </Button>
        )}
        {onAddToPlaylist && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hover:text-primary"
            onClick={onAddToPlaylist}
          >
            <Icon name="add" size={16} />
          </Button>
        )}
        {onRemove && (
          <Button
            size="icon"
            variant="ghost"
            className={`h-8 w-8 text-muted-foreground hover:text-red-500 ${!isLarge ? 'h-7 w-7' : ''}`}
            onClick={onRemove}
          >
            <Icon name="delete" size={isLarge ? 16 : 14} />
          </Button>
        )}
      </div>
    </div>
  )
}
