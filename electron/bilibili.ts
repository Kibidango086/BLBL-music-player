import { net, session } from 'electron'
import type { IncomingMessage } from 'http'

const API_BASE = 'https://api.bilibili.com'

function request(url: string, options?: { headers?: Record<string, string>; method?: string; body?: string }): Promise<{ statusCode: number; headers: Record<string, string | string[]>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = net.request({
      url,
      method: options?.method || 'GET',
      session: session.defaultSession,
      useSessionCookies: true
    })

    req.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    req.setHeader('Referer', 'https://www.bilibili.com/')

    if (options?.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        req.setHeader(k, v)
      }
    }

    req.on('response', (res: IncomingMessage) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data
        })
      })
    })

    req.on('error', reject)
    if (options?.body) {
      req.write(options.body)
    }
    req.end()
  })
}

async function fetchBiliAPI(url: string) {
  const { statusCode, body } = await request(url)
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}`)
  const data = JSON.parse(body)
  if (data.code !== 0) throw new Error(data.message || `API Error: ${data.code}`)
  return data.data
}

function adaptSearchResult(item: any): any {
  return {
    bvid: item.bvid || '',
    aid: item.aid || 0,
    title: item.title || '无标题',
    description: item.description || '',
    pic: item.pic || '',
    duration: typeof item.duration === 'number' ? item.duration : 0,
    owner: {
      mid: item.owner?.mid || item.mid || 0,
      name: item.owner?.name || item.author || 'Unknown',
      face: item.owner?.face || ''
    },
    stat: {
      view: item.stat?.view || item.play || 0,
      like: item.stat?.like || 0,
      coin: item.stat?.coin || 0,
      favorite: item.stat?.favorite || 0
    },
    pubdate: item.pubdate || item.senddate || Date.now() / 1000
  }
}

export async function searchBilibili(keyword: string, page = 1, pageSize = 20) {
  const url = `${API_BASE}/x/web-interface/search/type?keyword=${encodeURIComponent(keyword)}&search_type=video&page=${page}&page_size=${pageSize}`
  const data = await fetchBiliAPI(url)
  const results = data.result || []
  return results.map(adaptSearchResult)
}

export async function getVideoInfo(bvid: string) {
  const url = `${API_BASE}/x/web-interface/view?bvid=${bvid}`
  const data = await fetchBiliAPI(url)
  return {
    bvid: data.bvid || bvid,
    aid: data.aid || 0,
    title: data.title || '无标题',
    description: data.desc || '',
    pic: data.pic || '',
    duration: typeof data.duration === 'number' ? data.duration : 0,
    owner: {
      mid: data.owner?.mid || 0,
      name: data.owner?.name || 'Unknown',
      face: data.owner?.face || ''
    },
    stat: {
      view: data.stat?.view || 0,
      like: data.stat?.like || 0,
      coin: data.stat?.coin || 0,
      favorite: data.stat?.favorite || 0
    },
    pubdate: data.pubdate || Date.now() / 1000,
    cid: data.cid
  }
}

export async function getPlayUrl(bvid: string, cid: number) {
  const url = `${API_BASE}/x/player/playurl?bvid=${bvid}&cid=${cid}&fnval=16&platform=web`
  const data = await fetchBiliAPI(url)
  const results: { url: string; quality: number; format: string }[] = []

  if (data.dash && data.dash.audio && Array.isArray(data.dash.audio) && data.dash.audio.length > 0) {
    for (const audio of data.dash.audio) {
      const audioUrl = audio.baseUrl || audio.base_url || audio.url || audio.backupUrl?.[0] || audio.backup_url?.[0]
      if (audioUrl) {
        results.push({ url: audioUrl, quality: audio.id || 0, format: audio.codecs || 'audio/mp4' })
      }
    }
  }

  if (results.length === 0 && data.durl && Array.isArray(data.durl) && data.durl.length > 0) {
    for (const item of data.durl) {
      const url = item.url || item.backup_url?.[0]
      if (url) results.push({ url, quality: item.size || 0, format: 'audio/mp4' })
    }
  }

  return results
}

export interface FavFolder {
  id: number
  mid: number
  title: string
  media_count: number
  cover: string
}

export async function getUserFavFolders(mid: number) {
  const url = `${API_BASE}/x/v3/fav/folder/created/list-all?up_mid=${mid}`
  const data = await fetchBiliAPI(url)
  return (data.list || []) as FavFolder[]
}

export async function getFavFolderContent(mediaId: number, page = 1, pageSize = 20) {
  const url = `${API_BASE}/x/v3/fav/resource/list?media_id=${mediaId}&pn=${page}&ps=${pageSize}&platform=web`
  const data = await fetchBiliAPI(url)
  return (data.medias || []) as any[]
}

async function getCsrf(): Promise<string> {
  try {
    const cookies = await session.defaultSession.cookies.get({ url: 'https://www.bilibili.com' })
    const csrfCookie = cookies.find(c => c.name === 'bili_jct')
    if (csrfCookie?.value) return csrfCookie.value
    const apiCookies = await session.defaultSession.cookies.get({ url: 'https://api.bilibili.com' })
    const apiCsrf = apiCookies.find(c => c.name === 'bili_jct')
    return apiCsrf?.value || ''
  } catch {
    return ''
  }
}

export async function createFavFolder(title: string, intro: string, privacy: number) {
  const csrf = await getCsrf()
  if (!csrf) throw new Error('csrf 校验失败：请先登录并确保 cookie 中包含 bili_jct')

  const body = new URLSearchParams({ title, intro, privacy: String(privacy), csrf })
  const { body: resBody } = await request(`${API_BASE}/x/v3/fav/folder/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://www.bilibili.com', 'Origin': 'https://www.bilibili.com' },
    body: body.toString()
  })

  const json = JSON.parse(resBody)
  if (json.code !== 0) throw new Error(json.message || `API Error: ${json.code}`)
  return json.data
}

export async function addVideosToFavFolder(aidList: number[], mediaId: number) {
  const csrf = await getCsrf()
  if (!csrf) throw new Error('csrf 校验失败：请先登录并确保 cookie 中包含 bili_jct')
  if (aidList.length === 0) return []

  const errors: string[] = []
  for (const aid of aidList) {
    const body = new URLSearchParams({
      rid: String(aid),
      type: '2',
      add_media_ids: String(mediaId),
      csrf
    })
    try {
      const { body: resBody } = await request(`${API_BASE}/x/v3/fav/resource/deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://www.bilibili.com', 'Origin': 'https://www.bilibili.com' },
        body: body.toString()
      })
      const json = JSON.parse(resBody)
      if (json.code !== 0) {
        errors.push(`${aid}: ${json.message || json.code}`)
      }
    } catch (err: any) {
      errors.push(`${aid}: ${err.message}`)
    }
  }

  if (errors.length > 0 && errors.length === aidList.length) {
    throw new Error(`全部添加失败: ${errors.slice(0, 3).join('; ')}`)
  }
  return { total: aidList.length, failed: errors.length, errors }
}

export async function getLoginStatus(): Promise<{ isLogin: boolean; mid?: number; uname?: string; face?: string }> {
  try {
    const url = `${API_BASE}/x/web-interface/nav`
    const data = await fetchBiliAPI(url)
    return { isLogin: data.isLogin, mid: data.mid, uname: data.uname, face: data.face }
  } catch {
    return { isLogin: false }
  }
}
