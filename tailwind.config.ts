import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        background: 'var(--bg)',
        foreground: 'var(--fg)',
        card: {
          DEFAULT: 'var(--card-bg)',
          foreground: 'var(--card-fg)'
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-fg)'
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-fg)'
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-fg)'
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-fg)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-fg)'
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-fg)'
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        DEFAULT: 'var(--shadow)',
        card: 'var(--shadow)',
        border: '0 0 0 1px var(--border)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}

export default config
