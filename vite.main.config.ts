import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    // 生成 source map，配合 main.ts 中的 process.setSourceMapsEnabled(true)
    // 让 Error.stack 映射回原始 .ts 文件/行号，使日志 callerInfo 显示真实源文件
    sourcemap: true,
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
    tsconfigPaths: true,
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@main': path.resolve(__dirname, './src/main'),
    },
  },
})
