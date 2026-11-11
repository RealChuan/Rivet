/**
 * POSIX shell 单引号引用：内部的 `'` 用 `'\''` 断开再加。
 * 交互式 shell 只保证 POSIX 语义，不兼容 fish / csh 的转义规则。
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
