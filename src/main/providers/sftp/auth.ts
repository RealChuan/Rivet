import fs from 'node:fs'
import type { Credentials } from '@shared/domain/credentials.js'
import type { AppError } from '@shared/domain/error.js'
import { ERROR_CODE, TIMEOUTS } from '@shared/constants/index.js'
import { ProviderError } from '../errors.js'

export interface SshAuthConfig {
  username: string
  password?: string
  privateKey?: Buffer
  passphrase?: string
  agent?: string
  readyTimeout: number
}

const WINDOWS_AGENT_PIPE = '\\\\.\\pipe\\openssh-ssh-agent'

export function resolveAgentPath(
  agentPath: string | undefined,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): string {
  if (agentPath) return agentPath
  if (platform === 'win32') return WINDOWS_AGENT_PIPE

  const socket = env.SSH_AUTH_SOCK
  if (!socket) {
    throw new ProviderError(ERROR_CODE.AGENT_NOT_AVAILABLE, 'SSH_AUTH_SOCK is not set')
  }
  return socket
}

/**
 * 私钥只读文件路径，PEM 内容在 connect 时读入内存，绝不写入配置。
 */
export async function buildSshAuthConfig(
  credentials: Credentials,
  platform: NodeJS.Platform = process.platform,
): Promise<SshAuthConfig> {
  switch (credentials.kind) {
    case 'password':
      return {
        username: credentials.username,
        password: credentials.password,
        readyTimeout: TIMEOUTS.SFTP_READY,
      }

    case 'privateKey': {
      let privateKey: Buffer
      try {
        privateKey = await fs.promises.readFile(credentials.privateKeyPath)
      } catch {
        throw new ProviderError(
          ERROR_CODE.KEY_FILE_UNREADABLE,
          `Cannot read private key: ${credentials.privateKeyPath}`,
        )
      }

      return {
        username: credentials.username,
        privateKey,
        ...(credentials.passphrase !== undefined ? { passphrase: credentials.passphrase } : {}),
        readyTimeout: TIMEOUTS.SFTP_READY,
      }
    }

    case 'agent':
      return {
        username: credentials.username,
        agent: resolveAgentPath(credentials.agentPath, platform, process.env),
        readyTimeout: TIMEOUTS.SFTP_READY,
      }
  }
}

/** 把 ssh2 的认证错误映射为稳定的协议错误码。 */
export function mapSshAuthError(cause: unknown, kind: Credentials['kind']): AppError {
  const message = cause instanceof Error ? cause.message : String(cause)
  const detail = { serverMessage: message }

  if (kind === 'privateKey') {
    if (/passphrase|encrypted/i.test(message)) {
      return { code: ERROR_CODE.PASSPHRASE_REQUIRED, message, detail }
    }
    if (/parse privatekey|unsupported key format/i.test(message)) {
      return { code: ERROR_CODE.KEY_PARSE_FAILED, message, detail }
    }
  }

  if (kind === 'agent' && /authentication methods failed|no auth|identity/i.test(message)) {
    return { code: ERROR_CODE.AGENT_NO_IDENTITY, message, detail }
  }

  return { code: ERROR_CODE.CONN_FAILED, message, detail }
}
