import { net, session, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { type SubtitleItem } from './bilibili'

const INDEX_URL = 'https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/metadata/raw-lyrics-index.jsonl'
const RAW_BASE = 'https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/raw-lyrics'

interface LyricEntry {
  musicName: string
  artists: string[]
  album: string
  rawLyricFile: string
}

let searchIndex: LyricEntry[] | null = null
let indexLoaded = false

function getCachePath(): string {
  const userData = app.getPath('userData')
  const cacheDir = path.join(userData, 'amll-cache')
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
  return cacheDir
}

function request(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, session: session.defaultSession })
    req.setHeader('User-Agent', 'BLBL-Music-Player/2.1')
    let data = ''
    req.on('response', (res) => {
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => resolve(data))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

async function loadIndex(): Promise<LyricEntry[]> {
  if (indexLoaded && searchIndex) return searchIndex

  const cacheDir = getCachePath()
  const cacheFile = path.join(cacheDir, 'amll-index.json')

  // Try cache first (24h TTL)
  try {
    if (fs.existsSync(cacheFile)) {
      const stat = fs.statSync(cacheFile)
      if (Date.now() - stat.mtimeMs < 24 * 60 * 60 * 1000) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
        if (Array.isArray(cached) && cached.length > 0) {
          console.log(`[AMLL] Loaded ${cached.length} entries from cache`)
          searchIndex = cached
          indexLoaded = true
          return cached
        }
      }
    }
  } catch (e) {
    console.log('[AMLL] Cache read failed, re-downloading')
  }

  // Download fresh index
  console.log('[AMLL] Downloading lyrics index...')
  const raw = await request(INDEX_URL)
  const entries: LyricEntry[] = []

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const obj = JSON.parse(line)
      const meta = obj.metadata || []
      const musicName = meta.find((m: any) => m[0] === 'musicName')?.[1]?.[0] || ''
      const artists = meta.find((m: any) => m[0] === 'artists')?.[1] || []
      const album = meta.find((m: any) => m[0] === 'album')?.[1]?.[0] || ''

      if (musicName && obj.rawLyricFile) {
        entries.push({
          musicName,
          artists,
          album,
          rawLyricFile: obj.rawLyricFile
        })
      }
    } catch { /* skip invalid lines */ }
  }

  console.log(`[AMLL] Indexed ${entries.length} songs`)

  // Cache
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(entries), 'utf-8')
  } catch { /* ignore */ }

  searchIndex = entries
  indexLoaded = true
  return entries
}

/**
 * Smart tokenizer: extract possible song names from a Bilibili video title.
 * Example: "【附谱】綾地寧々角色曲「sweet treasure」Quiet Version" → ["sweet treasure", "附谱", "綾地寧々角色曲", "Quiet Version"]
 */
function tokenizeTitle(title: string): string[] {
  const tokens: string[] = []

  // Extract content inside brackets like 「」『』《》""
  const bracketPatterns = [/「([^」]+)」/g, /『([^』]+)』/g, /《([^》]+)》/g, /"([^"]+)"/g, /'([^']+)'/g]
  for (const pattern of bracketPatterns) {
    let match
    while ((match = pattern.exec(title)) !== null) {
      if (match[1].trim()) tokens.push(match[1].trim())
    }
  }

  // Remove bracket content and split on delimiters
  let cleaned = title
    .replace(/【[^】]*】/g, ' ')
    .replace(/「[^」]*」/g, ' ')
    .replace(/『[^』]*』/g, ' ')
    .replace(/《[^》]*》/g, ' ')
    .replace(/"[^"]*"/g, ' ')
    .replace(/[\|｜]/g, ' ')
    .replace(/[-～~—]/g, ' ')
    .replace(/[\/\\]/g, ' ')

  // Split remaining text into words
  const words = cleaned.split(/[\s,，、]+/).filter(w => w.length >= 1)
  for (const w of words) {
    const trimmed = w.trim()
    if (trimmed && !tokens.includes(trimmed)) tokens.push(trimmed)
  }

  return [...new Set(tokens)].filter(t => t.length >= 1)
}

function levenshteinDistance(a: string, b: string): number {
  const lowerA = a.toLowerCase()
  const lowerB = b.toLowerCase()
  const m = lowerA.length, n = lowerB.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = lowerA[i-1] === lowerB[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

async function searchLyrics(title: string): Promise<{ entry: LyricEntry; score: number } | null> {
  const index = await loadIndex()
  if (index.length === 0) {
    console.log('[AMLL] Index empty, skipping search')
    return null
  }

  const tokens = tokenizeTitle(title)
  console.log(`[AMLL] Searching: "${title}" → tokens: [${tokens.join(', ')}]`)

  let best: { entry: LyricEntry; score: number } | null = null

  for (const entry of index) {
    // Exact match on musicName
    if (tokens.some(t => t.toLowerCase() === entry.musicName.toLowerCase())) {
      console.log(`[AMLL] Exact match: "${entry.musicName}" by ${entry.artists.join(', ')}`)
      return { entry, score: 100 }
    }

    // Substring match
    for (const token of tokens) {
      if (token.length < 2) continue
      if (entry.musicName.toLowerCase().includes(token.toLowerCase())) {
        const score = (token.length / entry.musicName.length) * 90
        if (!best || score > best.score) {
          best = { entry, score }
        }
      }
      // Reverse: token contains musicName
      if (token.toLowerCase().includes(entry.musicName.toLowerCase()) && entry.musicName.length >= 2) {
        const score = (entry.musicName.length / token.length) * 85
        if (!best || score > best.score) {
          best = { entry, score }
        }
      }
    }

    // Artist match + token match combination
    for (const artist of entry.artists) {
      for (const token of tokens) {
        if (token.length < 2) continue
        if (artist.toLowerCase().includes(token.toLowerCase()) && best && best.score < 70) {
          // Boost score if artist also matches
          best.score = Math.min(95, best.score + 10)
        }
      }
    }
  }

  // If no substring match found, try close match with Levenshtein on shorter tokens
  if (!best || best.score < 50) {
    for (const entry of index) {
      for (const token of tokens) {
        if (token.length < 3) continue
        const dist = levenshteinDistance(token, entry.musicName)
        const maxLen = Math.max(token.length, entry.musicName.length)
        const similarity = maxLen > 0 ? 1 - dist / maxLen : 0
        if (similarity > 0.7) {
          const score = similarity * 80
          if (!best || score > best.score) {
            best = { entry, score }
          }
        }
      }
    }
  }

  if (best) {
    console.log(`[AMLL] Best match: "${best.entry.musicName}" (score: ${best.score.toFixed(1)})`)
  } else {
    console.log(`[AMLL] No match found`)
  }

  return best
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0
  // "12.34s" → 12.34
  if (/^\d+\.?\d*s?$/.test(timeStr)) return parseFloat(timeStr.replace('s', ''))
  // "12340ms" → 12.34
  if (/^\d+ms$/.test(timeStr)) return parseFloat(timeStr.replace('ms', '')) / 1000
  // "00:00:12.34" → 12.34
  const parts = timeStr.split(':')
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
  }
  // "00:12.34" → 12.34
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1])
  }
  return parseFloat(timeStr) || 0
}

export interface LyricLine {
  words: LyricWord[]
  startTime: number
  endTime: number
  translatedLyric: string
  romanLyric: string
  isBG: boolean
  isDuet: boolean
}

export interface LyricWord {
  word: string
  startTime: number
  endTime: number
}

function parseTTML(ttml: string): LyricLine[] {
  const lines: LyricLine[] = []

  const pTagRegex = /<p\s([^>]*?)>([\s\S]*?)<\/p>/gi
  let match

  while ((match = pTagRegex.exec(ttml)) !== null) {
    const attrs = match[1]
    const innerXML = match[2]

    const beginMatch = attrs.match(/begin="([^"]*)"/)
    const endMatch = attrs.match(/end="([^"]*)"/)
    if (!beginMatch || !endMatch) continue

    const lineFrom = parseTime(beginMatch[1]) * 1000
    const lineTo = parseTime(endMatch[1]) * 1000

    // Extract translation and roman from special spans
    const transMatch = innerXML.match(/<span[^>]*ttm:role="x-translation"[^>]*>([\s\S]*?)<\/span>/)
    const romanMatch = innerXML.match(/<span[^>]*ttm:role="x-roman"[^>]*>([\s\S]*?)<\/span>/)
    const translatedLyric = transMatch?.[1]?.trim() || ''
    const romanLyric = romanMatch?.[1]?.trim() || ''

    // Parse word-level spans (regular spans with begin/end, NOT translation/roman)
    const words: LyricWord[] = []
    const spanRegex = /<span\s([^>]*?)>([\s\S]*?)<\/span>/gi
    let spanMatch

    while ((spanMatch = spanRegex.exec(innerXML)) !== null) {
      const spanAttrs = spanMatch[1]
      // Skip translation and roman spans
      if (spanAttrs.includes('x-translation') || spanAttrs.includes('x-roman')) continue

      const wBeginMatch = spanAttrs.match(/begin="([^"]*)"/)
      const wEndMatch = spanAttrs.match(/end="([^"]*)"/)
      const wordText = spanMatch[2].trim()

      if (wordText && wBeginMatch && wEndMatch) {
        words.push({
          word: wordText,
          startTime: parseTime(wBeginMatch[1]) * 1000,
          endTime: parseTime(wEndMatch[1]) * 1000
        })
      } else if (wordText && words.length > 0) {
        // Span without timing (like amll:empty-beat) — just append to last word
        words[words.length - 1].word += wordText
      }
    }

    // If no word-level spans found, create a single word for the whole line
    if (words.length === 0) {
      let text = innerXML
        .replace(/<span[^>]*ttm:role="x-translation"[^>]*>[\s\S]*?<\/span>/g, '')
        .replace(/<span[^>]*ttm:role="x-roman"[^>]*>[\s\S]*?<\/span>/g, '')
        .replace(/<span[^>]*>/g, '')
        .replace(/<\/span>/g, '')
        .trim()
      if (text) {
        words.push({ word: text, startTime: lineFrom, endTime: lineTo })
      }
    }

    if (words.length > 0 || translatedLyric) {
      lines.push({
        words,
        startTime: words.length > 0 ? words[0].startTime : lineFrom,
        endTime: words.length > 0 ? words[words.length - 1].endTime : lineTo,
        translatedLyric,
        romanLyric,
        isBG: false,
        isDuet: false
      })
    }
  }

  console.log(`[AMLL] Parsed ${lines.length} lines from TTML (avg ${lines.reduce((s, l) => s + l.words.length, 0) / Math.max(1, lines.length)} words/line)`)
  if (lines.length > 0) {
    const l = lines[0]
    console.log(`[AMLL] Sample: [${l.startTime}ms] "${l.words.map(w => w.word).join('')}" tr="${l.translatedLyric}" ro="${l.romanLyric}"`)
  }

  return lines
}

export async function searchAMLLDB(title: string): Promise<SubtitleItem[]> {
  try {
    const result = await searchLyrics(title)
    if (!result) return []

    const ttmlUrl = `${RAW_BASE}/${result.entry.rawLyricFile}`
    console.log(`[AMLL] Downloading: ${ttmlUrl}`)

    const ttml = await request(ttmlUrl)
    const items = parseTTML(ttml)

    if (items.length > 0) {
      console.log(`[AMLL] ✅ Got ${items.length} lines from "${result.entry.musicName}"`)
      console.log(`[AMLL] Sample:`, items.slice(0, 2).map(i => `[${i.from}-${i.to}] ${i.content}`))
    }

    return items
  } catch (err) {
    console.error('[AMLL] Error:', err)
    return []
  }
}
