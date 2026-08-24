/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#faf7ff',
          100: '#f1e9fe',
          200: '#e0cffd',
          300: '#c8a4fb',
          400: '#ab72f5',
          500: '#8b46e8',
          600: '#7229cc',
          700: '#5e20a8',
          800: '#4c1c86',
          900: '#3d186b',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
