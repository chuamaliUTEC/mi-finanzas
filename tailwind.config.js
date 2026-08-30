/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Lila/lavanda como acento, no como fondo dominante.
        lavender: {
          50: '#faf8ff',
          100: '#f2edfd',
          200: '#e3d8fa',
          300: '#cdb8f3',
          400: '#ac8de7',
          500: '#8c63d6',
          600: '#7247bd',
          700: '#5c379a',
          800: '#4a2d7c',
          900: '#3c2564',
        },
        ink: {
          50: '#f8f8fa',
          100: '#f0f0f4',
          200: '#e2e2e9',
          300: '#c9c9d4',
          400: '#a3a3b3',
          500: '#79798d',
          600: '#5b5b6e',
          700: '#454555',
          800: '#2e2e3a',
          900: '#1c1c24',
        },
        positive: '#2f9e6e',
        warning: '#c98a1f',
        risk: '#d9722f',
        critical: '#d13a3a',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(28 28 36 / 0.04), 0 1px 8px -2px rgb(28 28 36 / 0.06)',
      },
    },
  },
  plugins: [],
}
