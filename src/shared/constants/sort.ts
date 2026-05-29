export const SORT_ORDER = {
  NONE: 'none',
  ASC: 'asc',
  DESC: 'desc',
} as const

export type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER]
export type SortOrderWithDirection = typeof SORT_ORDER.ASC | typeof SORT_ORDER.DESC

export const SORT_ORDERS: SortOrder[] = [SORT_ORDER.NONE, SORT_ORDER.ASC, SORT_ORDER.DESC]

export const SORT_FIELD = {
  NAME: 'name',
  PERMISSIONS: 'permissions',
  OWNER: 'owner',
  SIZE: 'size',
  MODIFY_TIME: 'modifyTime',
} as const

export type FileExplorerSortField = (typeof SORT_FIELD)[keyof typeof SORT_FIELD]

export type FileExplorerSortFieldBasic =
  | typeof SORT_FIELD.NAME
  | typeof SORT_FIELD.SIZE
  | typeof SORT_FIELD.MODIFY_TIME

export const FILE_EXPLORER_SORT_FIELDS: FileExplorerSortField[] = [
  SORT_FIELD.NAME,
  SORT_FIELD.PERMISSIONS,
  SORT_FIELD.OWNER,
  SORT_FIELD.SIZE,
  SORT_FIELD.MODIFY_TIME,
]
