import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    lib: {
      entry: 'src/preload/index.ts',
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
    outDir: '.vite/build',
    emptyOutDir: false,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
})
