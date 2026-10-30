import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [],
    environment: 'node',
    typecheck: {
      include: ['src/**/*.test-d.ts'],
      tsconfig: './tsconfig.main.json',
    },
  },
  resolve: { tsconfigPaths: true },
})
