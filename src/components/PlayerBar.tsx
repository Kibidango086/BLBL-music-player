import { useCallback, useEffect, useState } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  ListMusic,
  Gauge
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { usePlayerStore } from '@/store/playerStore'
import { useI18nStore } from '@/i18n'
import { formatDuration } from '@/lib/bilibili-api'
import { cn, stripHtml, getHighResPic } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const PRESET_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function PlayerBar() {
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
      <div className="h-20 border-t border-vercel-gray-100 dark:border-[#1f1f1f] bg-white dark:bg-[#0a0a0a] flex items-center justify-center px-6">
        <p className="text-[13px] text-vercel-gray-400 dark:text-[#666666]">{t('player.chooseSong')}</p>
      </div>
    )
  }

  const trackTitle = stripHtml(currentTrack.title)
  const trackPic = currentTrack.pic || ''
  const trackOwner = currentTrack.owner?.name || t('common.unknown')

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-20 border-t border-vercel-gray-100 dark:border-[#1f1f1f] bg-white dark:bg-[#0a0a0a] px-6 flex items-center gap-6 flex-shrink-0 min-w-0">
        <motion.div
          key={currentTrack.bvid}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3 w-52 flex-shrink min-w-0"
        >
          <div className="w-12 h-12 rounded-md overflow-hidden bg-vercel-gray-50 dark:bg-[#141414] flex-shrink-0 relative">
            {trackPic ? (
              <img src={getHighResPic(trackPic)} alt={trackTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-vercel-gray-100 dark:bg-[#1f1f1f]" />
            )}
            <AnimatePresence>
              {isPlaying && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="flex gap-0.5 items-end h-3">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} animate={{ height: [3, 10, 3] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }} className="w-[3px] bg-white rounded-full" />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-vercel-black dark:text-[#ededed] truncate leading-tight select-text">{trackTitle}</p>
            <p className="text-[11px] text-vercel-gray-500 dark:text-[#808080] truncate mt-0.5 select-text">{trackOwner}</p>
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col items-center gap-2 max-w-xl min-w-0">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button size="icon" variant={shuffle ? 'default' : 'ghost'} className={cn('h-7 w-7', shuffle ? 'bg-vercel-black dark:bg-[#ededed] text-white dark:text-[#0a0a0a]' : '')} onClick={toggleShuffle}>
                    <Shuffle className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="top">{t('player.shuffle')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={playPrevious}>
                    <SkipBack className="w-4 h-4" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="top">{t('player.prev')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.92 }}>
                  <Button size="icon" className="h-9 w-9 rounded-full bg-vercel-black dark:bg-[#ededed] text-white dark:text-[#0a0a0a] hover:bg-vercel-gray-900 dark:hover:bg-white" onClick={() => setPlaying(!isPlaying)}>
                    <AnimatePresence mode="wait">
                      {isPlaying ? (
                        <motion.div key="pause" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }}>
                          <Pause className="w-4 h-4" />
                        </motion.div>
                      ) : (
                        <motion.div key="play" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }}>
                          <Play className="w-4 h-4 ml-0.5" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="top">{t('player.playPause')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={playNext}>
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="top">{t('player.next')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button size="icon" variant="ghost" className={cn('h-7 w-7', repeatMode !== 'none' && 'text-vercel-link')} onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')}>
                    {repeatMode === 'one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="top">{repeatLabel}</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-full flex items-center gap-3">
            <span className="text-[11px] text-vercel-gray-400 dark:text-[#666666] font-mono w-10 text-right">
              {formatDuration(Math.floor(currentTime))}
            </span>
            <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={handleSeek} className="flex-1" />
            <span className="text-[11px] text-vercel-gray-400 dark:text-[#666666] font-mono w-10">
              {formatDuration(Math.floor(duration))}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 justify-end min-w-0">
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowRatePopover(!showRatePopover)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-vercel-gray-600 dark:text-[#808080] hover:bg-vercel-gray-50 dark:hover:bg-[#141414] transition-colors"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  {playbackRate}x
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('player.speed')}</TooltipContent>
            </Tooltip>

            <AnimatePresence>
              {showRatePopover && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full right-0 mb-2 p-2 rounded-lg bg-white dark:bg-[#141414] shadow-card z-50 min-w-[140px]"
                >
                  <div className="space-y-1">
                    {PRESET_RATES.map((rate) => (
                      <button
                        key={rate}
                        onClick={() => { setPlaybackRate(rate); setShowRatePopover(false) }}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded text-[12px] transition-colors',
                          playbackRate === rate
                            ? 'bg-vercel-gray-50 dark:bg-[#1f1f1f] text-vercel-black dark:text-[#ededed] font-medium'
                            : 'text-vercel-gray-600 dark:text-[#808080] hover:bg-vercel-gray-50 dark:hover:bg-[#1f1f1f]'
                        )}
                      >
                        {rate}x
                      </button>
                    ))}
                    <div className="pt-1 border-t border-vercel-gray-100 dark:border-[#1f1f1f]">
                      <div className="flex items-center gap-1 px-1">
                        <Input
                          placeholder={t('player.speedCustom')}
                          value={customRate}
                          onChange={(e) => setCustomRate(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && applyCustomRate()}
                          className="h-6 text-[11px] px-1.5 py-0 dark:bg-[#0a0a0a] dark:text-[#ededed]"
                        />
                        <button
                          onClick={applyCustomRate}
                          className="text-[11px] px-1.5 py-0.5 rounded bg-vercel-gray-100 dark:bg-[#1f1f1f] text-vercel-black dark:text-[#ededed] hover:bg-vercel-gray-200 dark:hover:bg-[#333333]"
                        >
                          {t('player.speedConfirm')}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileTap={{ scale: 0.9 }}>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMuted(!muted)}>
                  {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="top">{muted ? t('player.unmute') : t('player.mute')}</TooltipContent>
          </Tooltip>

          <Slider value={[muted ? 0 : volume]} max={1} step={0.01} onValueChange={handleVolumeChange} className="w-20" />

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-[11px] text-vercel-gray-500 dark:text-[#808080] ml-1">
                <ListMusic className="w-3.5 h-3.5" />
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
