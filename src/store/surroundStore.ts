import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  SURROUND_DEFAULTS,
  clampNumber,
  SURROUND_LIMITS,
  type SurroundConfig,
  type SurroundDirection,
  type SurroundMode
} from '@/lib/surroundAudio'

interface SurroundStore extends SurroundConfig {
  setEnabled: (enabled: boolean) => void
  toggle: () => void
  setMode: (mode: SurroundMode) => void
  setDepth: (depth: number) => void
  setSpeed: (speed: number) => void
  setDirection: (direction: SurroundDirection) => void
  setWidth: (width: number) => void
  reset: () => void
}

export const useSurroundStore = create<SurroundStore>()(
  persist(
    (set, get) => ({
      ...SURROUND_DEFAULTS,

      setEnabled: (enabled) => set({ enabled }),
      toggle: () => set({ enabled: !get().enabled }),
      setMode: (mode) => set({ mode }),
      setDepth: (depth) =>
        set({ depth: Math.round(clampNumber(depth, SURROUND_LIMITS.depth.min, SURROUND_LIMITS.depth.max)) }),
      setSpeed: (speed) =>
        set({ speed: Math.round(clampNumber(speed, SURROUND_LIMITS.speed.min, SURROUND_LIMITS.speed.max)) }),
      setDirection: (direction) => set({ direction }),
      setWidth: (width) =>
        set({ width: Math.round(clampNumber(width, SURROUND_LIMITS.width.min, SURROUND_LIMITS.width.max)) }),
      reset: () => set({ ...SURROUND_DEFAULTS, enabled: true })
    }),
    { name: 'blbl-surround-storage' }
  )
)
