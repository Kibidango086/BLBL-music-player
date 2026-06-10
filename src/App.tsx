import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useProxyStore } from '@/store/proxyStore'
import { Sidebar } from '@/components/Sidebar'
import { SearchView } from '@/components/SearchView'
import { PlaylistView } from '@/components/PlaylistView'
import { SettingsView } from '@/components/SettingsView'
import { FavoritesView } from '@/components/FavoritesView'
import { PlayerBar } from '@/components/PlayerBar'
import { AudioPlayer } from '@/components/AudioPlayer'
import { TitleBar } from '@/components/TitleBar'
import { ToastContainer } from '@/components/ToastContainer'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { PlaylistItem } from '@/types'

const ImmersivePlayer = lazy(() => import('@/components/ImmersivePlayer'))

type View = 'search' | 'playlist' | 'settings' | 'favorites'

function App() {
  const [currentView, setCurrentView] = useState<View>('search')
  const [activeFav, setActiveFav] = useState<{ id: number; name: string } | null>(null)
  const [immersive, setImmersive] = useState(false)
  const [slideOut, setSlideOut] = useState(false)
  const { playlist, addToPlaylist, setCurrentTrack, currentTrack } = usePlayerStore()
  const { proxyRules, applyProxy } = useProxyStore()

  useEffect(() => {
    if (proxyRules) {
      applyProxy()
    }
  }, [proxyRules, applyProxy])

  const handlePlay = useCallback(
    (video: PlaylistItem) => {
      if (!playlist.some((t) => t.bvid === video.bvid)) {
        addToPlaylist(video)
      }
      setCurrentTrack(video)
    },
    [playlist, addToPlaylist, setCurrentTrack]
  )

  const handleAddToPlaylist = useCallback(
    (video: PlaylistItem) => {
      addToPlaylist(video)
    },
    [addToPlaylist]
  )

  const handleViewChange = (view: View) => {
    setCurrentView(view)
    if (view !== 'favorites') setActiveFav(null)
  }

  const handleFavSelect = (id: number, name: string) => {
    setActiveFav({ id, name })
    setCurrentView('favorites')
  }

  // Enter immersive: slide panels out, then show immersive player
  const handleEnterImmersive = () => {
    if (!currentTrack) return
    setSlideOut(true)
    setTimeout(() => {
      setImmersive(true)
    }, 350)
  }

  // Exit immersive: hide player first, then slide panels back
  const handleExitImmersive = () => {
    setImmersive(false)
    setTimeout(() => setSlideOut(false), 50)
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      <TitleBar />
      <ToastContainer />
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        <AudioPlayer />

        {/* Sidebar slides left */}
        <div className={`transition-transform duration-300 ease-in-out flex-shrink-0 ${slideOut ? '-translate-x-[calc(100%+20px)]' : 'translate-x-0'}`}>
          <Sidebar
            currentView={currentView}
            onViewChange={handleViewChange}
            activeFavId={activeFav?.id ?? null}
            onFavSelect={handleFavSelect}
          />
        </div>

        {/* Main content slides right */}
        <div className={`flex-1 flex flex-col min-w-0 transition-transform duration-300 ease-in-out ${slideOut ? 'translate-x-[calc(100%+20px)]' : 'translate-x-0'}`}>
          <div className="flex-1 overflow-y-auto">
            {currentView === 'search' && (
              <SearchView onPlay={handlePlay} onAddToPlaylist={handleAddToPlaylist} />
            )}
            {currentView === 'playlist' && <PlaylistView onPlay={handlePlay} />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'favorites' && activeFav && (
              <FavoritesView
                mediaId={activeFav.id}
                folderName={activeFav.name}
                onBack={() => handleViewChange('search')}
                onPlay={handlePlay}
                onAddToPlaylist={handleAddToPlaylist}
              />
            )}
          </div>

          {/* Player bar stays with main content, slides together */}
          <div className={`flex-shrink-0 px-3 pb-3 ${slideOut ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
            <div className="bg-card border border-border rounded-[14px] backdrop-blur-sm shadow">
              <PlayerBar onAlbumClick={handleEnterImmersive} />
            </div>
          </div>
        </div>
      </div>

      {/* Immersive player — lazy loaded to avoid PixiJS blocking startup */}
      {immersive && (
        <Suspense fallback={<div className="fixed inset-0 z-[100] bg-background flex items-center justify-center"><span className="animate-spin material-symbols-rounded text-primary text-4xl">progress_activity</span></div>}>
          <ErrorBoundary>
            <ImmersivePlayer
              onClose={handleExitImmersive}
            />
          </ErrorBoundary>
        </Suspense>
      )}
    </div>
  )
}

export default App
