import type * as Ssh2 from 'ssh2'
import { createRequire } from 'node:module'

/**
 * ssh2 是 CommonJS；主进程产物是 ESM。Node 的静态命名导出探测看不到 ssh2 的
 * 动态 module.exports，直接用 `import { Client }` 会在打包后抛
 * “Named export 'utils' not found”。用 createRequire 保持 CJS 语义。
 */
const require = createRequire(import.meta.url)
export const ssh2 = require('ssh2') as typeof Ssh2
