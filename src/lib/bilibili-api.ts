import type { BilibiliVideo, PlayUrl } from '@/types'

export async function searchBilibili(keyword: string, page = 1, pageSize = 20): Promise<BilibiliVideo[]> {
  return await window.electronAPI.biliSearch(keyword, page, pageSize)
}

export async function getVideoInfo(bvid: string): Promise<BilibiliVideo> {
  return await window.electronAPI.biliVideoInfo(bvid)
}

export async function getPlayUrl(bvid: string, cid: number): Promise<PlayUrl[]> {
  return await window.electronAPI.biliPlayUrl(bvid, cid)
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  return num.toString()
}

export interface SubtitleItem {
  from: number
  to: number
  content: string
}

export async function getVideoSubtitles(bvid: string, cid: number): Promise<SubtitleItem[]> {
  try {
    return await window.electronAPI.biliSubtitles(bvid, cid)
  } catch {
    return []
  }
}
