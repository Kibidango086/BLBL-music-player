import { useToastStore } from '@/store/toastStore'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info
}

const colorMap = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-500 dark:text-red-400',
  info: 'text-vercel-blue dark:text-blue-400'
}

export function ToastContainer() {
  const { toasts } = useToastStore()

  return (
    <div className="fixed top-12 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type]
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 24, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-[#141414] shadow-card text-[13px] font-medium text-vercel-black dark:text-[#ededed]"
            >
              <Icon className={`w-4 h-4 ${colorMap[toast.type]}`} />
              {toast.message}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
