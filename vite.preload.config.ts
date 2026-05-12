import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  build: {
    outDir: './dist/main/preload',
    emptyOutDir: false,
    lib: {
      entry: 'src/main/preload/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.cjs',
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        exports: 'none',
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
})
