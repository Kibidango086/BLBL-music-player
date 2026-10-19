import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The end-to-end harness.
//
// The app is a native window, so a test cannot type in it. With BLBL_E2E set,
// the dev server — or, to check a packaged build, the build command — adds a
// small script to the page that drives the app the way a person would (a
// search, play, the immersive player) and reports what happened in
// document.title, which the window shows: `xdotool getwindowname` reads it.
// The script is left out unless BLBL_E2E is set.
function e2eHarness(): Plugin {
  return {
    name: "blbl-e2e",
    transformIndexHtml(html) {
      const steps = process.env.BLBL_E2E;
      if (!steps) return html;
      const query = JSON.stringify(process.env.BLBL_E2E_QUERY ?? "夜に駆ける");
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: { type: "module" },
            injectTo: "body",
            children: `const steps = ${JSON.stringify(steps.split(","))};
const query = ${query};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (el) => (el?.textContent ?? "").trim();
let state = "boot";
const audioInfo = () => {
  const a = document.querySelector("audio");
  if (!a) return "a=none";
  return "a=" + a.readyState + "/" + a.networkState + "/" + (a.error ? a.error.code + ":" + a.error.message : "0") +
    "/" + Math.round(a.duration || 0) + "/" + Math.round(a.currentTime || 0) +
    "/" + (a.currentSrc || "").split("/")[0];
};
const canvasInfo = () => {
  const list = [...document.querySelectorAll("canvas")];
  const sizes = list.map((c) => c.width + "x" + c.height + "@" + (c.clientWidth + "x" + c.clientHeight));
  return "c=" + list.length + "[" + sizes.join(",") + "]";
};
const say = (s) => {
  state = s;
  const a = document.querySelector("audio");
  document.title = "E2E " + s + " | " + audioInfo() + " | " + canvasInfo() +
    " | paused=" + (a ? a.paused : "?") + " | playErr=" + (window.__playError || "-");
};
window.addEventListener("error", (e) => {
  const m = e.message || "";
  if (m.includes("ResizeObserver")) return;
  document.title = "E2E JS-ERROR " + m.slice(0, 80);
});
window.addEventListener("unhandledrejection", (e) => { document.title = "E2E JS-REJECT " + String(e.reason).slice(0, 80); });
window.__playError = "";
const nativePlay = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function () {
  const p = nativePlay.call(this);
  if (p) p.catch((err) => { window.__playError = err.name + ":" + err.message; });
  return p;
};
async function search() {
  const input = document.querySelector("input");
  if (!input) return say("no-input");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, query);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(150);
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const cards = document.querySelectorAll("div.group");
    if (cards.length) return say("search:" + cards.length + ":" + text(cards[0].querySelector("h3")).slice(0, 20));
  }
  say("search-timeout");
}
async function play() {
  const cards = document.querySelectorAll("div.group");
  const play = cards[0] && [...cards[0].querySelectorAll("button")].find((b) => text(b) === "play_arrow");
  if (!play) return say("no-play-button");
  play.click();
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const a = document.querySelector("audio");
    if (a && (a.readyState >= 1 || a.error)) return say("play");
  }
  say("play-timeout");
}
async function muteplay() {
  const a = document.querySelector("audio");
  if (!a) return say("no-audio");
  a.muted = true; // a muted element may play without a user gesture
  try { await a.play(); } catch (e) { return say("muteplay-error:" + e.name); }
  const from = a.currentTime;
  await sleep(3000);
  say("muted-from-" + from.toFixed(1) + "-to-" + a.currentTime.toFixed(1) + "-dur-" + Math.round(a.duration));
}
async function immersive() {
  await sleep(1200);
  const art = document.querySelector('[title="进入沉浸播放"]');
  if (!art) return say("no-album");
  art.click();
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    if (document.querySelector("canvas")) return say("immersive");
  }
  say("immersive-no-canvas:" + document.querySelectorAll("div").length);
}
async function login() {
  say("login-opening");
  window.electronAPI.biliOpenLogin().then((r) => say("login-done:" + JSON.stringify(r)));
  await sleep(9000);
  say("login-window-open");
}
async function images() {
  await sleep(2500);
  const imgs = [...document.querySelectorAll("img")].slice(0, 6).map((i) => ({
    s: (i.currentSrc || i.src || "").slice(0, 46),
    w: i.naturalWidth,
    c: i.complete,
  }));
  const bg = [...document.querySelectorAll("div")].map((d) => getComputedStyle(d).backgroundImage)
    .filter((b) => b && b !== "none" && b.includes("url("))[0] || "-";
  const src = (document.querySelector("img") || {}).src || "";
  const tryImg = (url, cross) => new Promise((resolve) => {
    const im = new Image();
    if (cross) im.crossOrigin = "anonymous";
    im.onload = () => resolve("ok:" + im.naturalWidth);
    im.onerror = () => resolve("err");
    im.src = url;
    setTimeout(() => resolve("timeout:" + im.complete + "/" + im.naturalWidth), 5000);
  });
  const plain = await tryImg(src, false);
  const cors = await tryImg(src, true);
  let fetched = "-";
  try {
    const r = await fetch(src);
    fetched = r.status + " " + r.headers.get("content-type") + " " + (await r.arrayBuffer()).byteLength;
  } catch (e) { fetched = "FETCH " + e.message; }
  document.title = "E2E images " + JSON.stringify(imgs) + " bg=" + bg.slice(0, 40) + " fetch=" + fetched + " img=" + plain + " imgCors=" + cors;
}
async function probe() {
  const lines = [...document.querySelectorAll("[class*=lyric], [class*=Lyric]")];
  const out = lines.slice(0, 6).map((el) => {
    const cs = getComputedStyle(el);
    return {
      c: (el.className || "").toString().slice(0, 40),
      f: cs.filter,
      bg: cs.backgroundColor,
      m: (cs.webkitMaskImage || cs.maskImage || "-").slice(0, 30),
      bf: cs.backdropFilter,
      t: (el.textContent || "").trim().slice(0, 10),
    };
  });
  document.title = "E2E probe " + JSON.stringify(out);
}
async function run() {
  await sleep(800);
  if (steps.includes("search")) await search();
  if (steps.includes("play")) await play();
  if (steps.includes("muteplay")) await muteplay();
  if (steps.includes("login")) await login();
  if (steps.includes("immersive")) await immersive();
  if (steps.includes("wait")) await sleep(4000), say(state);
  if (steps.includes("images")) await images();
  if (steps.includes("probe")) await probe();
  if (steps.includes("report")) await sleep(1500), say(state);
}
run().catch((e) => { document.title = "E2E THROW " + String(e).slice(0, 100); });
`,
          },
        ],
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), e2eHarness()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    global: "globalThis",
  },
  server: {
    // The app loads this address during `mygo dev` (devUrl in mygo.config.ts).
    port: 5173,
    strictPort: true,
    // The development app and the packaged builds are not the page's.
    watch: { ignored: ["**/.mygo/**", "**/build/**"] },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "index.html",
        lyrics: "src/lyrics/index.html",
      },
    },
  },
});
