import type {Config} from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-poppins)', 'Noto Sans', 'Arial', 'sans-serif'],
        headline: ['var(--font-poppins)', 'Noto Sans', 'Arial', 'sans-serif'],
        code: ['monospace'],
      },
      fontSize: {
        'nex-display': ['36px', { lineHeight: '1', fontWeight: '900' }],
        'nex-h1': ['26px', { lineHeight: '1.2', fontWeight: '700' }],
        'nex-h2': ['22px', { lineHeight: '1.2', fontWeight: '700' }],
        'nex-h3': ['20px', { lineHeight: '1.2', fontWeight: '700' }],
        'nex-h4': ['18px', { lineHeight: '1.2', fontWeight: '700' }],
        'nex-body': ['15px', { lineHeight: '1.5', fontWeight: '500' }],
        'nex-sub': ['14px', { lineHeight: '1.4', fontWeight: '500' }],
        'nex-caption': ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        'nex-tiny': ['11px', { lineHeight: '1.2', fontWeight: '700' }],
        'nex-xs': ['10px', { lineHeight: '1.2', fontWeight: '700' }],
      },
      borderRadius: {
        'nex-max': '48px',
        'nex-3xl': '42px',
        'nex-2xl': '40px',
        'nex-xl': '36px',
        'nex-lg': '32px',
        'nex-md': '24px',
        'nex-sm': '16px',
        'nex-xs': '14px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 8px)',
        sm: 'calc(var(--radius) - 12px)',
      },
      boxShadow: {
        'nex-soft': '0px 4px 12px rgba(0, 0, 0, 0.04)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
