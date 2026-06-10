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

function TextFallback({ lines, currentTime, fontSize, showOriginal, showTranslation, showRoman }:
  { lines: LyricData[]; currentTime: number; fontSize: number; showOriginal: boolean; showTranslation: boolean; showRoman: boolean }) {
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
      padding: '50vh 16px',
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
          {lines.map((line, i) => {
            const isLineActive = i === idx
            const hasRoman = !!(showRoman && line.romanLyric)
            // Word-level timing: check each word against currentTime
            const words = line.words || []
            const wordActive = words.map((w: any) =>
              currentTime >= w.startTime && currentTime <= w.endTime
            )

            return (
              <p key={i} style={{
                textAlign: 'center',
                padding: `${hasRoman ? 4 : 8}px 16px`,
                fontSize: isLineActive ? `${fontSize}px` : `${Math.round(fontSize * 0.68)}px`,
                fontWeight: isLineActive ? 700 : 400,
                color: isLineActive ? '#fff' : 'rgba(255,255,255,0.3)',
                transform: isLineActive ? 'scale(1.05)' : 'scale(1)',
                textShadow: isLineActive ? '0 0 24px rgba(255,255,255,0.3)' : 'none',
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'default',
                lineHeight: 1.4
              }}>
                {showRoman && line.romanLyric && (
                  <span style={{
                    display: 'block',
                    fontSize: `${Math.round(fontSize * 0.5)}px`,
                    color: isLineActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                    marginBottom: '2px',
                    fontStyle: 'italic'
                  }}>{line.romanLyric}</span>
                )}
                {showOriginal && words.length > 0 && (
                  <span>
                    {words.map((w: any, wi: number) => (
                      <span key={wi} style={{
                        color: wordActive[wi]
                          ? '#fff'
                          : isLineActive
                            ? 'rgba(255,255,255,0.7)'
                            : 'inherit',
                        fontWeight: wordActive[wi] ? 700 : 'inherit',
                        textShadow: wordActive[wi] ? '0 0 16px rgba(255,255,255,0.4)' : 'none',
                        transition: 'color 0.15s, text-shadow 0.15s'
                      }}>{w.word}</span>
                    ))}
                  </span>
                )}
                {showTranslation && line.translatedLyric && (
                  <span style={{
                    display: 'block',
                    fontSize: `${Math.round(fontSize * 0.65)}px`,
                    color: isLineActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.15)',
                    marginTop: line.romanLyric && showRoman ? '0' : '2px'
                  }}>{line.translatedLyric}</span>
                )}
              </p>
            )
          })}
        </>
      )}
    </div>
  )
}

function AmllWrapper({ lines, currentTime, isPlaying, fontSize, showOriginal, showTranslation, showRoman }:
  { lines: LyricData[]; currentTime: number; isPlaying: boolean; fontSize: number; showOriginal: boolean; showTranslation: boolean; showRoman: boolean }) {
  const [LyricPlayer, setLyricPlayer] = useState<any>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    import('@applemusic-like-lyrics/react')
      .then(m => setLyricPlayer(() => m.LyricPlayer))
      .catch(() => setLoadError(true))
  }, [])

  if (loadError || !LyricPlayer) {
    return <TextFallback lines={lines} currentTime={currentTime} fontSize={fontSize}
      showOriginal={showOriginal} showTranslation={showTranslation} showRoman={showRoman} />
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
  const [fontSize, setFontSize] = useState(32)
  const [showOriginal, setShowOriginal] = useState(true)
  const [showTranslation, setShowTranslation] = useState(true)
  const [showRoman, setShowRoman] = useState(false)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || e.data.source !== 'blbl-lyrics') return
      switch (e.data.type) {
        case 'update':
          setLyricLines(e.data.lyricLines || [])
          setCurrentTime(e.data.currentTime || 0)
          setIsPlaying(e.data.isPlaying || false)
          if (e.data.fontSize) setFontSize(e.data.fontSize)
          if (typeof e.data.showOriginal === 'boolean') setShowOriginal(e.data.showOriginal)
          if (typeof e.data.showTranslation === 'boolean') setShowTranslation(e.data.showTranslation)
          if (typeof e.data.showRoman === 'boolean') setShowRoman(e.data.showRoman)
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
      <AmllWrapper lines={lyricLines} currentTime={currentTime} isPlaying={isPlaying} fontSize={fontSize}
        showOriginal={showOriginal} showTranslation={showTranslation} showRoman={showRoman} />
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
