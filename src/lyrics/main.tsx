import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'

// AMLL will be imported dynamically at runtime — no top-level await needed

interface LyricData {
  words: { word: string; startTime: number; endTime: number }[]
  startTime: number
  endTime: number
  translatedLyric: string
  romanLyric: string
  isBG: boolean
  isDuet: boolean
}

function TextFallback({ lines, currentTime }: { lines: LyricData[]; currentTime: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sec = currentTime / 1000
  const idx = lines.findIndex(l => sec >= l.startTime / 1000 && sec <= l.endTime / 1000)

  useEffect(() => {
    if (idx >= 0 && containerRef.current) {
      const el = containerRef.current.children[idx] as HTMLElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [idx])

  return (
    <div ref={containerRef} style={{
      padding: '40px 16px',
      height: '100%',
      overflowY: 'auto',
      background: 'transparent',
      scrollBehavior: 'smooth',
      overscrollBehavior: 'contain'
    }}>
      {lines.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingTop: '40px', fontSize: '14px' }}>暂无歌词</p>
      ) : (
        <>
          {/* Top spacer for first line centering */}
          <div style={{ height: '40%', minHeight: '80px' }} />
          {lines.map((line, i) => {
            const isActive = i === idx
            const text = line.words?.map(w => w.word).join('') || ''
            return (
              <p key={i} style={{
                textAlign: 'center',
                padding: '8px 0',
                fontSize: isActive ? '22px' : '15px',
                fontWeight: isActive ? 700 : 400,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.3)',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                textShadow: isActive ? '0 0 24px rgba(255,255,255,0.3)' : 'none',
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'default'
              }}>{text}</p>
            )
          })}
          {/* Bottom spacer for last line centering */}
          <div style={{ height: '40%', minHeight: '80px' }} />
        </>
      )}
    </div>
  )
}

function AmllWrapper({ lines, currentTime, isPlaying }: { lines: LyricData[]; currentTime: number; isPlaying: boolean }) {
  const [LyricPlayer, setLyricPlayer] = useState<any>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    import('@applemusic-like-lyrics/react')
      .then(m => setLyricPlayer(() => m.LyricPlayer))
      .catch(() => setLoadError(true))
  }, [])

  if (loadError || !LyricPlayer) {
    return <TextFallback lines={lines} currentTime={currentTime} />
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <LyricPlayer
        lyricLines={lines}
        currentTime={currentTime}
        playing={isPlaying}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

function LyricsApp() {
  const [lyricLines, setLyricLines] = useState<LyricData[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || e.data.source !== 'blbl-lyrics') return
      switch (e.data.type) {
        case 'update':
          setLyricLines(e.data.lyricLines || [])
          setCurrentTime(e.data.currentTime || 0)
          setIsPlaying(e.data.isPlaying || false)
          break
        case 'clear':
          setLyricLines([])
          setCurrentTime(0)
          break
      }
    }
    window.addEventListener('message', handler)
    window.parent.postMessage({ source: 'blbl-lyrics-iframe', type: 'ready' }, '*')
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <AmllWrapper lines={lyricLines} currentTime={currentTime} isPlaying={isPlaying} />
    </div>
  )
}

// Error boundary
class ErrorCatcher extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch() {
    window.parent.postMessage({ source: 'blbl-lyrics-iframe', type: 'error', error: 'Lyrics render crashed' }, '*')
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>🎵 歌词渲染出错</div>
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorCatcher>
    <LyricsApp />
  </ErrorCatcher>
)
