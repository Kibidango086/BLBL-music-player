import { useState, useEffect, useCallback, useRef } from 'react'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { getVideoSubtitles, type SubtitleItem } from '@/lib/bilibili-api'
import { getHighResPic, stripHtml } from '@/lib/utils'
import { formatDuration } from '@/lib/bilibili-api'
import { useI18nStore } from '@/i18n'
import { usePlayerStore } from '@/store/playerStore'

interface ImmersivePlayerProps {
  onClose: () => void
}

function subtitlesToLyricLines(subs: SubtitleItem[]): any[] {
  return subs
    .filter(s => s.content?.trim())
    .map(s => {
      const startTime = Math.floor(s.from * 1000)
      const endTime = Math.floor(s.to * 1000)
      return {
        words: [{ word: s.content.trim(), startTime, endTime }],
        startTime,
        endTime,
        translatedLyric: '',
        romanLyric: '',
        isBG: false,
        isDuet: false
      }
    })
}

export default function ImmersivePlayer({ onClose }: ImmersivePlayerProps) {
  const { t } = useI18nStore()
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

  const [rawLyrics, setRawLyrics] = useState<SubtitleItem[]>([])
  const [lyricLoading, setLyricLoading] = useState(false)
  const [lyricError, setLyricError] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [lyricFontSize, setLyricFontSize] = useState(32)
  const [lyricOpacity, setLyricOpacity] = useState(0.8)
  const [showBgCover, setShowBgCover] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lyricsReadyRef = useRef(false)
  const lyricLines = subtitlesToLyricLines(rawLyrics)

  const lrcTime = Math.floor(currentTime * 1000)

  // Fetch subtitles — cid will be resolved from view API by getVideoSubtitles
  useEffect(() => {
    if (!currentTrack?.bvid) return
    setLyricLoading(true)
    setRawLyrics([])
    setLyricError(false)
    lyricsReadyRef.current = false

    getVideoSubtitles(currentTrack.bvid, currentTrack.cid || 0)
      .then(subs => setRawLyrics(subs))
      .catch(() => setRawLyrics([]))
      .finally(() => setLyricLoading(false))
  }, [currentTrack?.bvid, currentTrack?.cid])

  // Listen for iframe ready
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.source === 'blbl-lyrics-iframe') {
        if (e.data.type === 'ready') lyricsReadyRef.current = true
        if (e.data.type === 'error') setLyricError(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Send data to iframe when lyrics or time changes
  useEffect(() => {
    if (!lyricsReadyRef.current || !iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage({
      source: 'blbl-lyrics',
      type: 'update',
      lyricLines,
      currentTime: lrcTime,
      isPlaying
    }, '*')
  }, [lyricLines, lrcTime, isPlaying])

  // Clear iframe on unmount
  useEffect(() => {
    return () => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ source: 'blbl-lyrics', type: 'clear' }, '*')
      }
    }
  }, [])

  const handleSeek = useCallback((value: number[]) => {
    const audio = document.querySelector('audio') as HTMLAudioElement
    if (audio) {
      audio.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }, [setCurrentTime])

  const handleVolumeChange = useCallback((value: number[]) => {
    setVolume(value[0])
    if (value[0] > 0 && muted) setMuted(false)
  }, [setVolume, muted, setMuted])

  if (!currentTrack) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center" onClick={onClose}>
        <p className="text-muted-foreground">{t('player.chooseSong')}</p>
      </div>
    )
  }

  const trackTitle = stripHtml(currentTrack.title)
  const trackPic = getHighResPic(currentTrack.pic || '')
  const trackOwner = currentTrack.owner?.name || t('common.unknown')
  const hasLyrics = rawLyrics.length > 0

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{
      animation: 'fadeInScale 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      background: showBgCover && trackPic
        ? `linear-gradient(rgba(0,0,0,0.75), rgba(0,0,0,0.85)), url(${trackPic}) center/cover no-repeat`
        : '#000'
    }}>
      {showBgCover && trackPic && (
        <div className="absolute inset-0 backdrop-blur-xl" style={{ WebkitBackdropFilter: 'blur(40px)' }} />
      )}

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white h-10 w-10" onClick={onClose}>
          <Icon name="keyboard_arrow_down" size={28} />
        </Button>
        <div className="text-center">
          <p className="text-white/80 text-[14px] font-medium">{trackTitle}</p>
          <p className="text-white/40 text-[12px]">{trackOwner}</p>
        </div>
        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white h-10 w-10" onClick={() => setShowConfig(!showConfig)}>
          <Icon name="tune" size={24} />
        </Button>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="absolute right-4 top-16 z-20 p-4 rounded-[14px] bg-card border border-border shadow w-64"
          style={{ animation: 'fadeInDown 0.2s ease-out' }}>
          <h3 className="text-[14px] font-bold text-foreground mb-3">沉浸播放设置</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-[12px] text-muted-foreground">
              背景封面
              <button onClick={() => setShowBgCover(!showBgCover)}
                className={`w-10 h-5 rounded-full transition-colors ${showBgCover ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showBgCover ? 'translate-x-5' : 'translate-x-0.5'}`}
                  style={{ margin: '1px 0 0 1px' }} />
              </button>
            </label>
            <label className="block text-[12px] text-muted-foreground">
              歌词字号
              <Slider value={[lyricFontSize]} min={16} max={56} step={2} onValueChange={v => setLyricFontSize(v[0])} className="mt-1" />
              <span className="text-[10px] float-right">{lyricFontSize}px</span>
            </label>
            <label className="block text-[12px] text-muted-foreground">
              歌词透明度
              <Slider value={[lyricOpacity]} min={0.3} max={1} step={0.05} onValueChange={v => setLyricOpacity(v[0])} className="mt-1" />
            </label>
          </div>
        </div>
      )}

      {/* Album art */}
      <div className="relative z-10 flex-1 flex items-center justify-center min-h-0">
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
          <div className="w-56 h-56 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0" style={{ animation: 'fadeInScale 0.6s ease-out' }}>
            {trackPic ? (
              <img src={trackPic} alt={trackTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-accent flex items-center justify-center">
                <Icon name="music_note" size={48} className="text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Lyrics area — iframe */}
          <div className="w-full flex-1 min-h-[240px]" style={{ opacity: lyricOpacity }}>
            {lyricLoading ? (
              <div className="flex items-center justify-center gap-2 text-white/50 py-8">
                <Icon name="progress_activity" size={18} className="animate-spin" />
                加载歌词中...
              </div>
            ) : hasLyrics && !lyricError ? (
              <iframe
                ref={iframeRef}
                src="./src/lyrics/index.html"
                style={{ width: '100%', height: '300px', border: 'none', background: 'transparent' }}
                title="lyrics"
                allowTransparency
              />
            ) : lyricError ? (
              <div className="text-center text-white/30 py-12 text-[14px] flex flex-col items-center gap-2">
                <span>😿</span>
                <span>歌词组件加载失败</span>
                <button onClick={() => { setLyricError(false); setRawLyrics([]); if (currentTrack?.bvid) { setLyricLoading(true); getVideoSubtitles(currentTrack.bvid, currentTrack.cid!).then(s => { setRawLyrics(s); setLyricLoading(false); }).catch(() => setLyricLoading(false)); } }}
                  className="px-3 py-1 mt-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 text-[12px] transition-colors">
                  重试
                </button>
              </div>
            ) : (
              <div className="text-center text-white/30 py-12 text-[14px]">
                暂无歌词
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player controls */}
      <div className="relative z-10 px-8 pb-8 pt-4">
        <div className="max-w-2xl mx-auto mb-4">
          <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={handleSeek} />
          <div className="flex justify-between text-[11px] text-white/50 font-mono mt-1">
            <span>{formatDuration(Math.floor(currentTime))}</span>
            <span>{formatDuration(Math.floor(duration))}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 max-w-2xl mx-auto">
          <Button size="icon" variant="ghost" className="text-white/60 hover:text-white h-10 w-10" onClick={toggleShuffle}>
            <Icon name="shuffle" size={20} filled={shuffle} />
          </Button>
          <Button size="icon" variant="ghost" className="text-white/60 hover:text-white h-10 w-10" onClick={playPrevious}>
            <Icon name="skip_previous" size={24} />
          </Button>
          <Button size="icon" className="h-14 w-14 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 transition-transform"
            onClick={() => setPlaying(!isPlaying)}>
            <Icon name={isPlaying ? 'pause' : 'play_arrow'} size={28} />
          </Button>
          <Button size="icon" variant="ghost" className="text-white/60 hover:text-white h-10 w-10" onClick={playNext}>
            <Icon name="skip_next" size={24} />
          </Button>
          <Button size="icon" variant="ghost" className="text-white/60 hover:text-white h-10 w-10"
            onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')}>
            <Icon name={repeatMode === 'one' ? 'repeat_one' : 'repeat'} size={20} filled={repeatMode !== 'none'} />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-6 mt-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="text-white/50 hover:text-white h-7 w-7"
              onClick={() => setMuted(!muted)}>
              <Icon name={muted || volume === 0 ? 'volume_off' : 'volume_up'} size={16} />
            </Button>
            <Slider value={[muted ? 0 : volume]} max={1} step={0.01} onValueChange={handleVolumeChange} className="w-24" />
          </div>
          <div className="flex items-center gap-1">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
              <button key={rate} onClick={() => setPlaybackRate(rate)}
                className={`px-2 py-0.5 rounded text-[12px] transition-colors ${
                  playbackRate === rate ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'
                }`}>{rate}x</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
