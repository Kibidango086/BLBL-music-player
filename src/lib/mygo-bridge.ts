// The bridge from the Electron app to MyGo.
//
// The app's components talk to the desktop through `window.electronAPI`, which
// the Electron preload script exposed. The port keeps every component as it
// was and implements that same object here on top of the MyGo runtime and the
// Go services `mygo generate` writes into src/mygo.ts:
//
//   electronAPI.biliSearch          -> Bilibili.search               (Go)
//   electronAPI.biliPlayUrl         -> Bilibili.playURL              (Go, through bili://)
//   electronAPI.minimize/maximize   -> mygo-runtime's currentWindow
//   electronAPI.openExternal        -> System.OpenExternal           (Go)
//   electronAPI.setProxy/getProxy   -> System.SetProxy/GetProxy      (Go)

import { currentWindow, isMyGo, runtime } from "mygo-runtime";
import { Bilibili, System } from "@/mygo";
import { setImageProxyBase } from "@/lib/media";
import type { ElectronAPI } from "@/types";

/** The platform, as Electron's `process.platform` named it. */
function detectPlatform(): string {
  try {
    if (isMyGo()) return runtime().platform;
  } catch {
    // Not a MyGo window: a browser tab of the dev server.
  }
  const ua = navigator.userAgent;
  if (/Macintosh|Mac OS X/.test(ua)) return "darwin";
  if (/Windows/.test(ua)) return "win32";
  return "linux";
}

const platform = detectPlatform();

function windowAction(action: (win: typeof currentWindow) => Promise<unknown>): void {
  if (!isMyGo()) return;
  action(currentWindow).catch((err: unknown) => {
    console.error("[window]", err);
  });
}

/** Reads the addresses Go serves pictures and audio at, before the app
 *  renders, so that pictures can be rewritten as they render. */
export async function initMediaProxy(): Promise<void> {
  if (!isMyGo()) return;
  try {
    setImageProxyBase(await System.imageURL());
  } catch (err) {
    console.error("[pictures]", err);
  }
}

/** Marks the document when the webview draws on the GPU, which the stylesheet
 *  reads to decide whether the page may animate. */
export async function initRendering(): Promise<void> {
  if (!isMyGo()) return;
  try {
    const gpu = await System.gpu();
    document.documentElement.classList.toggle("composited", gpu.compositing);
  } catch (err) {
    console.error("[gpu]", err);
  }
}

/** Installs the desktop API the components call, once, before they render. */
export function installElectronAPI(): void {
  if (typeof window === "undefined") return;
  const holder = window as Window & { electronAPI?: ElectronAPI };
  if (holder.electronAPI) return;

  const api: ElectronAPI = {
    platform,

    minimize: () => windowAction((w) => w.minimize()),
    maximize: () => windowAction((w) => w.toggleMaximize()),
    close: () => windowAction((w) => w.close()),

    biliSearch: (keyword, page = 1, pageSize = 20) =>
      Bilibili.search(keyword, page, pageSize),

    biliVideoInfo: (bvid) => Bilibili.videoInfo(bvid),

    // The audio plays from a server on this machine that Go runs: it fetches
    // the stream with bilibili's headers and through the app's proxy, and its
    // response lets Web Audio read the samples, which the surround effect
    // needs. A custom scheme cannot feed the webview's media pipeline.
    biliPlayUrl: async (bvid, cid) => {
      const streams = await Bilibili.playURL(bvid, cid);
      // The best quality this webview can decode: FLAC where GStreamer has it,
      // otherwise the highest AAC. Bilibili offers all of them, in no order.
      const probe = document.createElement("audio");
      const playable = streams.filter((s) => !s.format || probe.canPlayType(s.format) !== "");
      const chosen = playable.length > 0 ? playable : streams;
      return Promise.all(
        chosen.map(async (stream) => ({
          ...stream,
          url: await System.streamURL(stream.url),
        })),
      );
    },

    biliPopular: () => Bilibili.popular(),

    biliLoginStatus: () => Bilibili.loginStatus(),

    biliOpenLogin: () => Bilibili.openLogin(),

    biliFavFolders: (mid) => Bilibili.favFolders(mid),

    biliFavContent: (mediaId, page = 1, pageSize = 20) =>
      Bilibili.favContent(mediaId, page, pageSize),

    biliSetCookies: (cookies) => Bilibili.setCookies(cookies),

    biliCreateFav: (title, intro, privacy) =>
      Bilibili.createFav(title, intro, privacy),

    biliAddToFav: (aidList, mediaId) => Bilibili.addToFav(aidList, mediaId),

    biliSubtitles: (bvid, cid, title = "", artist = "") =>
      Bilibili.subtitles(bvid, cid, title, artist),

    setProxy: async (config) => {
      const result = await System.setProxy(
        config.rules ?? "",
        config.username ?? "",
        config.password ?? "",
      );
      return { success: result.success, error: result.error };
    },

    getProxy: async () => ({ rules: (await System.getProxy()).rules }),

    openExternal: async (url) => {
      await System.openExternal(url);
    },
  };

  holder.electronAPI = api;
}
