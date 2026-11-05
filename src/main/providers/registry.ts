import type { Credentials } from '@shared/domain/credentials.js'
import type { ProviderKind } from '@shared/domain/entry.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { SCHEME } from '@shared/constants/protocol.js'
import type { SmbClientPort } from './smb/client.js'
import type { FileProvider } from './types.js'
import type { WebdavHttpPort } from './webdav/http.js'
import { ProviderError } from './errors.js'
import { createS3Client, type S3ClientPort } from './s3/client.js'
import { createS3Provider } from './s3/provider.js'
import { createSftpProvider } from './sftp/provider.js'
import { Ssh2SftpConnection } from './sftp/ssh2-connection.js'
import { createSmbProvider } from './smb/provider.js'
import { WebdavHttpClient } from './webdav/http.js'
import { createWebdavProvider } from './webdav/provider.js'

export interface ProviderFactoryOptions {
  config: ConnectionConfig
  hostVerifier?: (publicKey: Buffer) => boolean
  /** 测试注入点；缺省时构造真实 undici 客户端。 */
  createHttp?: (credentials: Credentials) => WebdavHttpPort
  /** 测试注入点；缺省时构造真实 v9u-smb2 客户端。 */
  createSmbClient?: (config: ConnectionConfig, credentials: Credentials) => SmbClientPort
  /** 测试注入点；缺省时构造真实 aws-sdk 客户端。 */
  createS3Client?: (config: ConnectionConfig, credentials: Credentials) => S3ClientPort
}

export function webdavBaseUrl(config: ConnectionConfig): string {
  const scheme = config.scheme ?? SCHEME.HTTPS
  return `${scheme}://${config.host}:${config.port}`
}

function assertNever(kind: never): never {
  throw new ProviderError(ERROR_CODE.NOT_SUPPORTED, `unsupported provider: ${String(kind)}`)
}

/**
 * 新增协议时在 `ProviderKind` 加一项，这里的 `default` 会编译失败。
 */
export function createProvider(kind: ProviderKind, options: ProviderFactoryOptions): FileProvider {
  switch (kind) {
    case 'sftp':
      return createSftpProvider(
        new Ssh2SftpConnection(options.config),
        options.hostVerifier !== undefined ? { hostVerifier: options.hostVerifier } : {},
      )

    case 'smb':
      return createSmbProvider({
        config: options.config,
        ...(options.createSmbClient !== undefined ? { createClient: options.createSmbClient } : {}),
      })

    case 'webdav':
      if ((options.config.authKind ?? 'password') !== 'password') {
        throw new ProviderError(
          ERROR_CODE.INVALID_CONFIG,
          'WebDAV only supports password authentication',
        )
      }
      return createWebdavProvider({
        config: options.config,
        createHttp:
          options.createHttp ??
          ((credentials) =>
            new WebdavHttpClient({
              baseUrl: webdavBaseUrl(options.config),
              // WebDAV 只接受密码认证，其余形态在 provider.connect 里已被拒绝。
              username: credentials.kind === 'password' ? credentials.username : '',
              password: credentials.kind === 'password' ? credentials.password : '',
              rejectUnauthorized: options.config.rejectUnauthorized ?? true,
            })),
      })

    case 's3':
      return createS3Provider({
        config: options.config,
        createClient:
          options.createS3Client ?? ((config, credentials) => createS3Client(config, credentials)),
      })

    default:
      return assertNever(kind)
  }
}
