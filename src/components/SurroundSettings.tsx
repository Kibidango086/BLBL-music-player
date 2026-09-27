import { useEffect, useRef, type ReactNode } from 'react'
import { Slider } from '@/components/ui/slider'
import { Icon } from '@/components/ui/icon'
import { useI18nStore } from '@/i18n'
import { useSurroundStore } from '@/store/surroundStore'
import { cn } from '@/lib/utils'
import {
  SURROUND_LIMITS,
  orbitPoint,
  speedToHz,
  speedToLoopSeconds,
  type SurroundMode
} from '@/lib/surroundAudio'

const MODES: { id: SurroundMode; labelKey: string; icon: string }[] = [
  { id: 'orbit', labelKey: 'surround.modeOrbit', icon: '360' },
  { id: 'pendulum', labelKey: 'surround.modePendulum', icon: 'swap_horiz' },
  { id: 'figure8', labelKey: 'surround.modeFigure8', icon: 'all_inclusive' }
]

const PREVIEW_SIZE = 92
const PREVIEW_CENTER = PREVIEW_SIZE / 2
const PREVIEW_RADIUS = PREVIEW_SIZE / 2 - 12

/** 环绕轨迹示意图：与音频引擎使用同一套相位数学 */
function OrbitPreview() {
  const { enabled, mode, depth, speed, direction } = useSurroundStore()
  const dotRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const dot = dotRef.current
    if (!dot) return

    const dir = direction === 'ccw' ? -1 : 1
    const hz = speedToHz(speed)
    const started = performance.now()
    let frame = 0

    const place = (phase: number) => {
      const point = orbitPoint(mode, phase, depth)
      dot.setAttribute('cx', String(PREVIEW_CENTER + point.x * PREVIEW_RADIUS))
      dot.setAttribute('cy', String(PREVIEW_CENTER - point.y * PREVIEW_RADIUS))
      dot.setAttribute('fill-opacity', enabled ? '1' : '0.4')
    }

    if (!enabled) {
      place(0)
      return
    }

    const tick = (now: number) => {
      const seconds = (now - started) / 1000
      place(2 * Math.PI * hz * seconds * dir)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [enabled, mode, depth, speed, direction])

  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      <svg width={PREVIEW_SIZE} height={PREVIEW_SIZE} viewBox={`0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`}>
        <circle
          cx={PREVIEW_CENTER}
          cy={PREVIEW_CENTER}
          r={PREVIEW_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeDasharray="3 4"
          className="text-foreground"
        />
        <circle
          cx={PREVIEW_CENTER}
          cy={PREVIEW_CENTER}
          r={PREVIEW_RADIUS * 0.45}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          className="text-foreground"
        />
        <circle cx={PREVIEW_CENTER} cy={PREVIEW_CENTER} r={3} fill="currentColor" fillOpacity={0.25} className="text-foreground" />
        <circle ref={dotRef} cx={PREVIEW_CENTER} cy={PREVIEW_CENTER - PREVIEW_RADIUS} r={7} className="fill-primary" />
        <text
          x={PREVIEW_CENTER}
          y={PREVIEW_SIZE - 2}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 9 }}
        >
          {direction === 'cw' ? 'CW' : 'CCW'}
        </text>
      </svg>
    </div>
  )
}

interface RowProps {
  label: string
  value: string
  children: ReactNode
}

function Row({ label, value, children }: RowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-muted-foreground w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        {children}
        <span className="text-[12px] font-mono text-muted-foreground w-20 text-right flex-shrink-0">{value}</span>
      </div>
    </div>
  )
}

export function SurroundSettings() {
  const { t } = useI18nStore()
  const {
    enabled,
    mode,
    depth,
    speed,
    direction,
    width,
    setEnabled,
    setMode,
    setDepth,
    setSpeed,
    setDirection,
    setWidth,
    reset
  } = useSurroundStore()

  const loopSeconds = speedToLoopSeconds(speed)

  return (
    <div className="p-5 rounded-xl bg-card border border-border shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
              enabled ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
            )}
          >
            <Icon name="surround_sound" size={20} filled={enabled} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold text-foreground tracking-[-0.02em]">
              {t('surround.title')}
            </h3>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{t('surround.desc')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <OrbitPreview />
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t('surround.title')}
            onClick={() => setEnabled(!enabled)}
            className={cn(
              'relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200',
              enabled ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                enabled ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>

      <div className={cn('mt-4 transition-opacity duration-200', enabled ? 'opacity-100' : 'opacity-50')}>
        <div className="space-y-4">
          <Row label={t('surround.depth')} value={`${depth}%`}>
            <Slider
              value={[depth]}
              min={SURROUND_LIMITS.depth.min}
              max={SURROUND_LIMITS.depth.max}
              step={SURROUND_LIMITS.depth.step}
              onValueChange={(v) => setDepth(v[0])}
              className="flex-1"
            />
          </Row>

          <Row label={t('surround.speed')} value={t('surround.loopTime', { sec: loopSeconds.toFixed(1) })}>
            <Slider
              value={[speed]}
              min={SURROUND_LIMITS.speed.min}
              max={SURROUND_LIMITS.speed.max}
              step={SURROUND_LIMITS.speed.step}
              onValueChange={(v) => setSpeed(v[0])}
              className="flex-1"
            />
          </Row>

          <Row label={t('surround.width')} value={`${width}%`}>
            <Slider
              value={[width]}
              min={SURROUND_LIMITS.width.min}
              max={SURROUND_LIMITS.width.max}
              step={SURROUND_LIMITS.width.step}
              onValueChange={(v) => setWidth(v[0])}
              className="flex-1"
            />
          </Row>

          <div className="flex items-center gap-3">
            <span className="text-[13px] text-muted-foreground w-20 flex-shrink-0">{t('surround.direction')}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDirection('cw')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors border whitespace-nowrap',
                  direction === 'cw'
                    ? 'bg-secondary text-foreground font-medium border-border'
                    : 'text-muted-foreground border-transparent hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon name="rotate_right" size={15} />
                {t('surround.dirCw')}
              </button>
              <button
                type="button"
                onClick={() => setDirection('ccw')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors border whitespace-nowrap',
                  direction === 'ccw'
                    ? 'bg-secondary text-foreground font-medium border-border'
                    : 'text-muted-foreground border-transparent hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon name="rotate_left" size={15} />
                {t('surround.dirCcw')}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[13px] text-muted-foreground w-20 flex-shrink-0">{t('surround.mode')}</span>
            <div className="flex items-center gap-2">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors border whitespace-nowrap',
                    mode === item.id
                      ? 'bg-secondary text-foreground font-medium border-border'
                      : 'text-muted-foreground border-transparent hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon name={item.icon} size={15} />
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-muted-foreground leading-relaxed pr-4">{t('surround.hint')}</p>
            <button
              type="button"
              onClick={reset}
              className="text-[12px] px-2.5 py-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex-shrink-0 whitespace-nowrap"
            >
              {t('surround.reset')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SurroundSettings
