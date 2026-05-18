/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI Variable', 'SF Pro Text',
          'system-ui', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
        mono: [
          'JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas',
          'Liberation Mono', 'Courier New', 'monospace',
        ],
      },
      colors: {
        // Brand — rich orange
        primary: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // Neutrals — deep zinc-charcoal
        gray: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        // Semantic
        success: {
          50:  '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
          400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
          800: '#166534', 900: '#14532d', 950: '#052e16',
        },
        warning: {
          50:  '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f', 950: '#451a03',
        },
        danger: {
          50:  '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
          800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a',
        },
        // Surface tokens — kept for legacy class consumers but
        // primary surface styling now comes from CSS variables
        background: '#0a0a0b',
        surface: '#101012',
        'surface-hover': '#17171a',
        border: '#232328',
        'border-light': '#1c1c20',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.01em' }], // 11px
        'xs':  ['0.75rem',   { lineHeight: '1rem' }],     // 12px
        'sm':  ['0.8125rem', { lineHeight: '1.25rem' }],  // 13px
        'base':['0.875rem',  { lineHeight: '1.375rem' }], // 14px — denser default
        'md':  ['0.9375rem', { lineHeight: '1.5rem' }],   // 15px
        'lg':  ['1rem',      { lineHeight: '1.5rem' }],   // 16px
        'xl':  ['1.125rem',  { lineHeight: '1.625rem', letterSpacing: '-0.01em' }], // 18px
        '2xl': ['1.375rem',  { lineHeight: '1.75rem',  letterSpacing: '-0.02em' }], // 22px
        '3xl': ['1.75rem',   { lineHeight: '2.125rem', letterSpacing: '-0.025em' }], // 28px
        '4xl': ['2.25rem',   { lineHeight: '2.5rem',   letterSpacing: '-0.03em' }],  // 36px
        '5xl': ['3rem',      { lineHeight: '1.05',     letterSpacing: '-0.035em' }], // 48px
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
        'topbar': 'var(--topbar-h, 52px)',
        'sidebar': 'var(--sidebar-w, 240px)',
        'sidebar-c': 'var(--sidebar-w-collapsed, 60px)',
      },
      boxShadow: {
        'xs':   'var(--shadow-xs)',
        'sm':   'var(--shadow-sm)',
        'DEFAULT': 'var(--shadow-sm)',
        'md':   'var(--shadow-md)',
        'lg':   'var(--shadow-lg)',
        'xl':   'var(--shadow-lg)',
        '2xl':  'var(--shadow-lg)',
        'inner':'inset 0 1px 2px 0 rgba(0,0,0,0.18)',
        'glow': '0 0 0 3px var(--ring)',
        'none': 'none',
      },
      borderRadius: {
        'none':'0',
        'xs':  'var(--radius-xs)',
        'sm':  'var(--radius-sm)',
        'DEFAULT': 'var(--radius-md)',
        'md':  'var(--radius-md)',
        'lg':  'var(--radius-lg)',
        'xl':  'var(--radius-xl)',
        '2xl': '18px',
        '3xl': '22px',
        'full':'9999px',
      },
      transitionDuration: {
        '75': '75ms', '100': '100ms', '150': '150ms', '200': '200ms',
        '300': '300ms', '500': '500ms', '700': '700ms', '1000': '1000ms',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, var(--gradient-from) 0%, var(--gradient-to) 100%)',
        'gradient-subtle':  'linear-gradient(135deg, var(--gradient-subtle-from) 0%, var(--gradient-subtle-to) 100%)',
        'gradient-card':    'linear-gradient(135deg, var(--gradient-card-from) 0%, var(--gradient-card-to) 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, var(--gradient-sidebar-from) 0%, var(--gradient-sidebar-to) 100%)',
      },
      ringColor: {
        DEFAULT: 'var(--ring)',
      },
    },
  },
  plugins: [],
};
