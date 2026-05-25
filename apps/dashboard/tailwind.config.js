/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // MODECT brand colors
        primary: {
          DEFAULT: '#2D6A9F',
          50:  '#E8F4FD',
          100: '#C5E0F5',
          200: '#9ECAEC',
          300: '#71B1E2',
          400: '#4F9CD9',
          500: '#2D6A9F',
          600: '#245682',
          700: '#1B4165',
          800: '#122C47',
          900: '#091729',
        },
        accent: {
          DEFAULT: '#F4A261',
          50:  '#FFF8F0',
          100: '#FDE8CB',
          200: '#FAD09A',
          300: '#F7B96A',
          400: '#F4A261',
          500: '#F08C3A',
          600: '#D97220',
          700: '#B05A18',
          800: '#874410',
          900: '#5E2E08',
        },
        background: '#FAFAFA',
        surface: '#FFFFFF',
        muted: '#F1F5F9',
      },
      fontFamily: {
        title: ['"Playfair Display"', 'Georgia', 'serif'],
        body:  ['"Source Sans 3"', '"Source Sans Pro"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
