import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nodeTest = {
  globals: true,
  setupFiles: ['./vitest.setup.ts'],
  clearMocks: true,
}

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    // 关闭模块级磁盘缓存：缓存目录损坏时 vitest 会整目录清空，
    // 在受限环境里会触发批量删除保护而整体失败；重跑成本远低于此风险。
    fsModuleCache: false,
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          ...nodeTest,
          name: 'main',
          environment: 'node',
          include: ['src/main/**/*.test.ts', 'src/preload/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          ...nodeTest,
          name: 'shared',
          environment: 'node',
          include: ['src/shared/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['./vitest.setup.ts', './vitest.setup.dom.ts'],
        },
      },
    ],
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
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Electron 依赖隔离：测试时重定向到 mock 模块
      'electron-log/renderer': path.resolve(
        __dirname,
        './src/shared/test-utils/mocks/electron-log-renderer.ts',
      ),
      'electron-log/main': path.resolve(
        __dirname,
        './src/shared/test-utils/mocks/electron-log-main.ts',
      ),
      electron: path.resolve(__dirname, './src/shared/test-utils/mocks/electron.ts'),
    },
  },
})
