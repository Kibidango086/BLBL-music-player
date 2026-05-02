import { useState, useCallback, useEffect } from 'react'
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
import type { PlaylistItem } from '@/types'

type View = 'search' | 'playlist' | 'settings' | 'favorites'

function App() {
  const [currentView, setCurrentView] = useState<View>('search')
  const [activeFav, setActiveFav] = useState<{ id: number; name: string } | null>(null)
  const { playlist, addToPlaylist, setCurrentTrack } = usePlayerStore()
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
    if (view !== 'favorites') {
      setActiveFav(null)
    }
  }

  const handleFavSelect = (id: number, name: string) => {
    setActiveFav({ id, name })
    setCurrentView('favorites')
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-[#0a0a0a]">
      <TitleBar />
      <ToastContainer />
      <div className="flex flex-1 min-h-0">
        <AudioPlayer />
        <Sidebar
          currentView={currentView}
          onViewChange={handleViewChange}
          activeFavId={activeFav?.id ?? null}
          onFavSelect={handleFavSelect}
        />
        <main className="flex-1 flex flex-col min-w-0">
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
          <PlayerBar />
        </main>
      </div>
    </div>
  )
}

export default App
