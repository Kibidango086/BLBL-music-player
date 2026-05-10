import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlaylistItem, RepeatMode } from '@/types'

interface PlayerStore {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  playbackRate: number
  currentTrack: PlaylistItem | null
  playlist: PlaylistItem[]
  repeatMode: RepeatMode
  shuffle: boolean
  history: PlaylistItem[]
  historyIndex: number

  setPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setPlaybackRate: (rate: number) => void
  setCurrentTrack: (track: PlaylistItem | null) => void
  addToPlaylist: (track: PlaylistItem) => void
  setPlaylist: (playlist: PlaylistItem[]) => void
  removeFromPlaylist: (bvid: string) => void
  clearPlaylist: () => void
  setRepeatMode: (mode: RepeatMode) => void
  toggleShuffle: () => void
  playNext: () => void
  playPrevious: () => void
  reorderPlaylist: (playlist: PlaylistItem[]) => void
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      muted: false,
      playbackRate: 1,
      currentTrack: null,
      playlist: [],
      repeatMode: 'all',
      shuffle: false,
      history: [],
      historyIndex: -1,

      setPlaying: (playing) => set({ isPlaying: playing }),
      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration }),
      setVolume: (volume) => set({ volume }),
      setMuted: (muted) => set({ muted }),
      setPlaybackRate: (rate) => set({ playbackRate: rate }),
      setCurrentTrack: (track) => set({ currentTrack: track, currentTime: 0, isPlaying: !!track }),

      addToPlaylist: (track) =>
        set((state) => {
          if (state.playlist.some((t) => t.bvid === track.bvid)) return state
          return { playlist: [...state.playlist, track] }
        }),

      setPlaylist: (playlist) => set({ playlist }),

      removeFromPlaylist: (bvid) =>
        set((state) => ({
          playlist: state.playlist.filter((t) => t.bvid !== bvid),
          currentTrack: state.currentTrack?.bvid === bvid ? null : state.currentTrack
        })),

      clearPlaylist: () => set({ playlist: [], currentTrack: null, isPlaying: false }),

      setRepeatMode: (mode) => set({ repeatMode: mode }),
      toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

      playNext: () => {
        const { playlist, currentTrack, repeatMode, shuffle } = get()
        if (playlist.length === 0) return

        if (repeatMode === 'one' && currentTrack) {
          set({ currentTime: 0, isPlaying: true })
          return
        }

        let nextIndex = 0
        if (currentTrack) {
          const currentIndex = playlist.findIndex((t) => t.bvid === currentTrack.bvid)
          if (shuffle) {
            nextIndex = Math.floor(Math.random() * playlist.length)
          } else {
            nextIndex = (currentIndex + 1) % playlist.length
          }
        }

        const nextTrack = playlist[nextIndex]
        if (nextTrack) {
          set({ currentTrack: nextTrack, currentTime: 0, isPlaying: true })
        }
      },

      playPrevious: () => {
        const { playlist, currentTrack, repeatMode, shuffle } = get()
        if (playlist.length === 0) return

        if (repeatMode === 'one' && currentTrack) {
          set({ currentTime: 0, isPlaying: true })
          return
        }

        let prevIndex = playlist.length - 1
        if (currentTrack) {
          const currentIndex = playlist.findIndex((t) => t.bvid === currentTrack.bvid)
          if (shuffle) {
            prevIndex = Math.floor(Math.random() * playlist.length)
          } else {
            prevIndex = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1
          }
        }

        const prevTrack = playlist[prevIndex]
        if (prevTrack) {
          set({ currentTrack: prevTrack, currentTime: 0, isPlaying: true })
        }
      },

      reorderPlaylist: (playlist) => set({ playlist })
    }),
    {
      name: 'blbl-player-storage',
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        playbackRate: state.playbackRate,
        playlist: state.playlist.map(t => ({
          bvid: t.bvid,
          aid: t.aid,
          title: t.title,
          pic: t.pic,
          duration: t.duration,
          owner: t.owner,
          stat: t.stat,
          pubdate: t.pubdate,
          addedAt: t.addedAt
        })),
        currentTrack: state.currentTrack,
        currentTime: state.currentTime,
        isPlaying: state.isPlaying,
        repeatMode: state.repeatMode,
        shuffle: state.shuffle
      })
    }
  )
)
