import { useState, useEffect, useCallback, useMemo } from 'react'
import { LyricPlayer } from '@applemusic-like-lyrics/react'
import '@applemusic-like-lyrics/core/style.css'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { getVideoSubtitles } from '@/lib/bilibili-api'
import { getHighResPic, stripHtml } from '@/lib/utils'
import { formatDuration } from '@/lib/bilibili-api'
import { useI18nStore } from '@/i18n'
import { usePlayerStore } from '@/store/playerStore'
import { usePersistedState } from '@/lib/usePersistedState'

interface ImmersivePlayerProps { onClose: () => void }

const SIZE_MAP: Record<string, number> = { tiny: 14, xs: 18, sm: 22, md: 28, lg: 34, xl: 42, huge: 52 }
const SIZE_KEYS = ['tiny', 'xs', 'sm', 'md', 'lg', 'xl', 'huge'] as const

export default function ImmersivePlayer({ onClose }: ImmersivePlayerProps) {
  const { t } = useI18nStore()
  const {
    currentTrack, isPlaying, currentTime, duration, volume, muted,
    playbackRate, repeatMode, shuffle,
    setPlaying, setCurrentTime, setVolume, setMuted,
    setPlaybackRate, setRepeatMode, toggleShuffle, playNext, playPrevious
  } = usePlayerStore()

  const [lyricLines, setLyricLines] = useState<any[]>([])
  const [lyricLoading, setLyricLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Persisted settings — lyric content
  const [showTrans, setShowTrans] = usePersistedState('showTrans', true)
  const [showRom, setShowRom] = usePersistedState('showRom', false)
  const [swapTransRom, setSwapTransRom] = usePersistedState('swapTransRom', false)

  // Persisted settings — lyric appearance
  const [enableBlur, setEnableBlur] = usePersistedState('enableBlur', true)
  const [enableScale, setEnableScale] = usePersistedState('enableScale', true)
  const [enableSpring, setEnableSpring] = usePersistedState('enableSpring', true)
  const [hidePassed, setHidePassed] = usePersistedState('hidePassed', false)
  const [wordFade, setWordFade] = usePersistedState('wordFade', 0.5)
  const [fontSize, setFontSize] = usePersistedState('fontSize', 'md')
  const [bgCover, setBgCover] = usePersistedState('bgCover', true)
  const [alignPos, setAlignPos] = usePersistedState('alignPos', 0.5)

  // Persisted settings — music info
  const [showName, setShowName] = usePersistedState('showName', true)
  const [showArtist, setShowArtist] = usePersistedState('showArtist', true)

  const lrcTime = Math.floor(currentTime * 1000)

  useEffect(() => {
    if (!currentTrack?.bvid) return
    setLyricLoading(true)
    setLyricLines([])
    getVideoSubtitles(currentTrack.bvid, currentTrack.cid || 0, stripHtml(currentTrack.title))
      .then(s => setLyricLines(s))
      .catch(() => setLyricLines([]))
      .finally(() => setLyricLoading(false))
  }, [currentTrack?.bvid, currentTrack?.cid])

  const displayLines = useMemo(() => lyricLines.map(l => {
    const line: any = { ...l }
    if (!showTrans) line.translatedLyric = ''
    if (!showRom) line.romanLyric = ''
    if (swapTransRom && showTrans && showRom) {
      [line.translatedLyric, line.romanLyric] = [line.romanLyric, line.translatedLyric]
    }
    return line
  }), [lyricLines, showTrans, showRom, swapTransRom])

  const handleSeek = useCallback((v: number[]) => {
    const a = document.querySelector('audio') as HTMLAudioElement
    if (a) { a.currentTime = v[0]; setCurrentTime(v[0]) }
  }, [setCurrentTime])

  if (!currentTrack) return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center" onClick={onClose}>
      <p className="text-muted-foreground">{t('player.chooseSong')}</p>
    </div>
  )

  const title = stripHtml(currentTrack.title)
  const pic = getHighResPic(currentTrack.pic || '')
  const owner = currentTrack.owner?.name || t('common.unknown')

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{
      background: bgCover && pic
        ? `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.85)), url(${pic}) center/cover no-repeat`
        : '#111'
    }}>
      {bgCover && pic && (
        <div className="absolute inset-0 backdrop-blur-xl" style={{ WebkitBackdropFilter: 'blur(40px)' }} />
      )}

      {/* Top bar — subtle, full on hover */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 opacity-25 hover:opacity-100 transition-opacity duration-500">
        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white h-10 w-10" onClick={onClose}>
          <Icon name="keyboard_arrow_down" size={28} />
        </Button>
        {(showName || showArtist) && (
          <div className="text-center">
            {showName && <p className="text-white/80 text-sm font-medium">{title}</p>}
            {showArtist && <p className="text-white/40 text-xs">{owner}</p>}
          </div>
        )}
        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white h-10 w-10" onClick={() => setShowSettings(!showSettings)}>
          <Icon name="tune" size={24} />
        </Button>
      </div>

      {/* Settings panel — organized by sections matching amll-page */}
      {showSettings && (
        <div className="absolute right-4 top-16 z-20 p-4 rounded-2xl bg-card border border-border shadow w-64 max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 pointer-events-auto">
          <h3 className="text-sm font-bold text-foreground mb-3">{t('immersive.title')}</h3>

          <div className="space-y-3">
            {/* Content */}
            <Section label={t('immersive.section.content')} />
            <Toggle label={t('immersive.showTranslation')} v={showTrans} set={setShowTrans} />
            <Toggle label={t('immersive.showRoman')} v={showRom} set={setShowRom} />
            {showTrans && showRom && (
              <Toggle label={t('immersive.swapTransRoman')} v={swapTransRom} set={setSwapTransRom} />
            )}

            {/* Appearance */}
            <Section label={t('immersive.section.appearance')} />
            <label className="flex items-center justify-between text-xs text-muted-foreground">
              {t('immersive.fontSize')}
              <div className="flex gap-0.5">
                {SIZE_KEYS.map(k => (
                  <button key={k} onClick={() => setFontSize(k)}
                    className={`w-7 h-5 rounded text-[10px] font-medium transition-colors ${fontSize === k ? 'bg-primary text-primary-fg' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                  >{SIZE_MAP[k]}</button>
                ))}
              </div>
            </label>
            <Toggle label={t('immersive.blur')} v={enableBlur} set={setEnableBlur} />
            <Toggle label={t('immersive.scale')} v={enableScale} set={setEnableScale} />
            <Toggle label={t('immersive.spring')} v={enableSpring} set={setEnableSpring} />
            <Toggle label={t('immersive.hidePassed')} v={hidePassed} set={setHidePassed} />
            <label className="block text-xs text-muted-foreground">
              {t('immersive.wordFade')} ({(wordFade * 100).toFixed(0)}%)
              <Slider value={[wordFade]} min={0} max={2} step={0.1} onValueChange={v => setWordFade(v[0])} className="mt-1" />
            </label>

            {/* Music info */}
            <Section label={t('immersive.section.musicInfo')} />
            <Toggle label={t('immersive.showName')} v={showName} set={setShowName} />
            <Toggle label={t('immersive.showArtist')} v={showArtist} set={setShowArtist} />
            <Toggle label={t('immersive.bgCover')} v={bgCover} set={setBgCover} />

            {/* Position */}
            <Section label={t('immersive.section.position')} />
            <label className="block text-xs text-muted-foreground">
              {t('immersive.alignPos')} ({(alignPos * 100).toFixed(0)}%)
              <Slider value={[alignPos]} min={0} max={1} step={0.05} onValueChange={v => setAlignPos(v[0])} className="mt-1" />
            </label>
          </div>
        </div>
      )}

      {/* Lyrics — fills available space with stable container */}
      <div className="flex-1 relative z-10 min-h-0" style={{ '--amll-lp-font-size': `${SIZE_MAP[fontSize]}px` } as React.CSSProperties}>
        <div className="absolute inset-0 flex items-center justify-center" style={{
          isolation: 'isolate', transformStyle: 'flat', contain: 'layout style paint',
        }}>
          {lyricLoading ? (
            <div className="flex items-center justify-center gap-2 text-white/40">
              <Icon name="progress_activity" size={18} className="animate-spin" />{t('immersive.loading')}
            </div>
          ) : lyricLines.length === 0 ? (
            <div className="text-white/20 text-sm">{t('immersive.noLyrics')}</div>
          ) : (
            <LyricPlayer
              lyricLines={displayLines}
              currentTime={lrcTime}
              playing={isPlaying}
              alignPosition={alignPos}
              enableBlur={enableBlur}
              enableScale={enableScale}
              enableSpring={enableSpring}
              hidePassedLines={hidePassed}
              wordFadeWidth={wordFade}
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </div>
      </div>

      {/* Controls — subtle, full on hover */}
      <div className="relative z-20 px-8 pb-6 pt-2 flex-shrink-0 opacity-20 hover:opacity-100 transition-opacity duration-500">
        <div className="max-w-2xl mx-auto mb-3">
          <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={handleSeek} />
          <div className="flex justify-between text-[11px] text-white/50 font-mono mt-1">
            <span>{formatDuration(Math.floor(currentTime))}</span>
            <span>{formatDuration(Math.floor(duration))}</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 max-w-2xl mx-auto">
          <Ctl icon="shuffle" active={shuffle} onClick={toggleShuffle} />
          <Ctl icon="skip_previous" onClick={playPrevious} />
          <Button size="icon" className="h-12 w-12 rounded-full bg-white text-black hover:scale-105 transition-transform"
            onClick={() => setPlaying(!isPlaying)}>
            <Icon name={isPlaying ? 'pause' : 'play_arrow'} size={24} />
          </Button>
          <Ctl icon="skip_next" onClick={playNext} />
          <Ctl icon={repeatMode === 'one' ? 'repeat_one' : 'repeat'}
            active={repeatMode !== 'none'}
            onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')} />
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          <Button size="icon" variant="ghost" className="text-white/40 hover:text-white h-6 w-6" onClick={() => setMuted(!muted)}>
            <Icon name={muted || volume === 0 ? 'volume_off' : 'volume_up'} size={14} />
          </Button>
          <Slider value={[muted ? 0 : volume]} max={1} step={0.01} onValueChange={v => { setVolume(v[0]); if (v[0] > 0 && muted) setMuted(false) }} className="w-20" />
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
            <button key={r} onClick={() => setPlaybackRate(r)}
              className={`px-2 py-0.5 rounded text-[11px] ${playbackRate === r ? 'bg-white/20 text-white' : 'text-white/35 hover:text-white/60'}`}>{r}x</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Section({ label }: { label: string }) {
  return <p className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wide pt-1">{label}</p>
}

function Toggle({ label, v, set }: { label: string; v: boolean; set: (x: boolean) => void }) {
  return <label className="flex items-center justify-between text-xs text-muted-foreground">{label}
    <button onClick={() => set(!v)} className={`w-9 h-5 rounded-full transition-colors ${v ? 'bg-primary' : 'bg-muted'}`}>
      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${v ? 'translate-x-[18px]' : 'translate-x-px'}`} style={{ margin: 1 }} />
    </button>
  </label>
}

function Ctl({ icon, active, onClick }: { icon: string; active?: boolean; onClick: () => void }) {
  return <Button size="icon" variant="ghost" className={`h-9 w-9 ${active ? 'text-white' : 'text-white/50 hover:text-white'}`} onClick={onClick}><Icon name={icon} size={18} filled={active} /></Button>
}
