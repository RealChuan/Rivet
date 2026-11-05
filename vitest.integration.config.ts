import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 真实服务集成测试：默认门禁不跑，需要本机或 CI 先起 SFTP/SMB/WebDAV/S3 服务；
 * SMB 暂不进 provider 集成测试，走 e2e 的 Samba 容器。
 *
 *   RIVET_INTEGRATION=1 pnpm run test:integration
 *
 * SFTP 默认可写根目录；chroot 服务器（atmoz/sftp）会自动回退到 /upload，
 * 也可用 RIVET_SFTP_ROOT 显式指定。WebDAV 用 RIVET_WEBDAV_URL 指定地址。
 *
 * 私钥用例需要 RIVET_SFTP_PRIVATE_KEY（可选 RIVET_SFTP_PRIVATE_KEY_PASSPHRASE），
 * 通常配合 `python scripts/sftp/serve.py --auth both --emit-client-key` 使用。
 */
export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/main/**/*.integration.ts'],
    // 真实网络与磁盘操作比单测慢，给足单条用例与钩子的时间。
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // 同一文件内共享一个会话，避免并发用例互相踩远端目录。
    fileParallelism: false,
    fsModuleCache: false,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
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
