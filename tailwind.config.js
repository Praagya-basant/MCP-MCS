/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-subtle': 'rgb(var(--color-surface-subtle) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          strong: 'rgb(var(--color-border-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          secondary: 'rgb(var(--color-ink-secondary) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted) / <alpha-value>)',
        },
        sidebar: 'rgb(var(--color-sidebar) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          hover: 'rgb(var(--color-accent-hover) / <alpha-value>)',
          ink: 'rgb(var(--color-accent-ink) / <alpha-value>)',
        },
        // Semantic status colors — exact hex values from the design spec
        // (Success #22C55E/#F0FDF4, Warning #F59E0B/#FFFBEB, Transit
        // #3B82F6/#EFF6FF, Expired #EF4444/#FEF2F2 in light mode); dark
        // mode gets its own muted-tint bg vars since the spec is light-
        // mode-only, but the app's existing dark theme stays supported.
        status: {
          'in-hall-bg': 'rgb(var(--color-success-bg) / <alpha-value>)',
          'in-hall-text': 'rgb(var(--color-success) / <alpha-value>)',
          'checked-out-bg': 'rgb(var(--color-warning-bg) / <alpha-value>)',
          'checked-out-text': 'rgb(var(--color-warning) / <alpha-value>)',
          'in-transit-bg': 'rgb(var(--color-info-bg) / <alpha-value>)',
          'in-transit-text': 'rgb(var(--color-info) / <alpha-value>)',
          'expired-bg': 'rgb(var(--color-error-bg) / <alpha-value>)',
          'expired-text': 'rgb(var(--color-error) / <alpha-value>)',
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
      },
      fontSize: {
        caption: ['12px', { lineHeight: '16px' }],
        body: ['14px', { lineHeight: '20px' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        heading: ['20px', { lineHeight: '28px' }],
        display: ['28px', { lineHeight: '34px' }],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
      },
      borderRadius: {
        card: '10px',
        control: '7px',
        modal: '12px',
        pill: '100px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04)',
        lift: '0 4px 12px rgba(0,0,0,0.08)',
        dropdown: '0 12px 32px rgba(0,0,0,0.14)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};
