export interface BilibiliVideo {
  bvid: string
  aid: number
  title: string
  description: string
  pic: string
  duration: number
  owner: {
    mid: number
    name: string
    face: string
  }
  stat: {
    view: number
    like: number
    coin: number
    favorite: number
  }
  pubdate: number
  cid?: number
}

export interface PlayUrl {
  url: string
  quality: number
  format: string
}

export interface PlaylistItem extends BilibiliVideo {
  addedAt: number
}

export type RepeatMode = 'none' | 'one' | 'all'

export interface FavFolder {
  id: number
  mid: number
  title: string
  media_count: number
  cover: string
}

export interface LoginStatus {
  isLogin: boolean
  mid?: number
  uname?: string
  face?: string
}

export interface ElectronAPI {
  platform: string
  minimize: () => void
  maximize: () => void
  close: () => void
  biliSearch: (keyword: string, page?: number, pageSize?: number) => Promise<any[]>
  biliVideoInfo: (bvid: string) => Promise<any>
  biliPlayUrl: (bvid: string, cid: number) => Promise<any[]>
  biliPopular: () => Promise<any[]>
  biliLoginStatus: () => Promise<LoginStatus>
  biliOpenLogin: () => Promise<{ success: boolean; message?: string }>
  biliFavFolders: (mid: number) => Promise<FavFolder[]>
  biliFavContent: (mediaId: number, page?: number, pageSize?: number) => Promise<any[]>
  biliSetCookies: (cookies: { name: string; value: string }[]) => Promise<{ success: boolean; status?: LoginStatus; error?: string }>
  biliCreateFav: (title: string, intro: string, privacy: number) => Promise<any>
  biliAddToFav: (aidList: number[], mediaId: number) => Promise<any>
  setProxy: (config: { rules: string; username?: string; password?: string }) => Promise<{ success: boolean; error?: string }>
  getProxy: () => Promise<{ rules: string }>
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
