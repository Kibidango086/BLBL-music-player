import { useRef, useEffect, useState, useCallback } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useSurroundStore } from '@/store/surroundStore'
import { useToastStore } from '@/store/toastStore'
import { useI18nStore } from '@/i18n'
import { surroundEngine } from '@/lib/surroundAudio'
import { getVideoInfo, getPlayUrl } from '@/lib/bilibili-api'

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [errorCount, setErrorCount] = useState(0)
const { 
    currentTrack, 
    isPlaying, 
    volume, 
    muted, 
    playbackRate,
    repeatMode,
    currentTime,
    setPlaying,
    setCurrentTime,
    setDuration,
    updateCurrentTrackCid,
    playNext,
    playPrevious
  } = usePlayerStore()

  // 深度环绕音
  const surroundEnabled = useSurroundStore((s) => s.enabled)
  const surroundMode = useSurroundStore((s) => s.mode)
  const surroundDepth = useSurroundStore((s) => s.depth)
  const surroundSpeed = useSurroundStore((s) => s.speed)
  const surroundDirection = useSurroundStore((s) => s.direction)
  const surroundWidth = useSurroundStore((s) => s.width)
  const showToast = useToastStore((s) => s.showToast)
  const t = useI18nStore((s) => s.t)

  // Load audio URL when track changes
  useEffect(() => {
    if (!currentTrack) {
      setAudioSrc(null)
      setErrorCount(0)
      return
    }

    let cancelled = false
    setErrorCount(0)

    async function loadAudio() {
      try {
        const info = await getVideoInfo(currentTrack!.bvid)
        if (!info.cid) {
          console.error('No cid found for video:', currentTrack!.bvid)
          return
        }
        // Store CID for subtitle fetching later
        updateCurrentTrackCid(info.cid)
        const urls = await getPlayUrl(currentTrack!.bvid, info.cid)
        if (urls.length > 0 && !cancelled) {
          setAudioSrc(urls[0].url)
        } else {
          console.error('No audio URL found for video:', currentTrack!.bvid)
        }
      } catch (err) {
        console.error('Failed to load audio:', err)
      }
    }

    loadAudio()
    return () => {
      cancelled = true
    }
  }, [currentTrack])

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying && audioSrc) {
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.error('Play error:', err)
          if (err.name !== 'AbortError') {
            setPlaying(false)
          }
        })
      }
    } else {
      audio.pause()
    }
  }, [isPlaying, audioSrc, setPlaying])

  // Restore playback position only on initial load (app start)
  const isFirstLoadRef = useRef(true)

  useEffect(() => {
    if (!audioSrc || !audioRef.current || !isFirstLoadRef.current) return
    if (currentTime === 0) {
      isFirstLoadRef.current = false
      return
    }

    const audio = audioRef.current
    const restorePosition = () => {
      if (audio.duration > 0) {
        audio.currentTime = Math.min(currentTime, audio.duration)
      }
      isFirstLoadRef.current = false
    }

    if (audio.duration > 0) {
      restorePosition()
    } else {
      audio.addEventListener('loadedmetadata', restorePosition, { once: true })
    }
  }, [audioSrc, currentTime])

  // Handle volume
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

  // Handle mute
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = muted
  }, [muted])

  // Handle playback rate
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = playbackRate
  }, [playbackRate])

  // ---- 深度环绕音 ----
  // 把 <audio> 交给环绕引擎；引擎只有在实测音源可用后才会真正接管音频输出
  useEffect(() => {
    surroundEngine.attach(audioRef.current, {
      onActivated: () => showToast(t('surround.activated'), 'success'),
      onUnsupported: () => showToast(t('surround.unsupported'), 'error')
    })
  }, [showToast, t])

  useEffect(() => {
    surroundEngine.apply({
      enabled: surroundEnabled,
      mode: surroundMode,
      depth: surroundDepth,
      speed: surroundSpeed,
      direction: surroundDirection,
      width: surroundWidth
    })
  }, [
    surroundEnabled,
    surroundMode,
    surroundDepth,
    surroundSpeed,
    surroundDirection,
    surroundWidth
  ])

  // 切歌后音源会变，需要让引擎重新校验并接管
  useEffect(() => {
    surroundEngine.notifySourceChange()
  }, [audioSrc])

  useEffect(() => {
    if (isPlaying) surroundEngine.resume()
  }, [isPlaying, audioSrc])

  // Media Session API
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    const ms = navigator.mediaSession
    ms.setActionHandler('play', () => setPlaying(true))
    ms.setActionHandler('pause', () => setPlaying(false))
    ms.setActionHandler('previoustrack', () => playPrevious())
    ms.setActionHandler('nexttrack', () => playNext())

    return () => {
      ms.setActionHandler('play', null)
      ms.setActionHandler('pause', null)
      ms.setActionHandler('previoustrack', null)
      ms.setActionHandler('nexttrack', null)
    }
  }, [setPlaying, playNext, playPrevious])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!currentTrack) {
      navigator.mediaSession.metadata = null
      return
    }

    const artist = currentTrack.owner?.name || 'Bilibili'
    const title = currentTrack.title.replace(/<[^>]+>/g, '') || 'Unknown'
    const artwork = currentTrack.pic ? [{ src: currentTrack.pic, sizes: '512x512', type: 'image/jpeg' }] : []

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: 'BLBL Music',
      artwork
    })
  }, [currentTrack])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(Math.floor(audio.currentTime))
  }, [setCurrentTime])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setDuration(audio.duration || 0)
  }, [setDuration])

  const handleEnded = useCallback(() => {
    if (repeatMode === 'one') {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }
    } else {
      playNext()
    }
  }, [playNext, repeatMode])

  const handleError = useCallback(() => {
    console.error('Audio element error')
    setErrorCount((c) => c + 1)
    if (errorCount >= 2) {
      playNext()
    } else {
      const audio = audioRef.current
      if (audio && audioSrc) {
        audio.load()
        audio.play().catch(() => {})
      }
    }
  }, [errorCount, audioSrc, playNext])

  return (
    <audio
      ref={audioRef}
      src={audioSrc || undefined}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onEnded={handleEnded}
      onError={handleError}
      preload="metadata"
    />
  )
}
