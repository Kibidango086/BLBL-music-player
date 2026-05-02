import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-vercel-black text-white hover:bg-vercel-gray-900 dark:bg-[#ededed] dark:text-[#0a0a0a] dark:hover:bg-white',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline:
          'bg-white shadow-border hover:bg-vercel-gray-50 text-vercel-black dark:bg-[#0a0a0a] dark:text-[#ededed] dark:hover:bg-[#141414]',
        secondary: 'bg-vercel-gray-100 text-vercel-black hover:bg-vercel-gray-100/80 dark:bg-[#1f1f1f] dark:text-[#ededed] dark:hover:bg-[#333333]',
        ghost: 'hover:bg-vercel-gray-50 text-vercel-black dark:text-[#ededed] dark:hover:bg-[#141414]',
        link: 'text-vercel-link underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
