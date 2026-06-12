import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
    tailwindcss(),
  ],
  base: './',
  root: 'src/renderer',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron', 'electron-store', 'electron-log'],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/i18next/') || id.includes('node_modules/react-i18next/')) {
            return 'vendor-i18n'
          }
          if (
            id.includes('node_modules/react-window/') ||
            id.includes('node_modules/react-virtualized-auto-sizer/') ||
            id.includes('node_modules/@dnd-kit/')
          ) {
            return 'vendor-ui'
          }
          if (
            id.includes('node_modules/zustand/') ||
            id.includes('node_modules/clsx/') ||
            id.includes('node_modules/tailwind-merge/')
          ) {
            return 'vendor-utils'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@preload': path.resolve(__dirname, './src/preload'),
      '@tests': path.resolve(__dirname, './src/tests'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
