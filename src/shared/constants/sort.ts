export const SORT_ORDER = {
  NONE: 'none',
  ASC: 'asc',
  DESC: 'desc',
} as const

export type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER]
export type SortOrderWithDirection = typeof SORT_ORDER.ASC | typeof SORT_ORDER.DESC

export const SORT_FIELD = {
  NAME: 'name',
  PERMISSIONS: 'permissions',
  OWNER: 'owner',
  SIZE: 'size',
  MODIFY_TIME: 'modifyTime',
} as const

export type FileExplorerSortField = (typeof SORT_FIELD)[keyof typeof SORT_FIELD]
