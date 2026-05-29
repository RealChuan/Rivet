import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/shared/**/*.ts', 'src/main/**/*.ts', 'src/renderer/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/main/app/**',
        'src/preload/**',
        '**/*.d.ts',
        '**/*.config.ts',
        'src/main/main.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
      '@shared': path.resolve(__dirname, './src/shared'),
      // Electron 依赖隔离：测试时重定向到 mock 模块
      'electron-log/renderer': path.resolve(
        __dirname,
        './src/shared/test-utils/mocks/electron-log-renderer.ts'
      ),
      'electron-log/main': path.resolve(
        __dirname,
        './src/shared/test-utils/mocks/electron-log-main.ts'
      ),
      'electron-store': path.resolve(__dirname, './src/shared/test-utils/mocks/electron-store.ts'),
      electron: path.resolve(__dirname, './src/shared/test-utils/mocks/electron.ts'),
    },
  },
})
