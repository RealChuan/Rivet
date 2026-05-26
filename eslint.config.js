import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'release/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: ['tsconfig.json', 'tsconfig.main.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // ESLint 推荐规则
      ...js.configs.recommended.rules,

      // TypeScript 严格规则（使用 type-aware 规则）
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs['recommended-type-checked'].rules,

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // TypeScript 严格检查
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',

      // 代码质量
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',

      // 关闭与 TS 重叠或冲突的规则
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    // main 进程专用规则（可放宽部分 React 相关规则）
    files: ['src/main/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
]
