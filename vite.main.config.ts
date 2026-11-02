import { defineConfig } from 'vite'

export default defineConfig({
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
      external: ['electron', 'ssh2', 'undici', 'electron-log/main', '@sentry/electron/main'],
    },
    outDir: '.vite/build',
    emptyOutDir: false,
  },
  resolve: {
    tsconfigPaths: true,
  },
})
