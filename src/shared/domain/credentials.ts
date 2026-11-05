/**
 * 认证形态的判别联合。
 * 私钥只存文件路径，PEM 内容在 connect 时读盘，不进入任何配置。
 * `accessKey` 供 S3 兼容对象存储使用：Access Key ID 与用户名共用一个持久化字段，
 * Secret Access Key 只存在 safeStorage 里。
 */
export type Credentials =
  | { kind: 'password'; username: string; password: string }
  | { kind: 'privateKey'; username: string; privateKeyPath: string; passphrase?: string }
  | { kind: 'agent'; username: string; agentPath?: string }
  | { kind: 'accessKey'; accessKeyId: string; secretAccessKey: string }
