import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { useToastStore } from '@/store/toastStore'

const iconMap: Record<string, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info'
}

const colorMap: Record<string, string> = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-500 dark:text-red-400',
  info: 'text-primary'
}

export function ToastContainer() {
  const { toasts } = useToastStore()
  const [visibleToasts, setVisibleToasts] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const next: Record<string, boolean> = {}
    toasts.forEach(t => { next[t.id] = true })
    setVisibleToasts(next)
  }, [toasts])

  return (
    <div className="fixed top-12 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border shadow text-[13px] font-medium text-foreground backdrop-blur-xl"
          style={{
            animation: 'toastBounce 0.5s cubic-bezier(.34,1.56,.64,1) forwards',
            opacity: visibleToasts[toast.id] ? 1 : 0
          }}
        >
          <Icon name={iconMap[toast.type] || 'info'} size={16} className={colorMap[toast.type] || ''} />
          {toast.message}
        </div>
      ))}
    </div>
  )
}
