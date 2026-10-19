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

/** The URL a picture is loaded from: the fastest cover bilibili has, fetched
 *  by Go when it is one of bilibili's, and the URL itself otherwise. */
export function imageURL(raw: string | null | undefined): string {
  if (!raw) return "";
  if (proxyBase && raw.startsWith(proxyBase)) return raw;
  const at = raw.indexOf("@");
  const clean = at >= 0 ? raw.slice(0, at) : raw;
  if (!proxyBase || !/^https?:\/\//i.test(clean) || !isBilibiliPicture(clean)) return clean;
  return proxyBase + encodeURIComponent(clean);
}
