import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  biliSearch: (keyword: string, page?: number, pageSize?: number) =>
    ipcRenderer.invoke('bili-search', keyword, page, pageSize),
  biliVideoInfo: (bvid: string) =>
    ipcRenderer.invoke('bili-video-info', bvid),
  biliPlayUrl: (bvid: string, cid: number) =>
    ipcRenderer.invoke('bili-play-url', bvid, cid),
  biliPopular: () =>
    ipcRenderer.invoke('bili-popular'),
  biliLoginStatus: () =>
    ipcRenderer.invoke('bili-login-status'),
  biliOpenLogin: () =>
    ipcRenderer.invoke('bili-open-login'),
  biliFavFolders: (mid: number) =>
    ipcRenderer.invoke('bili-fav-folders', mid),
  biliFavContent: (mediaId: number, page?: number, pageSize?: number) =>
    ipcRenderer.invoke('bili-fav-content', mediaId, page, pageSize),
  biliSetCookies: (cookies: { name: string; value: string }[]) =>
    ipcRenderer.invoke('bili-set-cookies', cookies),
  biliCreateFav: (title: string, intro: string, privacy: number) =>
    ipcRenderer.invoke('bili-create-fav', title, intro, privacy),
  biliAddToFav: (aidList: number[], mediaId: number) =>
    ipcRenderer.invoke('bili-add-to-fav', aidList, mediaId),
  biliSubtitles: (bvid: string, cid: number) =>
    ipcRenderer.invoke('bili-subtitles', bvid, cid),

  setProxy: (config: { rules: string; username?: string; password?: string }) =>
    ipcRenderer.invoke('set-proxy', config),
  getProxy: () => ipcRenderer.invoke('get-proxy'),

  openExternal: (url: string) => ipcRenderer.invoke('open-external', url)
})

export type ElectronAPI = typeof window.electronAPI
