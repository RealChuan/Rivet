export const SORT_ORDER_NONE = 'none' as const
export const SORT_ORDER_ASC = 'asc' as const
export const SORT_ORDER_DESC = 'desc' as const

export type SortOrder = typeof SORT_ORDER_NONE | typeof SORT_ORDER_ASC | typeof SORT_ORDER_DESC

export type SortOrderWithDirection = typeof SORT_ORDER_ASC | typeof SORT_ORDER_DESC

export const SORT_ORDERS: SortOrder[] = [SORT_ORDER_NONE, SORT_ORDER_ASC, SORT_ORDER_DESC]

export const SORT_FIELD_NAME = 'name' as const
export const SORT_FIELD_PERMISSIONS = 'permissions' as const
export const SORT_FIELD_OWNER = 'owner' as const
export const SORT_FIELD_SIZE = 'size' as const
export const SORT_FIELD_MODIFY_TIME = 'modifyTime' as const

export type FileExplorerSortField =
  | typeof SORT_FIELD_NAME
  | typeof SORT_FIELD_PERMISSIONS
  | typeof SORT_FIELD_OWNER
  | typeof SORT_FIELD_SIZE
  | typeof SORT_FIELD_MODIFY_TIME

export type FileExplorerSortFieldBasic =
  | typeof SORT_FIELD_NAME
  | typeof SORT_FIELD_SIZE
  | typeof SORT_FIELD_MODIFY_TIME

export const FILE_EXPLORER_SORT_FIELDS: FileExplorerSortField[] = [
  SORT_FIELD_NAME,
  SORT_FIELD_PERMISSIONS,
  SORT_FIELD_OWNER,
  SORT_FIELD_SIZE,
  SORT_FIELD_MODIFY_TIME,
]
