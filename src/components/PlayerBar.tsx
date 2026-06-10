import { useCallback, useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Icon } from '@/components/ui/icon'
import { usePlayerStore } from '@/store/playerStore'
import { useI18nStore } from '@/i18n'
import { formatDuration } from '@/lib/bilibili-api'
import { cn, stripHtml, getHighResPic } from '@/lib/utils'

const PRESET_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

interface PlayerBarProps {
  onAlbumClick?: () => void
}

export function PlayerBar({ onAlbumClick }: PlayerBarProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    playbackRate,
    repeatMode,
    shuffle,
    playlist,
    setPlaying,
    setCurrentTime,
    setVolume,
    setMuted,
    setPlaybackRate,
    setRepeatMode,
    toggleShuffle,
    playNext,
    playPrevious
  } = usePlayerStore()
  const { t } = useI18nStore()
  const [showRatePopover, setShowRatePopover] = useState(false)
  const [customRate, setCustomRate] = useState('')
  const trackKeyRef = useRef(currentTrack?.bvid || '')

  useEffect(() => {
    trackKeyRef.current = currentTrack?.bvid || ''
  }, [currentTrack?.bvid])

  const handleSeek = useCallback(
    (value: number[]) => {
      const audio = document.querySelector('audio') as HTMLAudioElement
      if (audio) {
        audio.currentTime = value[0]
        setCurrentTime(value[0])
      }
    },
    [setCurrentTime]
  )

  const handleVolumeChange = useCallback(
    (value: number[]) => {
      setVolume(value[0])
      if (value[0] > 0 && muted) setMuted(false)
    },
    [setVolume, muted, setMuted]
  )

  const applyCustomRate = () => {
    const rate = parseFloat(customRate)
    if (!isNaN(rate) && rate >= 0.1 && rate <= 10) {
      setPlaybackRate(rate)
      setCustomRate('')
    }
  }

  const repeatLabel = repeatMode === 'none' ? t('player.repeatNone') : repeatMode === 'all' ? t('player.repeatAll') : t('player.repeatOne')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          setPlaying(!isPlaying)
          break
        case 'ArrowRight':
          playNext()
          break
        case 'ArrowLeft':
          playPrevious()
          break
        case 'ArrowUp':
          setVolume(Math.min(1, volume + 0.05))
          break
        case 'ArrowDown':
          setVolume(Math.max(0, volume - 0.05))
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isPlaying, volume, setPlaying, playNext, playPrevious, setVolume])

  if (!currentTrack) {
    return (
      <div className="h-20 flex items-center justify-center px-6">
        <p className="text-[13px] text-muted-foreground">{t('player.chooseSong')}</p>
      </div>
    )
  }

  const trackTitle = stripHtml(currentTrack.title)
  const trackPic = currentTrack.pic || ''
  const trackOwner = currentTrack.owner?.name || t('common.unknown')

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-20 px-4 flex items-center gap-6 flex-shrink-0 min-w-0">
        <div
          key={trackKeyRef.current}
          className="flex items-center gap-3 w-52 flex-shrink min-w-0"
          style={{ animation: 'slideInLeft 0.3s ease-out' }}
        >
          <div
            className="w-12 h-12 rounded-md overflow-hidden bg-accent flex-shrink-0 relative cursor-pointer hover:ring-2 hover:ring-primary transition-all active:scale-95"
            onClick={onAlbumClick}
            title="进入沉浸播放"
          >
            {trackPic ? (
              <img src={getHighResPic(trackPic)} alt={trackTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-accent" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="flex gap-0.5 items-end h-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-white rounded-full"
                      style={{
                        animation: `playingBar 0.5s ease-in-out infinite`,
                        animationDelay: `${i * 0.12}s`
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate leading-tight select-text">{trackTitle}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5 select-text">{trackOwner}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-2 max-w-xl min-w-0">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant={shuffle ? 'default' : 'ghost'} className={cn('h-7 w-7')} onClick={toggleShuffle}>
                  <Icon name="shuffle" size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('player.shuffle')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={playPrevious}>
                  <Icon name="skip_previous" size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('player.prev')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="h-9 w-9 rounded-full" onClick={() => setPlaying(!isPlaying)}>
                  {isPlaying ? (
                    <Icon name="pause" size={16} />
                  ) : (
                    <Icon name="play_arrow" size={16} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('player.playPause')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={playNext}>
                  <Icon name="skip_next" size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('player.next')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className={cn('h-7 w-7', repeatMode !== 'none' && 'text-primary')} onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')}>
                  <Icon name={repeatMode === 'one' ? 'repeat_one' : 'repeat'} size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{repeatLabel}</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-full flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground font-mono w-10 text-right">
              {formatDuration(Math.floor(currentTime))}
            </span>
            <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={handleSeek} className="flex-1" />
            <span className="text-[11px] text-muted-foreground font-mono w-10">
              {formatDuration(Math.floor(duration))}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 justify-end min-w-0">
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowRatePopover(!showRatePopover)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Icon name="speed" size={14} />
                  {playbackRate}x
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('player.speed')}</TooltipContent>
            </Tooltip>

            {showRatePopover && (
              <div className="absolute bottom-full right-0 mb-2 p-2 rounded-xl bg-card border border-border shadow z-50 min-w-[140px]"
                style={{ animation: 'fadeInScale 0.15s ease-out' }}>
                <div className="space-y-1">
                  {PRESET_RATES.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => { setPlaybackRate(rate); setShowRatePopover(false) }}
                      className={cn(
                        'w-full text-left px-2 py-1 rounded text-[12px] transition-colors',
                        playbackRate === rate
                          ? 'bg-secondary text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {rate}x
                    </button>
                  ))}
                  <div className="pt-1 border-t border-border">
                    <div className="flex items-center gap-1 px-1">
                      <Input
                        placeholder={t('player.speedCustom')}
                        value={customRate}
                        onChange={(e) => setCustomRate(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyCustomRate()}
                        className="h-6 text-[11px] px-1.5 py-0"
                      />
                      <button
                        onClick={applyCustomRate}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground hover:bg-border"
                      >
                        {t('player.speedConfirm')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMuted(!muted)}>
                <Icon name={muted || volume === 0 ? 'volume_off' : 'volume_up'} size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{muted ? t('player.unmute') : t('player.mute')}</TooltipContent>
          </Tooltip>

          <Slider value={[muted ? 0 : volume]} max={1} step={0.01} onValueChange={handleVolumeChange} className="w-20" />

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground ml-1">
                <Icon name="queue_music" size={14} />
                {playlist.length}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">{t('player.playlistCount')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
