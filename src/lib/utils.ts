import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function decodeHtml(html: string | null | undefined): string {
  if (!html) return ''
  const txt = document.createElement('textarea')
  txt.innerHTML = html
  return txt.value
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '')
}

export function safeGet<T>(obj: any, path: string, fallback: T): T {
  try {
    const parts = path.split('.')
    let current = obj
    for (const part of parts) {
      if (current == null) return fallback
      current = current[part]
    }
    return current ?? fallback
  } catch {
    return fallback
  }
}

/**
 * Strip thumbnail params from Bilibili CDN URLs to get the highest resolution.
 * URLs like `.../xxx.jpg@320w_200h` become `.../xxx.jpg`
 */
export function getHighResPic(url: string | undefined | null): string {
  if (!url) return ''
  const idx = url.indexOf('@')
  if (idx !== -1) return url.slice(0, idx)
  return url
}
