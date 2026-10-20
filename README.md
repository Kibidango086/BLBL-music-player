# BLBL Music Player

> 把 B 站变成你的音乐库 — 用 [MyGo](https://mygo.egoist.dev/) 重写的版本

这是 [BLBL-music-player](https://github.com/Kibidango086/BLBL-music-player) 的 1:1 移植：
同一个 React 前端、同一个界面和交互，Electron 主进程换成 **Go**，由 MyGo 打包成
单个几 MB 的原生桌面应用。界面代码没有重画——组件、样式、状态管理、i18n 都保持
原样，只把桌面能力那一层换成了 MyGo 的绑定服务。

## 关于 v3.0 的这次重写

从 v3.0 起，桌面端由 Electron 换成 [MyGo](https://mygo.egoist.dev/)：

- **不再打包 Chromium**，页面跑在系统自带的 webview 里（WKWebView / WebKitGTK /
  WebView2），Linux 的可执行文件 21 MB，安装包 13.5 MB；
- **主进程是 Go**：B 站的接口、Cookie、代理、歌词匹配、图片与音频转发都在 Go 里，
  前端通过 `mygo generate` 生成的类型化客户端调用，两侧都由编译器检查；
- **界面不变**：功能、布局、配色、动效、沉浸播放、环绕音、i18n 全部沿用，2.x 的
  使用习惯不需要改。

旧版（Electron）的代码与历史都留在
[`electron` 分支](https://github.com/Kibidango086/BLBL-music-player/tree/electron)。

---

## 功能

- **B 站搜索** — 直接在应用内搜索 Bilibili 视频
- **沉浸播放** — 全屏歌词显示，支持 B 站 CC/AI 字幕，基于 AMLL
- **播放列表** — 创建和管理自己的播放队列，支持拖拽排序
- **收藏夹浏览** — 登录后可浏览 B 站收藏夹内容
- **深度环绕音** — 可调深度 / 快慢 / 方向 / 轨迹（环形、摇摆、8 字）的实时环绕音效
- **主题定制** — 支持主题色调节、深色/浅色模式
- **多语言** — 简体中文 / 繁体中文
- **网络代理** — 支持 HTTP/HTTPS/SOCKS 代理及认证
- **跨平台** — Windows、macOS、Linux（几 MB，无 cgo）

## 环境要求

- [Go](https://go.dev/dl/) 1.27 或更高（`go.mod` 要求 1.27.2）
- [Bun](https://bun.sh)（前端构建）
- Linux 上还需要 GTK 3 与 WebKitGTK 4.1：`sudo apt install libwebkit2gtk-4.1-0`
  （Windows 需要 WebView2 运行时，Windows 11 已内置；macOS 用系统的 WKWebView）

## 开发

```bash
bun install
bun run dev          # mygo dev：构建 Go + 启动 Vite + 打开窗口，改 .go 自动重启
```

打开后会生成 `src/mygo.ts`——Go 服务与事件对应的 TypeScript 客户端，由
`mygo generate` 生成，**不要手改**。

```bash
bun run typecheck    # tsc --noEmit
go test ./...        # 单元测试
BLBL_LIVE=1 go test -run TestLive -v ./...   # 会真的访问 B 站与 AMLL 歌词库
```

## 构建

```bash
bun run build        # mygo build：打包到 build/<os>-<arch>/
bun run build -- -platform darwin/universal,windows/amd64,linux/amd64
```

产物：macOS `.app` + `.dmg`，Windows `.exe` + 安装包，Linux 可执行文件 + 桌面项 +
`.deb`。MyGo 不需要 cgo，所以任何一台机器都能交叉构建所有平台（macOS 的签名与
dmg 需要 macOS 机器）。`.github/workflows/build.yml` 在打 tag 时构建并上传到 Release。

## 结构

```
main.go            应用与窗口（无边框 + 隐藏菜单栏，与原版一致）
bilibili.go        Bilibili 服务：搜索、视频信息、音源、收藏夹、登录、歌词
amll.go            AMLL 歌词库：索引缓存、标题分词、模糊匹配、TTML 解析
net.go             带持久化的 Cookie Jar + HTTP 客户端（代理、Referer、UA）
core.go            Core、登录窗口、System 服务、本机音视频服务器
images.go          B 站图片代理（CDN 需要 Referer）
src/               原版前端，几乎原封不动
  lib/mygo-bridge.ts   把 window.electronAPI 实现成 MyGo 绑定 + mygo-runtime
  lib/media.ts         把图片 URL 改写到 Go 的图片代理
  mygo.ts              生成的 TypeScript 客户端
```

### Electron → MyGo 的对照

| 原来（Electron） | 现在（MyGo） |
| --- | --- |
| `electron/main.ts` 的 `ipcMain.handle('bili-*')` | `bilibili.go` 的 `Bilibili` 服务，`mygo.Bind` |
| `electron/preload.ts` 暴露的 `window.electronAPI` | `src/lib/mygo-bridge.ts`，装在 `mygo-runtime` 之上 |
| `session.defaultSession.cookies` | `net.go` 的 `cookieJar`（`cookies.json`，随应用重启保留） |
| `webRequest.onBeforeSendHeaders` 加 Referer | `core.go` 的本机服务器 + `images.go`（音频与图片都从 Go 取） |
| `session.setProxy` | Go 的 `http.Transport.Proxy`，规则存 `settings.json` |
| 登录窗口（`BrowserWindow` 打开 passport） | `core.go` 的 `openLogin`：窗口 + 轮询 `mygo.Cookies` 导入 |
| `frame: false` + 自绘标题栏（`-webkit-app-region`） | `Frameless: true` + `--app-region: drag` |
| `autoHideMenuBar` | `AutoHideMenuBar: true` |
| `shell.openExternal` | `mygo.Shell.OpenExternal` |

### 两个需要说明的取舍

1. **音频为什么要走本机 HTTP 服务器。** 页面播放的是 B 站 CDN 的音源，需要带上
   B 站的 Referer、走应用的代理，而且环绕音用 Web Audio 读取采样还需要同源/CORS。
   自定义 scheme（`bili://`）在这些 webview 里喂不进媒体管线（WebKitGTK 的
   GStreamer 只认 http/file），所以音频由 Go 在本机 `127.0.0.1` 起一个随机端口、
   带一次性 token 的服务器转发，并透传 `Range` 请求以支持拖动。
2. **图片为什么要改写 URL。** B 站图片 CDN 对陌生的 Referer 直接 403，原版是靠
   Electron 给所有请求注入 Referer 解决的。现在所有图片都经 `getHighResPic()` /
   `LazyImage` 改写到同一个本机服务器，由 Go 带 Referer 取回并缓存到磁盘。

## 性能

界面运行在系统的 webview 里，而 WebKitGTK 在这台机器上不做硬件合成：**任何持续播放的动画都会让整页重绘**。因此做了三处针对性处理（都写进了代码注释）：

- 背景光斑的两段漂移动画停掉了（原本 3 fps，静止后 60 fps）；
- 列表缩略图向 B 站 CDN 要 320px 的图，不再拿 4K 原图（一页 20 张图从 ~1 MB/张降到 ~13 KB/张），图片由 Go 边下边发并落盘缓存；
- 沉浸播放的背景不用 `filter: blur()`，改用一张 256px 的封面放大（视觉接近，合成几乎零成本）；歌词的逐行模糊（`enableBlur`）默认关闭，设置里仍可打开。

## 测试

- `go test ./...`：Cookie Jar 的域/路径匹配与持久化、代理规则解析、标题分词、
  Levenshtein、TTML 解析、wbi 签名。
- `BLBL_LIVE=1 go test -run TestLive -v ./...`：真实调用搜索、取 cid、取音源并下载、
  AMLL 歌词匹配。
- `vite.config.ts` 里的 `e2eHarness` 是开发期用的驱动器：`BLBL_E2E=search,play,muteplay,wait bun run dev`
  会像人一样搜索、播放、进沉浸播放，并把状态写进窗口标题（`xdotool getwindowname` 可读），
  用于在真实 webview 里验收。没有设置 `BLBL_E2E` 时构建产物里没有这段代码。

## 协议

MIT，同上游。
