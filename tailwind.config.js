/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        surface: {
          light: '#ffffff',
          dark: '#181818',
        },
        sidebar: {
          light: '#f8f8f8',
          dark: '#252526',
        },
        border: {
          light: '#e5e5e5',
          dark: '#3c3c3c',
        },
        text: {
          primary: {
            light: '#000000',
            dark: '#e5e5e5',
          },
          secondary: {
            light: '#6b6b6b',
            dark: '#858585',
          },
        },
        accent: {
          yellow: '#dcbb14',
          blue: '#0e639c',
          green: '#4ec9b0',
          red: '#f14c4c',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        elevated: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
