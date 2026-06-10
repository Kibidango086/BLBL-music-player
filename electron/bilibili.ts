import { net, session } from 'electron'
import type { IncomingMessage } from "http"
import crypto from 'crypto'
import { searchAMLLDB, type LyricLine } from './amll-db'

const API_BASE = 'https://api.bilibili.com'

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 52, 44, 34
]

let cachedWbiKey = ''
let cachedWbiKeyTime = 0

async function getWbiKey(): Promise<string> {
  const now = Date.now()
  if (cachedWbiKey && now - cachedWbiKeyTime < 3600000) return cachedWbiKey
  try {
    const res = await request(`${API_BASE}/x/web-interface/nav`)
    const data = JSON.parse(res.body)
    const imgUrl: string = data?.data?.wbi_img?.img_url || ''
    const subUrl: string = data?.data?.wbi_img?.sub_url || ''
    const imgKey = imgUrl.split('/').pop()?.split('.')[0] || ''
    const subKey = subUrl.split('/').pop()?.split('.')[0] || ''
    const raw = imgKey + subKey
    cachedWbiKey = MIXIN_KEY_ENC_TAB.map(i => raw[i] || '').join('')
    cachedWbiKeyTime = now
    return cachedWbiKey
  } catch {
    return cachedWbiKey
  }
}

function signWbi(params: Record<string, string | number>, mixinKey: string) {
  const wts = Math.floor(Date.now() / 1000)
  const all = { ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), wts: String(wts) }
  const sorted = Object.keys(all).sort().map(k => `${k}=${encodeURIComponent(all[k])}`).join('&')
  const w_rid = crypto.createHash('md5').update(sorted + mixinKey).digest('hex')
  return { w_rid, wts }
}


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
  let picUrl = item.pic || ''
  if (picUrl && !picUrl.startsWith('http')) {
    picUrl = picUrl.startsWith('//') ? 'https:' + picUrl : picUrl
  }

  let faceUrl = item.owner?.face || ''
  if (faceUrl && !faceUrl.startsWith('http')) {
    faceUrl = faceUrl.startsWith('//') ? 'https:' + faceUrl : faceUrl
  }

  let duration = 0
  if (typeof item.duration === 'number') {
    duration = item.duration
  } else if (typeof item.duration === 'string') {
    const parts = item.duration.split(':')
    if (parts.length === 2) {
      duration = parseInt(parts[0]) * 60 + parseInt(parts[1])
    }
  }

  return {
    bvid: item.bvid || '',
    aid: item.aid || 0,
    title: item.title || '无标题',
    description: item.description || '',
    pic: picUrl,
    duration: duration,
    owner: {
      mid: item.owner?.mid || item.mid || 0,
      name: item.owner?.name || item.author || 'Unknown',
      face: faceUrl
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
  let picUrl = data.pic || ''
  if (picUrl && !picUrl.startsWith('http')) {
    picUrl = picUrl.startsWith('//') ? 'https:' + picUrl : picUrl
  }
  let faceUrl = data.owner?.face || ''
  if (faceUrl && !faceUrl.startsWith('http')) {
    faceUrl = faceUrl.startsWith('//') ? 'https:' + faceUrl : faceUrl
  }
  return {
    bvid: data.bvid || bvid,
    aid: data.aid || 0,
    title: data.title || '无标题',
    description: data.desc || '',
    pic: picUrl,
    duration: typeof data.duration === 'number' ? data.duration : 0,
    owner: {
      mid: data.owner?.mid || 0,
      name: data.owner?.name || 'Unknown',
      face: faceUrl
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

export interface SubtitleItem {
  from: number
  to: number
  content: string
  translation?: string
  roman?: string
}


export async function getVideoSubtitles(bvid: string, cid: number, title?: string): Promise<LyricLine[]> {
  console.log(`[Subtitle] === Fetching for bvid=${bvid} cid=${cid} title="${title || ''}" ===`)

  try {
    // Step 0: Try AMLL database first
    if (title) {
      console.log('[Subtitle] Trying AMLL DB search...')
      const amllResult = await searchAMLLDB(title)
      if (amllResult.length > 0) {
        console.log(`[Subtitle] ✅ Using AMLL: ${amllResult.length} lines`)
        return amllResult
      }
      console.log('[Subtitle] AMLL not found, falling back to Bilibili')
    }

    // Step 1: Get video info to find the EXACT page CID
    const viewUrl = `${API_BASE}/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`
    const viewRes = await request(viewUrl)
    if (viewRes.statusCode !== 200) { console.log('[Subtitle] View API HTTP err'); return [] }
    const viewData = JSON.parse(viewRes.body)
    if (viewData.code !== 0) { console.log('[Subtitle] View API code err'); return [] }

    const aid = viewData.data?.aid || 0
    const pages: any[] = viewData.data?.pages || []
    let targetCid = cid
    if (!targetCid && pages.length > 0) targetCid = pages[0].cid

    const targetPage = pages.find((p: any) => p.cid === targetCid)
    if (!targetPage) { console.log(`[Subtitle] No page for cid=${targetCid}`); return [] }

    console.log(`[Subtitle] Matched: cid=${targetCid} aid=${aid} part="${targetPage.part || ''}"`)

    // Step 2: Try WBI-signed player API ONLY (non-WBI returns wrong cached data)
    const mixinKey = await getWbiKey()

    let bestSubs: any[] = []
    let usedEndpoint = ''

    // WBI endpoints first (correct data)
    if (mixinKey) {
      // WBI + bvid
      const bvidSigned = signWbi({ bvid, cid: String(targetCid) }, mixinKey)
      const wbiBvidUrl = `${API_BASE}/x/player/wbi/v2?bvid=${encodeURIComponent(bvid)}&cid=${targetCid}&w_rid=${bvidSigned.w_rid}&wts=${bvidSigned.wts}`
      const res1 = await request(wbiBvidUrl)
      if (res1.statusCode === 200) {
        const d = JSON.parse(res1.body)
        if (d.code === 0) {
          const subs = d.data?.subtitle?.subtitles || []
          console.log(`[Subtitle] wbi+bvid → subs=${subs.length}`)
          if (subs.length > 0) { bestSubs = subs; usedEndpoint = 'wbi+bvid' }
        }
      }
    }

    if (bestSubs.length === 0 && mixinKey) {
      // WBI + aid
      const aidSigned = signWbi({ aid: String(aid), cid: String(targetCid) }, mixinKey)
      const wbiAidUrl = `${API_BASE}/x/player/wbi/v2?aid=${aid}&cid=${targetCid}&w_rid=${aidSigned.w_rid}&wts=${aidSigned.wts}`
      const res2 = await request(wbiAidUrl)
      if (res2.statusCode === 200) {
        const d = JSON.parse(res2.body)
        if (d.code === 0) {
          const subs = d.data?.subtitle?.subtitles || []
          console.log(`[Subtitle] wbi+aid → subs=${subs.length}`)
          if (subs.length > 0) { bestSubs = subs; usedEndpoint = 'wbi+aid' }
        }
      }
    }

    // Non-WBI endpoint is UNRELIABLE — returns stale cached data from wrong videos.
    // WBI is the browser's endpoint. If WBI says 0, the video truly has no subtitles.

    if (bestSubs.length === 0) { console.log('[Subtitle] No subs'); return [] }

    // Step 3: Try all subtitle entries, prefer Chinese, first valid wins
    const ordered = [
      ...bestSubs.filter((s: any) => s.lan === 'zh-Hans' || s.lan === 'zh-CN'),
      ...bestSubs.filter((s: any) => !(s.lan === 'zh-Hans' || s.lan === 'zh-CN')),
    ]

    for (const sub of ordered) {
      if (!sub.subtitle_url) continue
      let subUrl: string = sub.subtitle_url
      if (subUrl.startsWith('//')) subUrl = 'https:' + subUrl
      if (!subUrl.startsWith('http')) subUrl = 'https:' + subUrl

      console.log(`[Subtitle] Trying ${sub.lan_doc || sub.lan}: ${subUrl.substring(0, 80)}...`)

      const subRes = await request(subUrl)
      if (subRes.statusCode !== 200) { console.log(`[Subtitle] HTTP ${subRes.statusCode}`); continue }

      const subData = JSON.parse(subRes.body)
      const items: SubtitleItem[] = (subData?.body || []).map((item: any) => ({
        from: typeof item.from === 'number' ? item.from : 0,
        to: typeof item.to === 'number' ? item.to : 0,
        content: item.content || ''
      })).filter((i: SubtitleItem) => i.content.trim())

      if (items.length > 0) {
        console.log(`[Subtitle] ✅ ${items.length} lines (${sub.lan_doc || sub.lan})`)
        console.log(`[Subtitle] Sample:`, items.slice(0, 2).map(i => `[${i.from}-${i.to}] ${i.content}`))
        return items.map(i => ({
          words: [{ word: i.content, startTime: Math.floor(i.from * 1000), endTime: Math.floor(i.to * 1000) }],
          startTime: Math.floor(i.from * 1000),
          endTime: Math.floor(i.to * 1000),
          translatedLyric: '',
          romanLyric: '',
          isBG: false,
          isDuet: false
        }))
      }
    }

    console.log('[Subtitle] All subtitle URLs returned empty')
    return []
  } catch (err) {
    console.error('[Subtitle] Error:', err)
    return []
  }
}
