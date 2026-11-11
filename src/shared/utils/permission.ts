/**
 * 权限位与 `rwxr-xr-x` 符号串互转，只看低 9 位。
 * 类型位与 setuid/setgid/sticky 由调用方保留。
 */

const PERMISSION_PATTERN = /^[r-][w-][x-][r-][w-][x-][r-][w-][x-]$/

/** 权限位 → 9 位符号串，例如 `0o755` → `rwxr-xr-x`。 */
export const formatPermissions = (mode: number): string =>
  [6, 3, 0]
    .map((shift) => {
      const group = (mode >> shift) & 0o7
      return `${group & 0o4 ? 'r' : '-'}${group & 0o2 ? 'w' : '-'}${group & 0o1 ? 'x' : '-'}`
    })
    .join('')

/** 9 位符号串 → 权限位；格式不符时返回 null。 */
export const parsePermissions = (text: string): number | null => {
  if (!PERMISSION_PATTERN.test(text)) return null

  let mode = 0
  for (const [index, char] of [...text].entries()) {
    if (char !== '-') mode |= 0o400 >> index
  }
  return mode
}
