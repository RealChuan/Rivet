import { defineConfig } from 'vite'

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
  },
})
