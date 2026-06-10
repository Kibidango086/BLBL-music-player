import { useState, useEffect } from 'react'

export function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`blbl-imm-${key}`)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try { localStorage.setItem(`blbl-imm-${key}`, JSON.stringify(state)) } catch {}
  }, [key, state])

  return [state, setState]
}
