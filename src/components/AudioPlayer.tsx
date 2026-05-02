import { useRef, useEffect, useState, useCallback } from 'react'
import { usePlayerStore } from '@/store/playerStore'
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
    setPlaying,
    setCurrentTime,
    setDuration,
    playNext,
    playPrevious
  } = usePlayerStore()

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
    setCurrentTime(audio.currentTime)
  }, [setCurrentTime])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setDuration(audio.duration || 0)
  }, [setDuration])

  const handleEnded = useCallback(() => {
    playNext()
  }, [playNext])

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
