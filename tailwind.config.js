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
        // Semantic status colors — same hue in light/dark (only the tint
        // backgrounds' perceived weight shifts, automatically, since
        // they're alpha-blended over each theme's own card color).
        status: {
          'in-hall-bg': 'rgb(var(--color-success) / 0.14)',
          'in-hall-text': 'rgb(var(--color-success) / <alpha-value>)',
          'checked-out-bg': 'rgb(var(--color-warning) / 0.14)',
          'checked-out-text': 'rgb(var(--color-warning) / <alpha-value>)',
          'in-transit-bg': 'rgb(var(--color-info) / 0.14)',
          'in-transit-text': 'rgb(var(--color-info) / <alpha-value>)',
          'expired-bg': 'rgb(var(--color-error) / 0.14)',
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
        card: '0 2px 8px rgba(0,0,0,0.08)',
        lift: '0 8px 20px rgba(0,0,0,0.12)',
        float: '0 8px 32px rgba(0,0,0,0.12)',
        dropdown: '0 12px 32px rgba(0,0,0,0.14)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};
