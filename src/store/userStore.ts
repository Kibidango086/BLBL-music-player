import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LoginStatus, FavFolder } from '@/types'

interface UserStore {
  loginStatus: LoginStatus | null
  favFolders: FavFolder[]
  isLoadingLogin: boolean

  setLoginStatus: (status: LoginStatus | null) => void
  setFavFolders: (folders: FavFolder[]) => void
  setLoadingLogin: (loading: boolean) => void
  logout: () => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      loginStatus: null,
      favFolders: [],
      isLoadingLogin: false,

      setLoginStatus: (status) => set({ loginStatus: status }),
      setFavFolders: (folders) => set({ favFolders: folders }),
      setLoadingLogin: (loading) => set({ isLoadingLogin: loading }),
      logout: () => set({ loginStatus: null, favFolders: [] })
    }),
    {
      name: 'blbl-user-storage',
      partialize: (state) => ({
        loginStatus: state.loginStatus
      })
    }
  )
)
