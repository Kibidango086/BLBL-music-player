/**
 * 深度环绕音 (Deep Surround) 音频引擎
 *
 * 基于 Web Audio API 在 <audio> 元素之后插入一条实时处理链，让声音围绕听者
 * 旋转（俗称 8D 环绕音）：
 *
 *   source ─┬─ dryGain ───────────────────────────────────────────────┐
 *           └─ wetIn ─→ 立体声扩展(M/S + 延迟串扰) ─→ 环绕声像 ─→ 距离滤波 ─→ wetGain ─┴─→ master ─→ 软限幅 ─→ 输出
 *
 * 可调参数（与 UI 一一对应）：
 *   depth     环绕深度 —— 湿声占比 + 声像摆幅 + 明暗变化幅度
 *   speed     环绕快慢 —— 转一圈所需的秒数（1.6s ~ 24s）
 *   direction 环绕方向 —— 顺时针 / 逆时针
 *   mode      环绕轨迹 —— 环形 / 左右摇摆 / 8 字
 *   width     空间宽度 —— 湿声的立体声宽度（0% 单声道 ~ 200% 超宽）
 *
 * 安全性：只有在「音源实测可用」之后才会把音频接管进 Web Audio 图，
 * 否则保持 <audio> 原生播放，绝不出现静音。
 */

export type SurroundMode = 'orbit' | 'pendulum' | 'figure8'
export type SurroundDirection = 'cw' | 'ccw'

export interface SurroundConfig {
  enabled: boolean
  mode: SurroundMode
  depth: number
  speed: number
  direction: SurroundDirection
  width: number
}

export const SURROUND_DEFAULTS: SurroundConfig = {
  enabled: false,
  mode: 'orbit',
  depth: 60,
  speed: 45,
  direction: 'cw',
  width: 120
}

export const SURROUND_LIMITS = {
  depth: { min: 0, max: 100, step: 1 },
  speed: { min: 0, max: 100, step: 1 },
  width: { min: 0, max: 200, step: 5 }
} as const

/** 最快 1.6 秒转一圈，最慢 24 秒转一圈 */
const MIN_LOOP_PERIOD = 1.6
const MAX_LOOP_PERIOD = 24
/** 湿声链路的固定串扰延迟（营造头外定位感） */
const CROSS_DELAY_SEC = 0.016
/** 距离滤波器的中心频率与摆幅 */
const TONE_CENTER_HZ = 11500
const TONE_SWING_HZ = 8500
/** 参数平滑时间常数 */
const RAMP_TIME = 0.08

export function clampNumber(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** 滑块值(0~100) → 环绕频率 Hz（对数映射：最慢 24s/圈，最快 1.6s/圈） */
export function speedToHz(speed: number): number {
  const t = clampNumber(speed, 0, 100) / 100
  const period = MIN_LOOP_PERIOD * Math.pow(MAX_LOOP_PERIOD / MIN_LOOP_PERIOD, 1 - t)
  return 1 / period
}

/** 滑块值(0~100) → 转一圈所需秒数 */
export function speedToLoopSeconds(speed: number): number {
  return 1 / speedToHz(speed)
}

/**
 * 环绕轨迹在某一相位下的位置，UI 预览与音频引擎共用同一套数学。
 * x: 声像，-1 左 ~ 1 右；y: 前后，1 前 ~ -1 后
 */
export function orbitPoint(
  mode: SurroundMode,
  phase: number,
  depth: number
): { x: number; y: number } {
  const amount = clampNumber(depth, 0, 100) / 100
  const radius = 0.15 + 0.85 * amount
  if (mode === 'pendulum') {
    return { x: Math.sin(phase) * radius, y: 0 }
  }
  if (mode === 'figure8') {
    return { x: Math.sin(phase) * radius, y: Math.sin(phase * 2) * radius * 0.6 }
  }
  return { x: Math.sin(phase) * radius, y: Math.cos(phase) * radius }
}

export interface GraphNodes {
  ctx: AudioContext
  dry: GainNode
  wetIn: GainNode
  /** 强制升混为立体声，保证单声道音源也能正确做 M/S 处理 */
  stereoUpmix: GainNode
  splitter: ChannelSplitterNode
  gLM: GainNode
  gRM: GainNode
  gLS: GainNode
  gRS: GainNode
  sumM: GainNode
  sumS: GainNode
  gML: GainNode
  gMR: GainNode
  gSL: GainNode
  gSR: GainNode
  crossL: DelayNode
  crossR: DelayNode
  gxLR: GainNode
  gxRL: GainNode
  mixL: GainNode
  mixR: GainNode
  merger: ChannelMergerNode
  panner: StereoPannerNode
  tone: BiquadFilterNode
  wet: GainNode
  master: GainNode
  softClip: WaveShaperNode
  oscSin: OscillatorNode
  oscCos: OscillatorNode
  panDepth: GainNode
  toneDepth: GainNode
}

/** 软限幅曲线：|x| ≤ 0.9 时完全线性，之后平滑压缩 */
function createSoftClipCurve(samples = 4097, knee = 0.9) {
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1
    const abs = Math.abs(x)
    const shaped =
      abs <= knee ? abs : knee + (1 - knee) * Math.tanh((abs - knee) / (1 - knee))
    curve[i] = x < 0 ? -shaped : shaped
  }
  return curve
}

export function createSurroundGraph(ctx: AudioContext): GraphNodes {
  const gain = (value: number) => {
    const node = ctx.createGain()
    node.gain.value = value
    return node
  }

  const dry = gain(1)
  const wetIn = gain(1)

  const stereoUpmix = gain(1)
  stereoUpmix.channelCount = 2
  stereoUpmix.channelCountMode = 'explicit'
  stereoUpmix.channelInterpretation = 'speakers'

  const splitter = ctx.createChannelSplitter(2)

  const gLM = gain(0.5)
  const gRM = gain(0.5)
  const gLS = gain(0.5)
  const gRS = gain(-0.5)
  const sumM = gain(1)
  const sumS = gain(1)

  const gML = gain(1)
  const gMR = gain(1)
  const gSL = gain(1)
  const gSR = gain(-1)

  const crossL = ctx.createDelay(0.5)
  crossL.delayTime.value = CROSS_DELAY_SEC
  const crossR = ctx.createDelay(0.5)
  crossR.delayTime.value = CROSS_DELAY_SEC
  const gxLR = gain(0)
  const gxRL = gain(0)

  const mixL = gain(1)
  const mixR = gain(1)
  const merger = ctx.createChannelMerger(2)

  const panner = ctx.createStereoPanner()
  panner.pan.value = 0

  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = TONE_CENTER_HZ
  tone.Q.value = 0.7071

  const wet = gain(0)
  const master = gain(1)

  // 软限幅：只在 0.9 以上压缩，正常音量下完全透明，避免干湿叠加后削顶
  const softClip = ctx.createWaveShaper()
  softClip.curve = createSoftClipCurve()
  softClip.oversample = '2x'

  const oscSin = ctx.createOscillator()
  oscSin.setPeriodicWave(
    ctx.createPeriodicWave(new Float32Array([0, 0]), new Float32Array([0, 1]), {
      disableNormalization: true
    })
  )
  const oscCos = ctx.createOscillator()
  oscCos.setPeriodicWave(
    ctx.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]), {
      disableNormalization: true
    })
  )
  const panDepth = gain(0)
  const toneDepth = gain(0)

  // ---- 连线 ----
  wetIn.connect(stereoUpmix)
  stereoUpmix.connect(splitter)

  splitter.connect(gLM, 0)
  splitter.connect(gLS, 0)
  splitter.connect(crossR, 0) // L → 延迟后串到右耳
  splitter.connect(gRM, 1)
  splitter.connect(gRS, 1)
  splitter.connect(crossL, 1) // R → 延迟后串到左耳

  gLM.connect(sumM)
  gRM.connect(sumM)
  gLS.connect(sumS)
  gRS.connect(sumS)

  sumM.connect(gML)
  sumM.connect(gMR)
  sumS.connect(gSL)
  sumS.connect(gSR)

  gML.connect(mixL)
  gSL.connect(mixL)
  crossL.connect(gxRL)
  gxRL.connect(mixL)

  gMR.connect(mixR)
  gSR.connect(mixR)
  crossR.connect(gxLR)
  gxLR.connect(mixR)

  mixL.connect(merger, 0, 0)
  mixR.connect(merger, 0, 1)
  merger.connect(panner)
  panner.connect(tone)
  tone.connect(wet)

  wet.connect(master)
  dry.connect(master)
  master.connect(softClip)
  softClip.connect(ctx.destination)

  oscSin.connect(panDepth)
  panDepth.connect(panner.pan)
  oscCos.connect(toneDepth)
  toneDepth.connect(tone.frequency)

  oscSin.start()
  oscCos.start()

  return {
    ctx,
    dry,
    wetIn,
    stereoUpmix,
    splitter,
    gLM,
    gRM,
    gLS,
    gRS,
    sumM,
    sumS,
    gML,
    gMR,
    gSL,
    gSR,
    crossL,
    crossR,
    gxLR,
    gxRL,
    mixL,
    mixR,
    merger,
    panner,
    tone,
    wet,
    master,
    softClip,
    oscSin,
    oscCos,
    panDepth,
    toneDepth
  }
}

function resolveUrl(element: HTMLAudioElement): string {
  return element.currentSrc || element.src || ''
}

function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type ProbeResult = 'ok' | 'silent' | 'error'

/**
 * 用同一个 AudioContext 试播一小段音频，实测「Web Audio 能否拿到有效采样」。
 * 探测音频经由 0 增益输出，完全无声，也不会打断正在播放的原声。
 */
async function probeSource(ctx: AudioContext, url: string): Promise<ProbeResult> {
  const probe = new Audio()
  probe.crossOrigin = 'anonymous'
  probe.preload = 'auto'
  probe.src = url

  let chain: { source: MediaElementAudioSourceNode; analyser: AnalyserNode; sink: GainNode } | null =
    null

  const cleanup = () => {
    try {
      probe.pause()
      probe.removeAttribute('src')
      probe.load()
    } catch {
      /* ignore */
    }
    try {
      chain?.source.disconnect()
      chain?.analyser.disconnect()
      chain?.sink.disconnect()
    } catch {
      /* ignore */
    }
    chain = null
  }

  try {
    const source = ctx.createMediaElementSource(probe)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    const sink = ctx.createGain()
    sink.gain.value = 0
    source.connect(analyser)
    analyser.connect(sink)
    sink.connect(ctx.destination)
    chain = { source, analyser, sink }
  } catch {
    cleanup()
    return 'error'
  }

  try {
    await probe.play()
  } catch {
    cleanup()
    return 'error'
  }

  const analyser = chain.analyser
  const buffer = new Float32Array(analyser.fftSize)
  let peak = 0
  // 两轮采样，避免刚好落在歌曲开头的静音段造成误判
  for (let round = 0; round < 2 && peak <= 1e-4; round++) {
    const deadline = performance.now() + 1200
    while (performance.now() < deadline) {
      await sleep(100)
      if (probe.paused || probe.error) break
      analyser.getFloatTimeDomainData(buffer)
      for (let i = 0; i < buffer.length; i++) {
        const abs = Math.abs(buffer[i])
        if (abs > peak) peak = abs
      }
      if (peak > 1e-4) break
    }
  }

  const failed = !!probe.error
  cleanup()
  if (failed) return 'error'
  return peak > 1e-4 ? 'ok' : 'silent'
}

/** 由配置推导出的全部混音参数（纯函数，方便单独验证） */
export interface SurroundMix {
  /** 湿声增益 */
  wet: number
  /** 干声增益 */
  dry: number
  /** 总线补偿增益 */
  master: number
  /** 立体声宽度系数 */
  width: number
  /** 头外定位串扰量 */
  cross: number
  /** 声像摆幅 */
  panRange: number
  /** 距离滤波摆幅(Hz) */
  toneRange: number
  /** 环绕基频 */
  hz: number
  /** 前后感调制频率 */
  toneHz: number
}

export function computeSurroundMix(config: SurroundConfig): SurroundMix {
  const { enabled, mode, depth, speed, direction, width } = config
  const amount = clampNumber(depth, 0, 100) / 100
  const widthAmount = clampNumber(width, 0, 200) / 100
  const dirSign = direction === 'ccw' ? -1 : 1
  const hz = speedToHz(speed)

  return {
    wet: enabled ? 0.75 * amount : 0,
    dry: enabled ? 1 - 0.3 * amount : 1,
    master: enabled ? 1 / (1 + 0.15 * amount) : 1,
    width: widthAmount,
    cross: enabled ? 0.25 * Math.min(widthAmount, 2) * amount : 0,
    panRange: enabled ? (0.25 + 0.75 * amount) * dirSign : 0,
    // 前后距离感：靠后时高频衰减；左右摇摆模式下不做明暗变化
    toneRange: enabled && mode !== 'pendulum' ? TONE_SWING_HZ * amount * dirSign : 0,
    hz,
    toneHz: mode === 'figure8' ? hz * 2 : hz
  }
}

/** 把配置写入音频图（全部使用短时平滑，避免爆音） */
export function applyMixToGraph(graph: GraphNodes, config: SurroundConfig, now: number): void {
  const mix = computeSurroundMix(config)

  graph.wet.gain.setTargetAtTime(mix.wet, now, RAMP_TIME)
  graph.dry.gain.setTargetAtTime(mix.dry, now, RAMP_TIME)
  graph.master.gain.setTargetAtTime(mix.master, now, RAMP_TIME)

  // 立体声宽度（M/S）
  graph.gSL.gain.setTargetAtTime(mix.width, now, RAMP_TIME)
  graph.gSR.gain.setTargetAtTime(-mix.width, now, RAMP_TIME)
  // 头外定位串扰
  graph.gxLR.gain.setTargetAtTime(mix.cross, now, RAMP_TIME)
  graph.gxRL.gain.setTargetAtTime(mix.cross, now, RAMP_TIME)

  // 环绕速度与轨迹
  graph.oscSin.frequency.setTargetAtTime(mix.hz, now, 0.12)
  graph.oscCos.frequency.setTargetAtTime(mix.toneHz, now, 0.12)

  // 声像摆幅与距离滤波摆幅
  graph.panDepth.gain.setTargetAtTime(mix.panRange, now, RAMP_TIME)
  graph.toneDepth.gain.setTargetAtTime(mix.toneRange, now, RAMP_TIME)
}

export class SurroundEngine {
  private element: HTMLAudioElement | null = null
  private graph: GraphNodes | null = null
  private mediaSource: MediaElementAudioSourceNode | null = null
  private config: SurroundConfig = { ...SURROUND_DEFAULTS }
  private probing: Promise<void> | null = null
  private probedUrl = ''
  private probeCache = new Map<string, ProbeResult>()
  private notifiedUnsupported = false
  private onUnsupported: ((url: string) => void) | null = null
  private onActivated: (() => void) | null = null

  /** 当前是否已经真正接管了音频输出 */
  get isActive(): boolean {
    return !!this.mediaSource && !!this.graph
  }

  attach(
    element: HTMLAudioElement | null,
    hooks?: { onUnsupported?: (url: string) => void; onActivated?: () => void }
  ): void {
    if (element !== this.element) {
      this.element = element
      this.probedUrl = ''
      this.notifiedUnsupported = false
      this.onActivated = null
    }
    if (hooks?.onUnsupported) this.onUnsupported = hooks.onUnsupported
    if (hooks?.onActivated) this.onActivated = hooks.onActivated
  }

  /** 设置变化时调用；内部会自动去重，不会重复建图或重复探测 */
  apply(config: SurroundConfig): void {
    this.config = { ...config }
    if (this.graph) this.updateParams()

    if (!config.enabled) {
      this.applyBypass()
      return
    }
    void this.ensureActive()
  }

  /** 播放/暂停、切歌、用户手势等时机调用，保证 AudioContext 处于运行态 */
  resume(): void {
    const ctx = this.graph?.ctx
    if (ctx && ctx.state !== 'running') {
      void ctx.resume().catch(() => undefined)
    }
    if (this.config.enabled) void this.ensureActive()
  }

  /** 音源地址变化时调用（切换歌曲） */
  notifySourceChange(): void {
    if (this.config.enabled) void this.ensureActive()
  }

  private applyBypass(): void {
    const graph = this.graph
    if (!graph) return
    const now = graph.ctx.currentTime
    graph.wet.gain.setTargetAtTime(0, now, RAMP_TIME)
    graph.dry.gain.setTargetAtTime(1, now, RAMP_TIME)
    graph.master.gain.setTargetAtTime(1, now, RAMP_TIME)
  }

  private async ensureActive(): Promise<void> {
    const element = this.element
    if (!element) return
    const url = resolveUrl(element)
    if (!url) return
    if (this.probing) return
    // 已经接管同一个音源，只需要更新参数
    if (this.mediaSource && this.probedUrl === url) {
      this.resumeContext()
      this.updateParams()
      return
    }

    this.probing = this.run(url)
      .catch(() => undefined)
      .finally(() => {
        this.probing = null
      })
    await this.probing
  }

  private resumeContext(): void {
    const ctx = this.graph?.ctx
    if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined)
  }

  private async run(url: string): Promise<void> {
    const element = this.element
    if (!element) return

    const graph = this.graph ?? this.createContext()
    if (!graph) return

    if (graph.ctx.state !== 'running') {
      try {
        await graph.ctx.resume()
      } catch {
        /* 保持原生播放 */
      }
    }

    const origin = originOf(url)
    let result = this.probeCache.get(origin)
    if (!result) {
      result = await probeSource(graph.ctx, url)
      // 只在确定结论时缓存，'error'（例如自动播放被拦截）留待下次重试
      if (result !== 'error') this.probeCache.set(origin, result)
    }

    if (result !== 'ok') {
      this.applyBypass()
      if (!this.notifiedUnsupported) {
        this.notifiedUnsupported = true
        this.onUnsupported?.(url)
      }
      return
    }

    if (this.mediaSource) {
      this.probedUrl = url
      this.updateParams()
      return
    }

    // 探测期间用户可能已经关掉了环绕音，此时不接管原生播放
    if (!this.config.enabled) return

    try {
      this.mediaSource = graph.ctx.createMediaElementSource(element)
    } catch {
      // 元素可能已被其它模块接管，保持原生播放
      this.mediaSource = null
      return
    }
    this.mediaSource.connect(graph.dry)
    this.mediaSource.connect(graph.wetIn)
    this.probedUrl = url
    this.notifiedUnsupported = false
    this.updateParams()
    this.onActivated?.()
  }

  private createContext(): GraphNodes | null {
    if (this.graph) return this.graph
    if (typeof window === 'undefined') return null
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      const ctx = new Ctor()
      this.graph = createSurroundGraph(ctx)
      return this.graph
    } catch {
      return null
    }
  }

  /** 根据当前配置刷新所有 AudioParam（全部使用短时平滑，避免爆音） */
  private updateParams(): void {
    const graph = this.graph
    if (!graph) return
    applyMixToGraph(graph, this.config, graph.ctx.currentTime)
  }
}

export const surroundEngine = new SurroundEngine()
