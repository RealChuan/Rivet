import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  define: {
    __dirname: JSON.stringify(path.resolve(__dirname, '.vite/build')),
  },
  build: {
    lib: {
      entry: 'src/main/app/main.ts',
      formats: ['es'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'ssh2-sftp-client',
        'webdav',
        'electron-log/main',
        'electron-store',
        '@sentry/electron/main',
      ],
    },
    outDir: '.vite/build',
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@main': path.resolve(__dirname, './src/main'),
    },
  },
})
