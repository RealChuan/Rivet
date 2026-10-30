/**
 * SFTP 三种认证形态的判别联合。
 * 私钥只存文件路径，PEM 内容在 connect 时读盘，不进入任何配置。
 */
export type Credentials =
  | { kind: 'password'; username: string; password: string }
  | { kind: 'privateKey'; username: string; privateKeyPath: string; passphrase?: string }
  | { kind: 'agent'; username: string; agentPath?: string }
