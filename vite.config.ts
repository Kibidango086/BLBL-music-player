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
const history = [];
const say = (s) => {
  state = s;
  history.push(s);
  const a = document.querySelector("audio");
  document.title = "E2E " + history.join(" || ") + " | " + audioInfo() + " | " + canvasInfo() +
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
async function fpsFor(ms) {
  let frames = 0;
  const f0 = performance.now();
  await new Promise((done) => {
    const tick = () => {
      frames++;
      if (performance.now() - f0 < ms) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  return Math.round((frames * 1000) / ms);
}
async function fpsx() {
  await sleep(1500);
  const base = await fpsFor(2000);
  const style = (css) => { const s = document.createElement("style"); s.textContent = css; document.head.append(s); return s; };
  style("body::before,body::after{display:none!important}");
  await sleep(400);
  const noBlobs = await fpsFor(2000);
  style("*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}");
  await sleep(400);
  const noBackdrop = await fpsFor(2000);
  style("*{animation:none!important;transition:none!important}");
  await sleep(400);
  const noAnim = await fpsFor(2000);
  say("fpsx base=" + base + " noBlobs=" + noBlobs + " noBackdrop=" + noBackdrop + " noAnim=" + noAnim);
}
async function fpsw() {
  await sleep(1200);
  const style = (id, css) => {
    let s = document.getElementById(id);
    if (!s) { s = document.createElement("style"); s.id = id; document.head.append(s); }
    s.textContent = css;
  };
  const results = {};
  results.base = await fpsFor(1500);
  style("w", "body::before,body::after{animation:none!important}");
  await sleep(300);
  results.staticBlur = await fpsFor(1500);
  style("w", "body::before,body::after{animation:none!important;filter:none!important}");
  await sleep(300);
  results.staticNoBlur = await fpsFor(1500);
  style("w", "@keyframes blobSway1{0%,100%{transform:translate3d(0,0,0) scale(1)}25%{transform:translate3d(45px,-35px,0) scale(1.08)}50%{transform:translate3d(-20px,28px,0) scale(.92)}75%{transform:translate3d(-40px,-15px,0) scale(1.05)}}@keyframes blobSway2{0%,100%{transform:translate3d(0,0,0) scale(1)}25%{transform:translate3d(-40px,35px,0) scale(1.09)}50%{transform:translate3d(28px,-25px,0) scale(.91)}75%{transform:translate3d(35px,15px,0) scale(1.07)}}body::before{animation-name:blobSway1}body::after{animation-name:blobSway2}");
  await sleep(400);
  results.threeD = await fpsFor(1500);
  style("w", "body::before,body::after{filter:none!important}@keyframes blobSway1{0%,100%{transform:translate3d(0,0,0) scale(1)}25%{transform:translate3d(45px,-35px,0) scale(1.08)}50%{transform:translate3d(-20px,28px,0) scale(.92)}75%{transform:translate3d(-40px,-15px,0) scale(1.05)}}@keyframes blobSway2{0%,100%{transform:translate3d(0,0,0) scale(1)}25%{transform:translate3d(-40px,35px,0) scale(1.09)}50%{transform:translate3d(28px,-25px,0) scale(.91)}75%{transform:translate3d(35px,15px,0) scale(1.07)}}");
  await sleep(400);
  results.threeDNoBlur = await fpsFor(1500);
  style("w", "@keyframes blobPulse{0%,100%{opacity:.85}50%{opacity:.4}}body::before{animation:blobPulse 9s ease-in-out infinite!important}body::after{animation:blobPulse 13s ease-in-out infinite!important}");
  await sleep(400);
  results.animOpacity = await fpsFor(1500);
  style("w", "body::before,body::after{animation:none!important}");
  await sleep(400);
  results.animNone = await fpsFor(1500);
  style("w", "");
  say("fpsw " + JSON.stringify(results));
}
async function fpsv() {
  await sleep(1500);
  const style = (id, css) => {
    let s = document.getElementById(id);
    if (!s) { s = document.createElement("style"); s.id = id; document.head.append(s); }
    s.textContent = css;
  };
  style("v", "");
  await sleep(300);
  const base = await fpsFor(1500);
  style("v", "body::before,body::after{filter:none!important}");
  await sleep(300);
  const noFilter = await fpsFor(1500);
  style("v", "body::before,body::after{will-change:transform!important;transform:translateZ(0)!important}");
  await sleep(300);
  const promoted = await fpsFor(1500);
  style("v", "body::before,body::after{filter:none!important;will-change:transform!important;transform:translateZ(0)!important}");
  await sleep(300);
  const both = await fpsFor(1500);
  style("v", "");
  say("fpsv base=" + base + " noFilter=" + noFilter + " promoted=" + promoted + " both=" + both);
}
async function perf() {
  const t0 = performance.now();
  const input = document.querySelector("input");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, query);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(120);
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  let cards = 0;
  for (let i = 0; i < 200; i++) {
    await sleep(50);
    cards = document.querySelectorAll("div.group").length;
    if (cards) break;
  }
  const tCards = Math.round(performance.now() - t0);
  await sleep(1500);
  const imgs = [...document.images];
  const loaded1 = imgs.filter((i) => i.naturalWidth > 0).length;
  await sleep(2000);
  const loaded2 = [...document.images].filter((i) => i.naturalWidth > 0).length;

  const res = performance.getEntriesByType("resource").filter((r) => r.initiatorType === "img" || /\.(jpg|png)/.test(r.name));
  const slow = res.sort((a, b) => b.duration - a.duration).slice(0, 3).map((r) => Math.round(r.duration) + "ms/" + Math.round(r.transferSize / 1024) + "k");

  let frames = 0;
  const f0 = performance.now();
  await new Promise((done) => {
    const tick = () => {
      frames++;
      if (performance.now() - f0 < 3000) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  const fps = Math.round(frames / 3);
  say("perf cards=" + cards + "@" + tCards + "ms imgs=" + loaded1 + "/" + imgs.length + "->" + loaded2 + "/" + imgs.length +
      " fps=" + fps + " slow=" + slow.join(","));
}
async function surround() {
  const a = document.querySelector("audio");
  if (!a) return say("no-audio");
  const url = a.currentSrc || a.src;

  // A muted element plays without a user gesture. The question: does Web
  // Audio still read its samples, and is the cross-origin stream readable?
  let peakMuted = 0;
  let trace = [];
  let err = "-";
  try {
    const probe = new Audio();
    probe.crossOrigin = "anonymous";
    probe.muted = true;
    probe.preload = "auto";
    probe.src = url;
    await probe.play();
    trace.push("after-play:" + probe.paused + "/" + probe.currentTime.toFixed(1));
    await sleep(700);
    trace.push("700ms:" + probe.paused + "/" + probe.currentTime.toFixed(1));
    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(probe);
    const an = ctx.createAnalyser();
    src.connect(an);
    an.connect(ctx.destination);
    await sleep(1000);
    trace.push("graph:" + probe.paused + "/" + probe.currentTime.toFixed(1));
    const buf = new Float32Array(an.fftSize);
    for (let i = 0; i < 8; i++) {
      an.getFloatTimeDomainData(buf);
      for (const v of buf) peakMuted = Math.max(peakMuted, Math.abs(v));
      await sleep(120);
    }
    trace.push("sampled:" + probe.paused + "/" + probe.currentTime.toFixed(1));
    probe.pause();
  } catch (e) { err = e.name + ":" + e.message; }
  say("surround mutedPeak=" + peakMuted.toFixed(5) + " cors=" + a.crossOrigin + " trace=" + trace.join(" ") + " err=" + err);
}

async function imfpsx() {
  const art = document.querySelector('[title="进入沉浸播放"]');
  if (!art) return say("no-album");
  art.click();
  await sleep(2500);
  const style = (id, css) => {
    let s = document.getElementById(id);
    if (!s) { s = document.createElement("style"); s.id = id; document.head.append(s); }
    s.textContent = css;
  };
  const r = {};
  r.base = await fpsFor(1500);
  style("i", "img{filter:none!important}");
  await sleep(300);
  r.noImgFilter = await fpsFor(1500);
  style("i", "[class*=lyric] *{filter:none!important}");
  await sleep(300);
  r.noLyricFilter = await fpsFor(1500);
  style("i", "*{filter:none!important}");
  await sleep(300);
  r.noFilter = await fpsFor(1500);
  style("i", "*{filter:none!important;transition:none!important}");
  await sleep(300);
  r.noTransition = await fpsFor(1500);
  style("i", "*,*::before,*::after{animation:none!important;transition:none!important;filter:none!important}");
  await sleep(300);
  r.noAnim = await fpsFor(1500);
  style("i", "");
  say("imfpsx " + JSON.stringify(r));
}
async function filters() {
  const list = [...document.querySelectorAll("*")]
    .map((e) => ({ e, f: getComputedStyle(e).filter }))
    .filter(({ f }) => f && f !== "none")
    .slice(0, 6)
    .map(({ e, f }) => ((e.className || e.tagName || "").toString().slice(0, 26) + "=" + f));
  say("filters count=" + list.length + " " + list.join(" | "));
}
async function imfps() {
  const art = document.querySelector('[title="进入沉浸播放"]');
  if (!art) return say("no-album");
  art.click();
  await sleep(2500);
  const fps = await fpsFor(2000);
  say("imfps=" + fps);
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
  if (steps.includes("perf")) await perf();
  if (steps.includes("fpsx")) await fpsx();
  if (steps.includes("fpsv")) await fpsv();
  if (steps.includes("fpsw")) await fpsw();
  if (steps.includes("surround")) await surround();
  if (steps.includes("imfps")) await imfps();
  if (steps.includes("imfpsx")) await imfpsx();
  if (steps.includes("filters")) await filters();
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
