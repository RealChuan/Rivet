export function toggleSortOrder<T extends string>(
  currentField: T,
  currentOrder: 'asc' | 'desc',
  newField: T,
): { sortField: T; sortOrder: 'asc' | 'desc' } {
  if (currentField === newField) {
    return { sortField: currentField, sortOrder: currentOrder === 'asc' ? 'desc' : 'asc' }
  }
  return { sortField: newField, sortOrder: 'asc' }
}
