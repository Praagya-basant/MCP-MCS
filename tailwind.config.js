/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: '#FFFFFF',
        surface: '#F8F8F7',
        'surface-subtle': '#F3F3F1',
        border: {
          DEFAULT: '#E8E8E5',
          strong: '#D4D4CF',
        },
        ink: {
          DEFAULT: '#1A1A1A',
          secondary: '#6B6B6B',
          muted: '#9B9B9B',
        },
        sidebar: '#FAFAF9',
        status: {
          'in-hall-bg': '#F0FDF4',
          'in-hall-text': '#16A34A',
          'checked-out-bg': '#FFFBEB',
          'checked-out-text': '#D97706',
          'in-transit-bg': '#EFF6FF',
          'in-transit-text': '#2563EB',
          'expired-bg': '#FEF2F2',
          'expired-text': '#DC2626',
        },
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
        card: '0 1px 2px rgba(0,0,0,0.04)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};
