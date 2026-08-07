import { app, BrowserWindow, ipcMain, shell, session, nativeTheme } from 'electron'
import path from 'path'
import fs from 'fs'

app.setName('blbl-music-player')

// Force WebGL availability (Chromium GPU blacklist workaround, critical for AMLL/PixiJS)
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-webgl')

import {
  searchBilibili,
  getVideoInfo,
  getPlayUrl,
  getUserFavFolders,
  getFavFolderContent,
  createFavFolder,
  addVideosToFavFolder,
  getLoginStatus,
  getVideoSubtitles
} from './bilibili'

let mainWindow: BrowserWindow | null = null

function getIconPath(): string | undefined {
  if (process.platform === 'darwin') return undefined
  const candidates = [
    path.join(__dirname, '../dist/icon.svg'),
    path.join(__dirname, '../../public/icon.svg'),
    path.join(process.cwd(), 'dist/icon.svg'),
    path.join(process.cwd(), 'public/icon.svg'),
    path.join(process.cwd(), 'icon.svg')
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return undefined
}

const createWindow = () => {
  const icon = getIconPath()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden' as const,
    ...(icon ? { icon } : {}),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#ffffff',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

ipcMain.handle('bili-search', async (_event, keyword: string, page?: number, pageSize?: number) => {
  return await searchBilibili(keyword, page, pageSize)
})

ipcMain.handle('bili-video-info', async (_event, bvid: string) => {
  return await getVideoInfo(bvid)
})

ipcMain.handle('bili-play-url', async (_event, bvid: string, cid: number) => {
  return await getPlayUrl(bvid, cid)
})

ipcMain.handle('bili-popular', async () => {
  return []
})

ipcMain.handle('bili-subtitles', async (_event, bvid: string, cid: number, title?: string) => {
  return await getVideoSubtitles(bvid, cid, title)
})

ipcMain.handle('bili-login-status', async () => {
  return await getLoginStatus()
})

ipcMain.handle('bili-fav-folders', async (_event, mid: number) => {
  return await getUserFavFolders(mid)
})

ipcMain.handle('bili-fav-content', async (_event, mediaId: number, page?: number, pageSize?: number) => {
  return await getFavFolderContent(mediaId, page, pageSize)
})

ipcMain.handle('bili-create-fav', async (_event, title: string, intro: string, privacy: number) => {
  return await createFavFolder(title, intro, privacy)
})

ipcMain.handle('bili-add-to-fav', async (_event, aidList: number[], mediaId: number) => {
  return await addVideosToFavFolder(aidList, mediaId)
})

ipcMain.handle('bili-set-cookies', async (_event, cookies: { name: string; value: string }[]) => {
  try {
    const oneYearLater = Date.now() / 1000 + 365 * 24 * 60 * 60
    for (const cookie of cookies) {
      if (!cookie.value) continue
      // A .bilibili.com domain cookie covers www/api/passport and all other
      // subdomains, so one set per cookie is enough.
      await session.defaultSession.cookies.set({
        url: 'https://www.bilibili.com',
        name: cookie.name,
        value: cookie.value,
        domain: '.bilibili.com',
        path: '/',
        secure: true,
        sameSite: 'no_restriction' as const,
        expirationDate: oneYearLater
      })
    }
    const status = await getLoginStatus()
    return { success: status.isLogin, status }
  } catch (err: any) {
    return { success: false, error: err?.message || '设置 Cookie 失败' }
  }
})

ipcMain.handle('bili-open-login', async () => {
  return new Promise<{ success: boolean; message?: string }>((resolve) => {
    const loginWin = new BrowserWindow({
      width: 520,
      height: 720,
      parent: mainWindow || undefined,
      modal: true,
      title: '登录 Bilibili',
      backgroundColor: '#ffffff',
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      }
    })

    loginWin.loadURL('https://passport.bilibili.com/h5-app/passport/login', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    loginWin.once('ready-to-show', () => {
      loginWin?.show()
    })

    let resolved = false
    const finish = (success: boolean, message?: string) => {
      if (resolved) return
      resolved = true
      loginWin.close()
      resolve({ success, message })
    }

    loginWin.webContents.on('did-navigate', async (_event, url) => {
      if (url.includes('bilibili.com') && !url.includes('passport')) {
        setTimeout(async () => {
          try {
            const status = await getLoginStatus()
            if (status.isLogin) finish(true)
          } catch {}
        }, 1500)
      }
    })

    loginWin.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, validatedURL) => {
      if (validatedURL.includes('passport.bilibili.com')) {
        loginWin.loadURL('https://passport.bilibili.com/login', {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
      }
    })

    loginWin.on('closed', () => {
      finish(false, '登录窗口已关闭')
    })
  })
})

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const url = new URL(details.url)
    if (url.hostname.includes('bilibili.com') || url.hostname.includes('bilivideo.com') || url.hostname.includes('hdslb.com')) {
      details.requestHeaders['Referer'] = 'https://www.bilibili.com'
      details.requestHeaders['Origin'] = 'https://www.bilibili.com'
    }
    callback({ requestHeaders: details.requestHeaders })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

ipcMain.handle('open-external', async (_event, url: string) => {
  await shell.openExternal(url)
})

let proxyCredentials: { username?: string; password?: string } = {}

ipcMain.handle('set-proxy', async (_event, config: { rules: string; username?: string; password?: string }) => {
  try {
    proxyCredentials = { username: config.username, password: config.password }
    await session.defaultSession.setProxy({ proxyRules: config.rules || undefined })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || '设置代理失败' }
  }
})

ipcMain.handle('get-proxy', async () => {
  try {
    const rules = await session.defaultSession.resolveProxy('https://www.bilibili.com')
    return { rules }
  } catch {
    return { rules: '' }
  }
})
