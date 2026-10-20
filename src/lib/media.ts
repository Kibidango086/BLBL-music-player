// bilibili's CDN answers 403 to a picture whose Referer is not bilibili's, and
// the webview's requests carry the app's own. The Electron app sent bilibili's
// Referer for every request (onBeforeSendHeaders); the port fetches the
// pictures in Go instead, which sends it, through the app's proxy, and serves
// them from a server on this machine.
//
// Every picture of the app goes through getHighResPic(), which strips
// bilibili's sizing parameters from a URL, and through LazyImage: both rewrite
// the URL with imageURL() here.

const BILI_HOSTS = ["hdslb.com", "biliimg.com", "bilibili.com", "bilivideo.com"];

let proxyBase = "";

/** Sets the address Go serves pictures at, as the app starts. */
export function setImageProxyBase(base: string): void {
  proxyBase = base;
}

function isBilibiliPicture(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BILI_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

/** The URL a picture is loaded from: bilibili's own cover, at the width asked
 *  for, fetched by Go, which sends the Referer its CDN wants. */
export function imageURL(raw: string | null | undefined, width?: number): string {
  if (!raw) return "";
  if (proxyBase && raw.startsWith(proxyBase)) return raw;
  const at = raw.indexOf("@");
  let clean = at >= 0 ? raw.slice(0, at) : raw;
  if (!/^https?:\/\//i.test(clean)) return clean;
  if (!isBilibiliPicture(clean)) return clean;
  // The CDN resizes on request: "@480w.jpg" is a 480px wide JPEG, and
  // 121 kB of cover becomes 13 kB. A 48px thumbnail needs no 4K source.
  if (width && /\.(jpe?g|webp)$/i.test(clean)) clean = `${clean}@${width}w.jpg`;
  if (!proxyBase) return clean;
  return proxyBase + encodeURIComponent(clean);
}
