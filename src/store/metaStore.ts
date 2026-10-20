import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Music, type TrackMeta } from '@/mygo'

/** What the user typed for a track, which wins over anything looked up. */
export interface TrackOverride {
  song?: string
  artist?: string
  cover?: string
}

interface StoredMeta extends TrackMeta {
  /** The question this answer belongs to, so an edit asks again. */
  query?: string
}

interface MetaStore {
  overrides: Record<string, TrackOverride>
  metas: Record<string, StoredMeta>
  pending: Record<string, boolean>
  lookup: (bvid: string, title: string) => Promise<void>
  setOverride: (bvid: string, title: string, patch: TrackOverride) => Promise<void>
  clearOverride: (bvid: string, title: string) => Promise<void>
}

function queryOf(title: string, override?: TrackOverride): string {
  return [title, override?.song ?? '', override?.artist ?? ''].join('\u0000')
}

export const useMetaStore = create<MetaStore>()(
  persist(
    (set, get) => ({
      overrides: {},
      metas: {},
      pending: {},

      lookup: async (bvid, title) => {
        if (!bvid) return
        const { overrides, metas, pending } = get()
        const override = overrides[bvid]
        const query = queryOf(title, override)
        if (pending[bvid] || metas[bvid]?.query === query) return
        set((s) => ({ pending: { ...s.pending, [bvid]: true } }))
        try {
          const meta = await Music.lookup(title, override?.song ?? '', override?.artist ?? '')
          set((s) => ({ metas: { ...s.metas, [bvid]: { ...meta, query } } }))
        } catch (err) {
          console.error('[meta]', err)
        } finally {
          set((s) => ({ pending: { ...s.pending, [bvid]: false } }))
        }
      },

      setOverride: async (bvid, title, patch) => {
        set((s) => ({ overrides: { ...s.overrides, [bvid]: { ...s.overrides[bvid], ...patch } } }))
        await get().lookup(bvid, title)
      },

      clearOverride: async (bvid, title) => {
        set((s) => {
          const overrides = { ...s.overrides }
          delete overrides[bvid]
          const metas = { ...s.metas }
          delete metas[bvid]
          return { overrides, metas }
        })
        await get().lookup(bvid, title)
      }
    }),
    { name: 'blbl-meta-storage' }
  )
)

/** The cover of a track: the user's, the database's, or the video's. */
export function useTrackCover(bvid: string | undefined, fallback: string): string {
  return useMetaStore(
    (s) => (bvid && (s.overrides[bvid]?.cover || s.metas[bvid]?.cover)) || fallback
  )
}

/** What the track is called: the user's name, the database's, or the title. */
export function useTrackName(bvid: string | undefined, videoTitle: string): string {
  return useMetaStore(
    (s) => (bvid && (s.overrides[bvid]?.song || s.metas[bvid]?.title)) || videoTitle
  )
}

/** Who made it: the user's artist, the database's, or nothing. */
export function useTrackArtist(bvid: string | undefined, fallback: string): string {
  return useMetaStore(
    (s) => (bvid && (s.overrides[bvid]?.artist || s.metas[bvid]?.artist)) || fallback
  )
}

/** Everything known about the track, for the editor. */
export function useTrackMeta(bvid: string | undefined) {
  const override = useMetaStore((s) => (bvid ? s.overrides[bvid] : undefined))
  const meta = useMetaStore((s) => (bvid ? s.metas[bvid] : undefined))
  const pending = useMetaStore((s) => (bvid ? !!s.pending[bvid] : false))
  return { override, meta, pending }
}
